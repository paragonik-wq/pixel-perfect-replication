import { createFileRoute, Link } from "@tanstack/react-router";
import { ReceiptText, ShieldCheck, BellRing, CalendarClock } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Paragonik — pilnuj terminów zwrotu i reklamacji" },
      {
        name: "description",
        content:
          "Zrób zdjęcie paragonu, a Paragonik przypomni Ci o terminie zwrotu i reklamacji. 3 skany gratis.",
      },
      { property: "og:title", content: "Paragonik — pilnuj terminów zwrotu i reklamacji" },
      {
        property: "og:description",
        content: "Nie trać pieniędzy przez zgubiony paragon. Zacznij za darmo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Strona,
});

const zalety = [
  {
    icon: ReceiptText,
    title: "Paragon zawsze pod ręką",
    text: "Zdjęcie paragonu zostaje w aplikacji, nawet gdy papier wyblaknie.",
  },
  {
    icon: CalendarClock,
    title: "Terminy liczone za Ciebie",
    text: "Wiesz, ile dni zostało na zwrot i ile miesięcy na reklamację.",
  },
  {
    icon: BellRing,
    title: "Przypomnienie w porę",
    text: "Pilne zakupy widzisz na samej górze listy.",
  },
];

function Strona() {
  return (
    <main className="min-h-screen py-10">
      <div className="app-shell">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary">
            <ReceiptText className="h-6 w-6 text-primary-foreground" strokeWidth={2} />
          </span>
          <span className="font-display text-2xl font-bold">Paragonik</span>
        </div>

        <h1 className="mt-10 text-4xl">Nie trać pieniędzy przez zgubiony paragon.</h1>
        <p className="mt-4 text-muted-foreground">
          Zrób zdjęcie paragonu po zakupach. Paragonik zapamięta, co kupiłeś i przypilnuje terminu
          zwrotu oraz reklamacji.
        </p>

        <ul className="mt-8 space-y-4">
          {zalety.map((z) => (
            <li key={z.title} className="card-paper flex gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-soft">
                <z.icon className="h-6 w-6 text-primary" strokeWidth={2} />
              </span>
              <div>
                <p className="font-bold">{z.title}</p>
                <p className="mt-1 text-muted-foreground">{z.text}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-10">
          <Link
            to="/logowanie"
            className="flex h-14 w-full items-center justify-center rounded-2xl bg-primary px-6 text-lg font-bold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Zacznij za darmo
          </Link>
          <p className="mt-3 flex items-center justify-center gap-2 text-center text-muted-foreground">
            <ShieldCheck className="h-5 w-5" strokeWidth={2} />3 skany gratis · bez podawania karty
          </p>
        </div>
      </div>
    </main>
  );
}
