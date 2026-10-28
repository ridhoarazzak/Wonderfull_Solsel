export type Cat = "alam" | "budaya" | "airpanas" | "kuliner" | "penginapan" | "kesehatan";
export interface Place {
  id: string; n: string; c: Cat; r: number | null; z: number | null;
  la: number; lo: number; s: string; d: string | null; h: string | null; ph?: { f: string; c: string; l?: string }[];
}
export const CATS: Record<Cat, string> = { alam: "Alam & Taman", budaya: "Ikon & Budaya", airpanas: "Air Panas", kuliner: "Kuliner", penginapan: "Menginap", kesehatan: "Kesehatan" };
export const TABS = { wisata: "Wisata", alam: "Alam", budaya: "Ikon", airpanas: "Air Panas", kuliner: "Kuliner", penginapan: "Menginap", kesehatan: "Kesehatan" } as const;
export type Tab = keyof typeof TABS;
export const WISATA: Cat[] = ["alam", "budaya", "airpanas"];

/** Tingkat keramaian zona (skor_zona = seberapa ramai dikunjungi warga dan orang lalu lalang). */
export const level = (z: number) => (z >= 8 ? "Sangat ramai" : z >= 7 ? "Ramai" : z >= 6 ? "Cukup ramai" : "Lebih tenang");

export function km(a: Place, b: Place) {
  const t = Math.PI / 180, dl = (b.la - a.la) * t, dn = (b.lo - a.lo) * t;
  const x = Math.sin(dl / 2) ** 2 + Math.cos(a.la * t) * Math.cos(b.la * t) * Math.sin(dn / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(x));
}
export const fmtKm = (v: number) => v.toFixed(1).replace(".", ",") + " km";
export const near = (all: Place[], p: Place, c: Cat, n: number, f: (x: Place) => boolean = () => true) =>
  all.filter((x) => x.c === c && x.id !== p.id && f(x)).map((x) => [x, km(p, x)] as const).sort((a, b) => a[1] - b[1]).slice(0, n);
export const mapsUrl = (p: Place) => `https://www.google.com/maps/search/?api=1&query=${p.la},${p.lo}`;
