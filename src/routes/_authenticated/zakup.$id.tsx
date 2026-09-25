import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CalendarClock, Pencil, ShieldCheck, Trash2, Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  dniDo,
  formatData,
  formatKwota,
  miesiaceDo,
  odmianaDni,
  odmianaMiesiecy,
} from "@/lib/paragonik";

export const Route = createFileRoute("/_authenticated/zakup/$id")({
  head: () => ({
    meta: [
      { title: "Szczegóły zakupu — Paragonik" },
      { name: "description", content: "Dane zakupu, paragon i terminy zwrotu oraz reklamacji." },
      { property: "og:title", content: "Szczegóły zakupu — Paragonik" },
      { property: "og:description", content: "Dane zakupu i terminy." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Szczegoly,
});

function Szczegoly() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [paragonUrl, setParagonUrl] = useState<string | null>(null);

  const { data: zakup, isLoading } = useQuery({
    queryKey: ["zakup", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchases")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!zakup?.receipt_image_path) return;
    void (async () => {
      const { data } = await supabase.storage
        .from("receipts")
        .createSignedUrl(zakup.receipt_image_path as string, 3600);
      setParagonUrl(data?.signedUrl ?? null);
    })();
  }, [zakup?.receipt_image_path]);

  async function usun() {
    if (!window.confirm("Na pewno usunąć ten zakup?")) return;
    await supabase.from("purchases").delete().eq("id", id);
    await queryClient.invalidateQueries({ queryKey: ["zakupy"] });
    navigate({ to: "/zakupy" });
  }

  if (isLoading) {
    return (
      <main className="min-h-screen py-8">
        <div className="app-shell text-muted-foreground">Wczytywanie…</div>
      </main>
    );
  }

  if (!zakup) {
    return (
      <main className="min-h-screen py-8">
        <div className="app-shell">
          <p className="font-bold">Nie znaleźliśmy tego zakupu.</p>
          <Link to="/zakupy" className="mt-4 inline-block text-primary underline">
            Wróć do listy
          </Link>
        </div>
      </main>
    );
  }

  const dni = dniDo(zakup.return_deadline);
  const miesiace = miesiaceDo(zakup.complaint_deadline);

  return (
    <main className="min-h-screen py-8">
      <div className="app-shell">
        <Link to="/zakupy" className="inline-flex items-center gap-2 text-muted-foreground">
          <ArrowLeft className="h-5 w-5" strokeWidth={2} />
          Wróć
        </Link>

        <h1 className="mt-6 text-3xl">{zakup.product_name}</h1>
        <p className="mt-2 text-muted-foreground">
          {zakup.store} · {formatData(zakup.purchase_date)}
        </p>

        <div className="card-paper mt-6">
          <Wiersz etykieta="Kwota" wartosc={formatKwota(zakup.amount)} />
          <Wiersz etykieta="Kategoria" wartosc={zakup.category || "—"} />
          <Wiersz etykieta="Data zakupu" wartosc={formatData(zakup.purchase_date)} />
        </div>

        <div className="mt-4 space-y-3">
          <div
            className={`rounded-2xl p-4 ${
              dni !== null && dni >= 0 && dni <= 7
                ? "bg-urgent-soft text-urgent"
                : "bg-primary-soft text-primary"
            }`}
          >
            <p className="flex items-center gap-2 font-bold">
              <CalendarClock className="h-5 w-5" strokeWidth={2} />
              Zwrot
            </p>
            <p className="mt-1">
              {zakup.return_deadline
                ? dni !== null && dni >= 0
                  ? `Do ${formatData(zakup.return_deadline)} — zostało ${odmianaDni(dni)}`
                  : `Termin minął ${formatData(zakup.return_deadline)}`
                : "Nie ustawiono terminu zwrotu"}
            </p>
          </div>

          <div className="rounded-2xl bg-primary-soft p-4 text-primary">
            <p className="flex items-center gap-2 font-bold">
              <ShieldCheck className="h-5 w-5" strokeWidth={2} />
              Reklamacja
            </p>
            <p className="mt-1">
              {miesiace > 0
                ? `Do ${formatData(zakup.complaint_deadline)} — jeszcze ${odmianaMiesiecy(miesiace)}`
                : `Termin minął ${formatData(zakup.complaint_deadline)}`}
            </p>
          </div>
        </div>

        {paragonUrl && (
          <div className="mt-6">
            <p className="font-bold">Paragon</p>
            <img
              src={paragonUrl}
              alt={`Paragon za ${zakup.product_name}`}
              className="mt-2 w-full rounded-2xl border border-border"
            />
          </div>
        )}

        <button
          type="button"
          className="mt-8 flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-primary px-6 text-lg font-bold text-primary-foreground"
        >
          <Wrench className="h-6 w-6" strokeWidth={2} />
          Coś się zepsuło
        </button>

        <div className="mt-3 flex gap-3">
          <Link
            to="/dodaj"
            search={{ id: zakup.id }}
            className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl border border-border bg-card font-bold"
          >
            <Pencil className="h-5 w-5" strokeWidth={2} />
            Edytuj
          </Link>
          <button
            type="button"
            onClick={usun}
            className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl border border-border bg-card font-bold text-urgent"
          >
            <Trash2 className="h-5 w-5" strokeWidth={2} />
            Usuń
          </button>
        </div>
      </div>
    </main>
  );
}

function Wiersz({ etykieta, wartosc }: { etykieta: string; wartosc: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-border py-2.5 last:border-0 last:pb-0 first:pt-0">
      <span className="text-muted-foreground">{etykieta}</span>
      <span className="font-bold">{wartosc}</span>
    </div>
  );
}
