import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Camera, ChevronRight, LogOut, Search, ShieldCheck, TriangleAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  dniDo,
  formatData,
  formatKwota,
  miesiaceDo,
  odmianaDni,
  odmianaMiesiecy,
} from "@/lib/paragonik";
import { PrzyciskiSkanowania } from "@/components/PrzyciskiSkanowania";

export const Route = createFileRoute("/_authenticated/zakupy")({
  head: () => ({
    meta: [
      { title: "Twoje zakupy — Paragonik" },
      { name: "description", content: "Lista Twoich zakupów z terminami zwrotu i reklamacji." },
      { property: "og:title", content: "Twoje zakupy — Paragonik" },
      { property: "og:description", content: "Pilnuj terminów zwrotu i reklamacji." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Zakupy,
});

export type Zakup = {
  id: string;
  product_name: string;
  store: string;
  purchase_date: string;
  amount: number | string;
  category: string | null;
  receipt_image_path: string | null;
  return_deadline: string | null;
  complaint_deadline: string;
};

function Zakupy() {
  const navigate = useNavigate();
  const [szukaj, setSzukaj] = useState("");

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) return;
      const pref = localStorage.getItem("paragonik_przypomnienia");
      await supabase.from("profiles").upsert(
        {
          id: user.id,
          email: user.email ?? null,
          ...(pref !== null ? { email_reminders: pref === "1" } : {}),
        },
        { onConflict: "id" },
      );
      localStorage.removeItem("paragonik_przypomnienia");
    })();
  }, []);

  const { data: zakupy = [], isLoading } = useQuery({
    queryKey: ["zakupy"],
    queryFn: async (): Promise<Zakup[]> => {
      const { data, error } = await supabase
        .from("purchases")
        .select("*")
        .order("purchase_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Zakup[];
    },
  });

  const filtrowane = useMemo(() => {
    const q = szukaj.trim().toLowerCase();
    if (!q) return zakupy;
    return zakupy.filter(
      (z) =>
        z.product_name.toLowerCase().includes(q) || z.store.toLowerCase().includes(q),
    );
  }, [zakupy, szukaj]);

  const pilne = filtrowane.filter((z) => {
    const d = dniDo(z.return_deadline);
    return d !== null && d >= 0 && d <= 7;
  });
  const pozostale = filtrowane.filter((z) => !pilne.includes(z));

  const suma = zakupy.reduce((acc, z) => acc + Number(z.amount || 0), 0);

  async function wyloguj() {
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  return (
    <main className="min-h-screen pb-32 pt-8">
      <div className="app-shell">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-muted-foreground">Dzień dobry</p>
            <h1 className="mt-1 text-3xl">Twoje zakupy</h1>
          </div>
          <button
            type="button"
            onClick={wyloguj}
            aria-label="Wyloguj się"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border bg-card"
          >
            <LogOut className="h-5 w-5 text-muted-foreground" strokeWidth={2} />
          </button>
        </div>

        <div className="mt-6 rounded-2xl bg-primary p-5 text-primary-foreground">
          <p className="opacity-90">Pilnujesz zakupów wartych</p>
          <p className="mt-1 font-display text-3xl font-bold">{formatKwota(suma)}</p>
        </div>

        <div className="relative mt-6">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
            strokeWidth={2}
          />
          <input
            value={szukaj}
            onChange={(e) => setSzukaj(e.target.value)}
            placeholder="Szukaj produktu lub sklepu"
            aria-label="Szukaj produktu lub sklepu"
            className="h-14 w-full rounded-2xl border border-border bg-card pl-12 pr-4 text-lg outline-none focus:border-primary"
          />
        </div>

        {isLoading && <p className="mt-8 text-muted-foreground">Wczytywanie…</p>}

        {!isLoading && zakupy.length === 0 && (
          <div className="card-paper mt-8 text-center">
            <p className="font-bold">Nie masz jeszcze żadnych zakupów.</p>
            <p className="mt-2 text-muted-foreground">
              Dodaj pierwszy zakup, a my przypilnujemy terminów.
            </p>
          </div>
        )}

        {pilne.length > 0 && (
          <section className="mt-8">
            <h2 className="flex items-center gap-2 text-sm font-bold tracking-widest text-urgent">
              <TriangleAlert className="h-5 w-5" strokeWidth={2} />
              PILNE
            </h2>
            <ul className="mt-3 space-y-3">
              {pilne.map((z) => (
                <KartaZakupu key={z.id} zakup={z} pilny />
              ))}
            </ul>
          </section>
        )}

        {pozostale.length > 0 && (
          <section className="mt-8">
            <h2 className="flex items-center gap-2 text-sm font-bold tracking-widest text-primary">
              <ShieldCheck className="h-5 w-5" strokeWidth={2} />
              POD OCHRONĄ
            </h2>
            <ul className="mt-3 space-y-3">
              {pozostale.map((z) => (
                <KartaZakupu key={z.id} zakup={z} />
              ))}
            </ul>
          </section>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background/95 py-4 backdrop-blur">
        <div className="app-shell">
          <PrzyciskiSkanowania />
        </div>
      </div>
    </main>
  );
}

function KartaZakupu({ zakup, pilny = false }: { zakup: Zakup; pilny?: boolean }) {
  const dni = dniDo(zakup.return_deadline);
  const miesiace = miesiaceDo(zakup.complaint_deadline);
  const start = new Date(`${zakup.purchase_date}T00:00:00`).getTime();
  const koniec = new Date(`${zakup.complaint_deadline}T00:00:00`).getTime();
  const teraz = Date.now();
  const postep = Math.min(100, Math.max(0, ((teraz - start) / (koniec - start)) * 100));

  return (
    <li>
      <Link
        to="/zakup/$id"
        params={{ id: zakup.id }}
        className="card-paper flex items-center gap-3"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold">{zakup.product_name}</p>
          <p className="mt-0.5 text-muted-foreground">
            {zakup.store} · {formatData(zakup.purchase_date)} · {formatKwota(zakup.amount)}
          </p>

          {pilny && dni !== null ? (
            <p className="mt-3 inline-block rounded-xl bg-urgent-soft px-3 py-1.5 font-bold text-urgent">
              {dni === 0 ? "Dziś ostatni dzień na zwrot" : `Zostało ${odmianaDni(dni)} na zwrot`}
            </p>
          ) : (
            <div className="mt-3">
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary" style={{ width: `${postep}%` }} />
              </div>
              <p className="mt-2 text-muted-foreground">
                {miesiace > 0
                  ? `Reklamacja możliwa jeszcze ${odmianaMiesiecy(miesiace)}`
                  : "Czas na reklamację minął"}
              </p>
            </div>
          )}
        </div>
        <ChevronRight className="h-6 w-6 shrink-0 text-muted-foreground" strokeWidth={2} />
      </Link>
    </li>
  );
}
