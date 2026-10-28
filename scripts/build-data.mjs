// Usage: node scripts/build-data.mjs
// Baca data/raw/*.csv + data/overrides.json -> data/places.json, dengan pemeriksaan agar tidak salah.
import fs from "node:fs";
const R = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const BBOX = { latMin: -1.75, latMax: -1.19, lonMin: 100.8, lonMax: 101.7 }; // kira-kira wilayah Solok Selatan
const errors = [], warns = [], dropped = [];

function csv(text) {
  const rows = []; let row = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cur); cur = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cur); cur = ""; if (row.some(Boolean)) rows.push(row); row = []; }
    else cur += ch;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  const head = rows.shift().map((h) => h.trim());
  return rows.map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? "").trim()])));
}
function load(file, need) {
  const rows = csv(R(`data/raw/${file}`));
  const miss = need.filter((k) => !(k in (rows[0] ?? {})));
  if (miss.length) errors.push(`${file}: kolom hilang: ${miss.join(", ")}`);
  return rows;
}
const num = (v) => (v === "" || isNaN(+v) ? null : +v);
const rate = (v, f) => { const n = num(v); if (n === null || n === 0) return null; if (n < 0 || n > 5) warns.push(`${f}: rating tidak wajar (${v})`); return n; };
const r5 = (n) => Math.round(n * 1e5) / 1e5;
const inside = (la, lo) => la >= BBOX.latMin && la <= BBOX.latMax && lo >= BBOX.lonMin && lo <= BBOX.lonMax;
const ov = JSON.parse(R("data/overrides.json"));
const places = [], names = new Set();
function add(file, x) {
  if (!x.n) { warns.push(`${file}: baris tanpa nama dilewati`); return; }
  if (ov.drop.includes(x.n)) { dropped.push(`${x.n} (daftar drop)`); return; }
  const key = x.n.toLowerCase();
  if (names.has(key)) { dropped.push(`${x.n} (nama ganda)`); return; }
  if (x.la === null || x.lo === null) { errors.push(`${file}: "${x.n}" koordinat tidak valid`); return; }
  if (!inside(x.la, x.lo)) { dropped.push(`${x.n} (di luar Solok Selatan)`); return; }
  names.add(key);
  places.push({ id: `${key.replace(/[^a-z0-9]+/g, "-")}-${r5(x.la)}`, n: x.n, c: x.c, r: x.r ?? null, z: x.z ?? null, la: r5(x.la), lo: r5(x.lo), s: x.s, d: null, h: null, ph: [] });
}
const wcat = (n) => { const s = n.toLowerCase();
  if (/hot waterboom|air panas/.test(s)) return "airpanas";
  if (/rumah gadang|menara|jembatan|gapura|monumen|simpang/.test(s)) return "budaya";
  return "alam"; };

for (const r of load("wisata.csv", ["nama", "lat", "lon", "skor_zona"])) {
  const z = num(r.skor_zona); if (z === null || z < 0 || z > 10) warns.push(`wisata: skor_zona aneh untuk "${r.nama}" (${r.skor_zona})`);
  add("wisata", { n: r.nama, c: wcat(r.nama), z, la: num(r.lat), lo: num(r.lon), s: "Wisata" });
}
for (const r of load("penginapan.csv", ["nama", "lat", "lon", "rating"]))
  add("penginapan", { n: r.nama, c: "penginapan", r: rate(r.rating, "penginapan"), la: num(r.lat), lo: num(r.lon), s: "Penginapan" });
const SUB = { "Coffee shop": "Kedai kopi", Cafe: "Kafe", Restaurant: "Restoran", "Coffee store": "Toko kopi", "Coffee roastery": "Roastery kopi", "Ice cream shop": "Kedai es krim", "Brunch restaurant": "Restoran" };
for (const r of load("kuliner.csv", ["nama", "kategori", "lat", "lon", "rating"])) {
  if (["Barber shop", "Grocery store", "Hotel", "Coffee wholesaler"].includes(r.kategori) || /billiard|mini ?market/i.test(r.nama)) { dropped.push(`${r.nama} (bukan kuliner)`); continue; }
  add("kuliner", { n: r.nama, c: "kuliner", r: rate(r.rating, "kuliner"), la: num(r.lat), lo: num(r.lon), s: SUB[r.kategori] ?? r.kategori });
}
for (const r of load("aktivitas_warga.csv", ["nama", "kategori", "kategori_scrape", "lat", "lon", "rating"])) {
  if (r.kategori_scrape !== "kesehatan") continue; // sekolah tidak dipakai
  if (["Consultant", "Unknown"].includes(r.kategori) || (/motor|bengkel/i.test(r.nama) || (/pasar/i.test(r.nama) && !/pustu|puskesmas|klinik|rumah sakit/i.test(r.nama)))) { dropped.push(`${r.nama} (bukan layanan kesehatan)`); continue; }
  const s = /hospital/i.test(r.kategori) ? "Rumah sakit" : /puskesmas|pustu/i.test(r.nama) ? "Puskesmas" : "Klinik / praktik";
  add("kesehatan", { n: r.nama, c: "kesehatan", r: rate(r.rating, "kesehatan"), la: num(r.lat), lo: num(r.lon), s });
}
for (const e of ov.extras) add("extras", e);
for (const [name, o] of Object.entries(ov.byName)) {
  const p = places.find((x) => x.n === name);
  if (!p) { warns.push(`overrides: "${name}" tidak ditemukan di data (salah ketik?)`); continue; }
  Object.assign(p, o);
}
const photos = fs.existsSync(new URL("../data/photos.json", import.meta.url)) ? JSON.parse(R("data/photos.json")) : {};
for (const p of places) p.ph = photos[p.id] ?? [];
places.sort((a, b) => (b.z ?? 0) - (a.z ?? 0) || (b.r ?? 0) - (a.r ?? 0) || a.n.localeCompare(b.n));
const by = {}; places.forEach((p) => (by[p.c] = (by[p.c] ?? 0) + 1));
console.log("Jumlah per kategori:", by, "\nDibuang:", dropped.length);
dropped.forEach((d) => console.log("  - " + d));
warns.forEach((w) => console.warn("PERINGATAN:", w));
if (errors.length) { errors.forEach((e) => console.error("ERROR:", e)); process.exit(1); }
fs.writeFileSync(new URL("../data/places.json", import.meta.url), JSON.stringify({ generated: new Date().toISOString().slice(0, 10), places }, null, 0));
console.log(`OK: ${places.length} tempat -> data/places.json`);
