import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Lock, MailCheck, ReceiptText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/logowanie")({
  head: () => ({
    meta: [
      { title: "Logowanie — Paragonik" },
      { name: "description", content: "Zaloguj się do Paragonika linkiem wysłanym na e-mail." },
      { property: "og:title", content: "Logowanie — Paragonik" },
      { property: "og:description", content: "Logowanie bez hasła — wystarczy e-mail." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Logowanie,
});

function Logowanie() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [przypomnienia, setPrzypomnienia] = useState(true);
  const [stan, setStan] = useState<"formularz" | "wyslano">("formularz");
  const [blad, setBlad] = useState<string | null>(null);
  const [zajety, setZajety] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/zakupy", replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        navigate({ to: "/zakupy", replace: true });
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  async function wyslij(e: React.FormEvent) {
    e.preventDefault();
    setBlad(null);
    setZajety(true);
    localStorage.setItem("paragonik_przypomnienia", przypomnienia ? "1" : "0");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/zakupy` },
    });
    setZajety(false);
    if (error) {
      setBlad("Nie udało się wysłać linku. Sprawdź adres e-mail i spróbuj ponownie.");
      return;
    }
    setStan("wyslano");
  }

  return (
    <main className="min-h-screen py-8">
      <div className="app-shell">
        <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground">
          <ArrowLeft className="h-5 w-5" strokeWidth={2} />
          Wróć
        </Link>

        <div className="mt-6 flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary">
            <ReceiptText className="h-6 w-6 text-primary-foreground" strokeWidth={2} />
          </span>
          <span className="font-display text-2xl font-bold">Paragonik</span>
        </div>

        {stan === "wyslano" ? (
          <div className="card-paper mt-8 text-center">
            <MailCheck className="mx-auto h-12 w-12 text-primary" strokeWidth={2} />
            <h1 className="mt-4 text-2xl">Sprawdź skrzynkę</h1>
            <p className="mt-3 text-muted-foreground">
              Wysłaliśmy link do logowania na adres <span className="font-bold">{email}</span>.
              Kliknij go na tym urządzeniu, żeby wejść do aplikacji.
            </p>
            <button
              type="button"
              onClick={() => setStan("formularz")}
              className="mt-6 h-14 w-full rounded-2xl border border-border bg-card px-6 font-bold"
            >
              Wpisz inny adres
            </button>
          </div>
        ) : (
          <form onSubmit={wyslij} className="mt-8">
            <h1 className="text-3xl">Zaloguj się</h1>
            <p className="mt-3 text-muted-foreground">
              Bez hasła. Wyślemy Ci link na e-mail — wystarczy w niego kliknąć.
            </p>

            <label htmlFor="email" className="mt-8 block font-bold">
              Twój adres e-mail
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jan.kowalski@poczta.pl"
              className="mt-2 h-14 w-full rounded-2xl border border-border bg-card px-4 text-lg outline-none focus:border-primary"
            />

            <label className="mt-5 flex cursor-pointer items-center gap-3 rounded-2xl border border-border bg-card p-4">
              <input
                type="checkbox"
                checked={przypomnienia}
                onChange={(e) => setPrzypomnienia(e.target.checked)}
                className="h-6 w-6 accent-[var(--primary)]"
              />
              <span className="font-bold">Przypominaj mi też mailem</span>
            </label>

            <p className="mt-5 flex gap-3 rounded-2xl bg-primary-soft p-4 text-primary">
              <Lock className="h-5 w-5 shrink-0" strokeWidth={2} />
              <span>Nie prosimy o dane karty, konta bankowego ani PESEL.</span>
            </p>

            {blad && <p className="mt-4 rounded-2xl bg-urgent-soft p-4 text-urgent">{blad}</p>}

            <button
              type="submit"
              disabled={zajety}
              className="mt-6 h-14 w-full rounded-2xl bg-primary px-6 text-lg font-bold text-primary-foreground disabled:opacity-60"
            >
              {zajety ? "Wysyłanie…" : "Wyślij link"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
