import { supabase } from "@/integrations/supabase/client";

async function zmniejsz(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const max = 1600;
  const skala = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * skala);
  const h = Math.round(bitmap.height * skala);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob"))), "image/jpeg", 0.8),
  );
}

/** Zmniejsza zdjęcie i zapisuje je w buckecie receipts. Zwraca ścieżkę pliku. */
export async function przeslijParagon(file: File): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Brak użytkownika");
  const blob = await zmniejsz(file);
  const path = `${data.user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await supabase.storage
    .from("receipts")
    .upload(path, blob, { contentType: "image/jpeg" });
  if (error) throw error;
  return path;
}
