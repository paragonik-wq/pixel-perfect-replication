import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const FREE_LIMIT = 3;
const PLUS_LIMIT = 100;

const PROMPT = `Odczytaj polski paragon. Zwróć WYŁĄCZNIE JSON bez żadnego innego tekstu:
{"product_name": string|null, "store": string|null, "purchase_date": "YYYY-MM-DD"|null, "total_amount": number|null, "items": [{"name": string, "price": number}]}
product_name = najdroższy produkt na paragonie. Nigdy nie zwracaj numerów kart, numerów kont ani NIP-u kupującego.`;

export type WynikSkanu =
  | {
      ok: true;
      product_name: string | null;
      store: string | null;
      purchase_date: string | null;
      total_amount: number | null;
      free_left: number | null;
    }
  | { ok: false; error: "LIMIT_REACHED" | "READ_FAILED" };

function biezacyMiesiac() {
  return new Date().toISOString().slice(0, 7);
}

async function wywolajModel(apiKey: string, base64: string): Promise<string> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/messages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: "anthropic/claude-haiku-4-5",
      max_tokens: 1000,
      stream: true,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64 } },
            { type: "text", text: PROMPT },
          ],
        },
      ],
    }),
  });
  if (!res.ok || !res.body) {
    console.error("AI gateway error", res.status, await res.text().catch(() => ""));
    throw new Error("AI_FAILED");
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let text = "";
  let refused = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const ev = JSON.parse(payload);
        if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") text += ev.delta.text;
        if (ev.type === "message_delta" && ev.delta?.stop_reason === "refusal") refused = true;
        if (ev.type === "error") throw new Error("AI_FAILED");
      } catch (e) {
        if (e instanceof Error && e.message === "AI_FAILED") throw e;
      }
    }
  }
  if (refused) throw new Error("AI_FAILED");
  return text;
}

export const scanReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ path: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }): Promise<WynikSkanu> => {
    const { supabase, userId } = context;
    if (!data.path.startsWith(`${userId}/`)) return { ok: false, error: "READ_FAILED" };

    const { data: profil } = await supabase
      .from("profiles")
      .select("plan, free_scans_used")
      .eq("id", userId)
      .maybeSingle();
    const plan = profil?.plan ?? "free";
    const uzyte = profil?.free_scans_used ?? 0;
    const miesiac = biezacyMiesiac();

    if (plan === "plus") {
      const { data: u } = await supabase
        .from("scan_usage")
        .select("count")
        .eq("user_id", userId)
        .eq("month", miesiac)
        .maybeSingle();
      if ((u?.count ?? 0) >= PLUS_LIMIT) return { ok: false, error: "LIMIT_REACHED" };
    } else if (uzyte >= FREE_LIMIT) {
      return { ok: false, error: "LIMIT_REACHED" };
    }

    const { data: plik, error: blad } = await supabase.storage.from("receipts").download(data.path);
    if (blad || !plik) return { ok: false, error: "READ_FAILED" };
    const base64 = Buffer.from(await plik.arrayBuffer()).toString("base64");

    let wynik: Record<string, unknown>;
    try {
      const tekst = await wywolajModel(process.env["LOVABLE_API_KEY"]!, base64);
      const czysty = tekst.replace(/```json/gi, "").replace(/```/g, "").trim();
      const start = czysty.indexOf("{");
      const koniec = czysty.lastIndexOf("}");
      wynik = JSON.parse(czysty.slice(start, koniec + 1));
    } catch (e) {
      console.error("scan failed", e);
      return { ok: false, error: "READ_FAILED" };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let freeLeft: number | null = null;
    if (plan === "plus") {
      const { data: u } = await supabaseAdmin
        .from("scan_usage")
        .select("count")
        .eq("user_id", userId)
        .eq("month", miesiac)
        .maybeSingle();
      await supabaseAdmin
        .from("scan_usage")
        .upsert({ user_id: userId, month: miesiac, count: (u?.count ?? 0) + 1 });
    } else {
      await supabaseAdmin.from("profiles").update({ free_scans_used: uzyte + 1 }).eq("id", userId);
      freeLeft = Math.max(0, FREE_LIMIT - uzyte - 1);
    }

    const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
    const data_ = str(wynik.purchase_date);
    const kwota = Number(wynik.total_amount);
    return {
      ok: true,
      product_name: str(wynik.product_name),
      store: str(wynik.store),
      purchase_date: data_ && /^\d{4}-\d{2}-\d{2}$/.test(data_) ? data_ : null,
      total_amount: Number.isFinite(kwota) && wynik.total_amount !== null ? kwota : null,
      free_left: freeLeft,
    };
  });
