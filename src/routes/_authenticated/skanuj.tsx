import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Check, Plus, ScanLine, ShieldCheck, Sparkles } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { scanReceipt, type WynikSkanu } from "@/lib/scan.functions";
import { dodajLata, dzisiaj, formatData } from "@/lib/paragonik";
import { PrzyciskiSkanowania } from "@/components/PrzyciskiSkanowania";

export const Route = createFileRoute("/_authenticated/skanuj")({
  validateSearch: z.object({ path: z.string() }),
  head: () => ({
    meta: [
      { title: "Skanowanie paragonu — Paragonik" },
      { name: "description", content: "Paragonik odczytuje zdjęcie paragonu i zapisuje zakup." },
      { property: "og:title", content: "Skanowanie paragonu — Paragonik" },
      { property: "og:description", content: "Odczytujemy paragon za Ciebie." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Skanuj,
});

const pole = "mt-2 h-14 w-full rounded-2xl border border-border bg-card px-4 text-lg outline-none focus:border-primary";
const etykieta = "mt-5 block font-bold";

function odmianaSkanow(n: number) {
  if (n === 1) return "Został Ci 1 darmowy skan";
  if (n >= 2 && n <= 4) return `Zostały Ci ${n} darmowe skany`;
  return `Zostało Ci ${n} darmowych skanów`;
}

function Skanuj() {
  const { path } = Route.useSearch();
  const skanuj = useServerFn(scanReceipt);
  const [stan, setStan] = useState<"laduje" | "gotowe" | "blad" | "limit">("laduje");
  const [wynik, setWynik] = useState<Extract<WynikSkanu, { ok: true }> | null>(null);
  const [miniatura, setMiniatura] = useState<string | null>(null);
  const uruchomiono = useRef<string | null>(null);

  useEffect(() => {
    if (uruchomiono.current === path) return;
    uruchomiono.current = path;
    setStan("laduje");
    void supabase.storage
      .from("receipts")
      .createSignedUrl(path, 3600)
      .then(({ data }) => setMiniatura(data?.signedUrl ?? null));
    skanuj({ data: { path } })
      .then((r) => {
        if (r.ok) {
          setWynik(r);
          setStan("gotowe");
        } else setStan(r.error === "LIMIT_REACHED" ? "limit" : "blad");
      })
      .catch(() => setStan("blad"));
  }, [path, skanuj]);

  return (
    <main className="min-h-screen py-8">
      <div className="app-shell">
        <Link to="/zakupy" className="inline-flex items-center gap-2 text-muted-foreground">
          <ArrowLeft className="h-5 w-5" strokeWidth={2} />
          Wróć
        </Link>

        {stan === "laduje" && (
          <div className="mt-24 flex flex-col items-center text-center">
            <div className="relative flex h-28 w-28 items-center justify-center rounded-3xl bg-primary-soft">
              <ScanLine className="h-14 w-14 animate-pulse text-primary" strokeWidth={1.75} />
              <span className="absolute inset-0 animate-ping rounded-3xl border-2 border-primary/30" />
            </div>
            <h1 className="mt-8 text-3xl">Czytam paragon…</h1>
            <p className="mt-3 text-muted-foreground">To potrwa kilka sekund.</p>
          </div>
        )}

        {stan === "blad" && (
          <div className="mt-10">
            <h1 className="text-3xl">Coś poszło nie tak</h1>
            <p className="mt-4 rounded-2xl bg-urgent-soft p-4 text-urgent">
              Nie udało się odczytać paragonu. Zrób zdjęcie przy lepszym świetle albo wpisz dane ręcznie.
            </p>
            <div className="mt-6">
              <PrzyciskiSkanowania kompakt />
            </div>
          </div>
        )}

        {stan === "limit" && <EkranPlus />}

        {stan === "gotowe" && wynik && <Wynik path={path} wynik={wynik} miniatura={miniatura} />}
      </div>
    </main>
  );
}

function Wynik({
  path,
  wynik,
  miniatura,
}: {
  path: string;
  wynik: Extract<WynikSkanu, { ok: true }>;
  miniatura: string | null;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [produkt, setProdukt] = useState(wynik.product_name ?? "");
  const [sklep, setSklep] = useState(wynik.store ?? "");
  const [data, setData] = useState(wynik.purchase_date ?? dzisiaj());
  const [kwota, setKwota] = useState(
    wynik.total_amount !== null ? wynik.total_amount.toFixed(2).replace(".", ",") : "",
  );
  const [pokazZwrot, setPokazZwrot] = useState(false);
  const [zwrot, setZwrot] = useState("");
  const [zajety, setZajety] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);

  async function zapisz(e: React.FormEvent) {
    e.preventDefault();
    setZajety(true);
    setBlad(null);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const { error } = await supabase.from("purchases").insert({
      user_id: auth.user.id,
      product_name: produkt.trim(),
      store: sklep.trim(),
      purchase_date: data,
      amount: Number(kwota.replace(/\s/g, "").replace(",", ".")) || 0,
      return_deadline: zwrot || null,
      complaint_deadline: dodajLata(data, 2),
      receipt_image_path: path,
    });
    setZajety(false);
    if (error) {
      setBlad("Nie udało się zapisać paragonu. Spróbuj jeszcze raz.");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["zakupy"] });
    navigate({ to: "/zakupy" });
  }

  return (
    <>
      <h1 className="mt-6 flex items-center gap-2 text-3xl">
        <Check className="h-8 w-8 text-primary" strokeWidth={2.5} />
        Paragon odczytany
      </h1>
      <p className="mt-2 text-muted-foreground">Sprawdź dane i popraw, jeśli coś się nie zgadza.</p>

      {miniatura && (
        <img
          src={miniatura}
          alt="Zdjęcie paragonu"
          className="mt-5 h-40 w-full rounded-2xl border border-border bg-card object-contain"
        />
      )}

      <form onSubmit={zapisz}>
        <label htmlFor="produkt" className={etykieta}>Produkt</label>
        <input id="produkt" required value={produkt} onChange={(e) => setProdukt(e.target.value)} className={pole} />

        <label htmlFor="sklep" className={etykieta}>Sklep</label>
        <input id="sklep" required value={sklep} onChange={(e) => setSklep(e.target.value)} className={pole} />

        <label htmlFor="data" className={etykieta}>Data zakupu</label>
        <input id="data" type="date" required value={data} onChange={(e) => setData(e.target.value)} className={pole} />

        <label htmlFor="kwota" className={etykieta}>Kwota (zł)</label>
        <input id="kwota" inputMode="decimal" required value={kwota} onChange={(e) => setKwota(e.target.value)} className={pole} />

        <div className="mt-6 flex items-center gap-3 rounded-2xl bg-primary-soft p-4 text-primary">
          <ShieldCheck className="h-6 w-6 shrink-0" strokeWidth={2} />
          <p className="font-bold">Reklamacja możliwa do {formatData(dodajLata(data, 2))}</p>
        </div>

        {pokazZwrot ? (
          <>
            <label htmlFor="zwrot" className={etykieta}>Termin zwrotu</label>
            <input id="zwrot" type="date" value={zwrot} onChange={(e) => setZwrot(e.target.value)} className={pole} />
          </>
        ) : (
          <button
            type="button"
            onClick={() => setPokazZwrot(true)}
            className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card font-bold"
          >
            <Plus className="h-5 w-5" strokeWidth={2} />
            Dodaj termin zwrotu
          </button>
        )}

        {blad && <p className="mt-4 rounded-2xl bg-urgent-soft p-4 text-urgent">{blad}</p>}

        <button
          type="submit"
          disabled={zajety}
          className="mt-6 h-14 w-full rounded-2xl bg-primary px-6 text-lg font-bold text-primary-foreground disabled:opacity-60"
        >
          {zajety ? "Zapisywanie…" : "Zapisz paragon"}
        </button>
        {wynik.free_left !== null && (
          <p className="mt-3 text-center text-muted-foreground">{odmianaSkanow(wynik.free_left)}</p>
        )}
      </form>
    </>
  );
}

function EkranPlus() {
  return (
    <div className="mt-8">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-soft">
        <Sparkles className="h-8 w-8 text-primary" strokeWidth={2} />
      </div>
      <h1 className="mt-5 text-3xl">Paragonik Plus</h1>
      <p className="mt-3 text-muted-foreground">
        Wykorzystałeś darmowe skany. Z planem Plus zeskanujesz do 100 paragonów miesięcznie.
      </p>
      <ul className="card-paper mt-6 space-y-3">
        {["100 skanów paragonów w miesiącu", "Przypomnienia o terminach", "Bez reklam, bez podawania PESEL"].map((t) => (
          <li key={t} className="flex items-center gap-3">
            <Check className="h-5 w-5 shrink-0 text-primary" strokeWidth={2.5} />
            {t}
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled
        className="mt-6 h-14 w-full rounded-2xl bg-primary px-6 text-lg font-bold text-primary-foreground opacity-60"
      >
        Wkrótce dostępne
      </button>
      <Link
        to="/dodaj"
        className="mt-3 flex h-14 w-full items-center justify-center rounded-2xl border border-border bg-card font-bold"
      >
        Wpisz ręcznie
      </Link>
    </div>
  );
}
