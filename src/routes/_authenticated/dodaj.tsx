import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { dodajDni, dodajLata, dzisiaj } from "@/lib/paragonik";

const searchSchema = z.object({ id: z.string().optional() });

export const Route = createFileRoute("/_authenticated/dodaj")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Dodaj zakup — Paragonik" },
      { name: "description", content: "Zapisz zakup i termin zwrotu w Paragoniku." },
      { property: "og:title", content: "Dodaj zakup — Paragonik" },
      { property: "og:description", content: "Zapisz zakup i termin zwrotu." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Formularz,
});

const pole = "mt-2 h-14 w-full rounded-2xl border border-border bg-card px-4 text-lg outline-none focus:border-primary";
const etykieta = "mt-5 block font-bold";

function Formularz() {
  const { id } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [produkt, setProdukt] = useState("");
  const [sklep, setSklep] = useState("");
  const [data, setData] = useState(dzisiaj());
  const [kwota, setKwota] = useState("");
  const [kategoria, setKategoria] = useState("");
  const [przezInternet, setPrzezInternet] = useState(false);
  const [terminZwrotu, setTerminZwrotu] = useState("");
  const [zajety, setZajety] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      const { data: row } = await supabase.from("purchases").select("*").eq("id", id).maybeSingle();
      if (!row) return;
      setProdukt(row.product_name);
      setSklep(row.store);
      setData(row.purchase_date);
      setKwota(String(row.amount));
      setKategoria(row.category ?? "");
      setTerminZwrotu(row.return_deadline ?? "");
    })();
  }, [id]);

  function zmienInternet(checked: boolean) {
    setPrzezInternet(checked);
    if (checked && data) setTerminZwrotu(dodajDni(data, 14));
  }

  async function zapisz(e: React.FormEvent) {
    e.preventDefault();
    setBlad(null);
    setZajety(true);
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) return;

    const wartosci = {
      user_id: user.id,
      product_name: produkt.trim(),
      store: sklep.trim(),
      purchase_date: data,
      amount: Number(kwota.replace(",", ".")) || 0,
      category: kategoria.trim() || null,
      return_deadline: terminZwrotu || null,
      complaint_deadline: dodajLata(data, 2),
    };

    const { error } = id
      ? await supabase.from("purchases").update(wartosci).eq("id", id)
      : await supabase.from("purchases").insert(wartosci);

    setZajety(false);
    if (error) {
      setBlad("Nie udało się zapisać zakupu. Spróbuj jeszcze raz.");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["zakupy"] });
    navigate({ to: "/zakupy" });
  }

  return (
    <main className="min-h-screen py-8">
      <div className="app-shell">
        <Link to="/zakupy" className="inline-flex items-center gap-2 text-muted-foreground">
          <ArrowLeft className="h-5 w-5" strokeWidth={2} />
          Wróć
        </Link>

        <h1 className="mt-6 text-3xl">{id ? "Edytuj zakup" : "Dodaj zakup"}</h1>

        <form onSubmit={zapisz} className="mt-4">
          <label htmlFor="produkt" className={etykieta}>
            Co kupiłeś?
          </label>
          <input
            id="produkt"
            required
            value={produkt}
            onChange={(e) => setProdukt(e.target.value)}
            placeholder="np. Czajnik elektryczny"
            className={pole}
          />

          <label htmlFor="sklep" className={etykieta}>
            Sklep
          </label>
          <input
            id="sklep"
            required
            value={sklep}
            onChange={(e) => setSklep(e.target.value)}
            placeholder="np. Media Markt"
            className={pole}
          />

          <label htmlFor="data" className={etykieta}>
            Data zakupu
          </label>
          <input
            id="data"
            type="date"
            required
            value={data}
            onChange={(e) => setData(e.target.value)}
            className={pole}
          />

          <label htmlFor="kwota" className={etykieta}>
            Kwota (zł)
          </label>
          <input
            id="kwota"
            inputMode="decimal"
            required
            value={kwota}
            onChange={(e) => setKwota(e.target.value)}
            placeholder="np. 199,00"
            className={pole}
          />

          <label htmlFor="kategoria" className={etykieta}>
            Kategoria (nieobowiązkowa)
          </label>
          <input
            id="kategoria"
            value={kategoria}
            onChange={(e) => setKategoria(e.target.value)}
            placeholder="np. Sprzęt AGD"
            className={pole}
          />

          <label className="mt-5 flex cursor-pointer items-center gap-3 rounded-2xl border border-border bg-card p-4">
            <input
              type="checkbox"
              checked={przezInternet}
              onChange={(e) => zmienInternet(e.target.checked)}
              className="h-6 w-6 accent-[var(--primary)]"
            />
            <span className="font-bold">Kupione przez internet</span>
          </label>

          <label htmlFor="zwrot" className={etykieta}>
            Termin zwrotu (nieobowiązkowy)
          </label>
          <input
            id="zwrot"
            type="date"
            value={terminZwrotu}
            onChange={(e) => setTerminZwrotu(e.target.value)}
            className={pole}
          />
          <p className="mt-2 text-muted-foreground">
            Termin zwrotu zależy od sklepu. Przy zakupach przez internet podpowiadamy 14 dni.
          </p>

          <p className="mt-4 rounded-2xl bg-primary-soft p-4 text-primary">
            Termin reklamacji liczymy automatycznie: 2 lata od daty zakupu.
          </p>

          {blad && <p className="mt-4 rounded-2xl bg-urgent-soft p-4 text-urgent">{blad}</p>}

          <button
            type="submit"
            disabled={zajety}
            className="mt-6 h-14 w-full rounded-2xl bg-primary px-6 text-lg font-bold text-primary-foreground disabled:opacity-60"
          >
            {zajety ? "Zapisywanie…" : "Zapisz"}
          </button>
        </form>
      </div>
    </main>
  );
}
