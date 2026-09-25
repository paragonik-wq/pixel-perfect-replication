import { useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Camera, Image as ImageIcon, PencilLine } from "lucide-react";
import { przeslijParagon } from "@/lib/receipt-upload";

export function PrzyciskiSkanowania({ kompakt = false }: { kompakt?: boolean }) {
  const aparat = useRef<HTMLInputElement>(null);
  const galeria = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const [zajety, setZajety] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);

  async function wybrano(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBlad(null);
    setZajety(true);
    try {
      const path = await przeslijParagon(file);
      navigate({ to: "/skanuj", search: { path } });
    } catch {
      setBlad("Nie udało się wysłać zdjęcia. Spróbuj jeszcze raz.");
    } finally {
      setZajety(false);
    }
  }

  return (
    <div>
      <input ref={aparat} type="file" accept="image/*" capture="environment" hidden onChange={wybrano} />
      <input ref={galeria} type="file" accept="image/*" hidden onChange={wybrano} />
      {blad && <p className="mb-3 rounded-2xl bg-urgent-soft p-3 text-urgent">{blad}</p>}
      <button
        type="button"
        disabled={zajety}
        onClick={() => aparat.current?.click()}
        className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-primary px-6 text-lg font-bold text-primary-foreground disabled:opacity-60"
      >
        <Camera className="h-6 w-6" strokeWidth={2} />
        {zajety ? "Wysyłam zdjęcie…" : kompakt ? "Spróbuj ponownie" : "Zeskanuj paragon"}
      </button>
      <div className="mt-2 flex items-center justify-between gap-2">
        <button
          type="button"
          disabled={zajety}
          onClick={() => galeria.current?.click()}
          className="flex min-h-12 items-center gap-2 px-2 font-bold text-primary underline-offset-4 hover:underline"
        >
          <ImageIcon className="h-5 w-5" strokeWidth={2} />
          Wybierz zdjęcie z galerii
        </button>
        <Link
          to="/dodaj"
          className="flex min-h-12 items-center gap-2 px-2 font-bold text-muted-foreground underline-offset-4 hover:underline"
        >
          <PencilLine className="h-5 w-5" strokeWidth={2} />
          Wpisz ręcznie
        </Link>
      </div>
    </div>
  );
}
