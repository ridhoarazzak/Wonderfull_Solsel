// Ambil foto dari Wikimedia Commons (gratis, tanpa API key) -> public/images + data/photos.json
// Foto dicari berdasarkan koordinat tempat (radius 500 m), lalu hanya dipakai jika judul filenya
// memuat kata khas dari nama tempat, supaya tidak salah tempat. Pembuat dan lisensi disimpan untuk atribusi.
// Jalan lewat GitHub Actions (workflow "Ambil foto") atau: node scripts/fetch-photos.mjs
import fs from "node:fs";
const API = "https://commons.wikimedia.org/w/api.php";
const UA = "PojokSolsel/1.0 (https://github.com/ridhoarazzak/nextjs-boilerplate)";
const CATS = (process.env.PHOTO_CATS || "alam,budaya,airpanas,penginapan").split(",").map((s) => s.trim());
const FORCE = process.env.FORCE === "1";
const GENERIC = new Set(["air", "terjun", "wisata", "kawasan", "hot", "puncak", "taman", "solok", "selatan", "nagari", "waterboom", "ruang", "terbuka", "hijau", "state", "parks", "wisma", "hotel", "homestay", "losmen", "penginapan", "guest", "house", "pondok", "kontrakan", "pusat", "informasi", "simpang"]);
const toks = (s) => s.toLowerCase().replace(/^file:/, "").replace(/\.[a-z0-9]+$/, "").split(/[^a-z0-9]+/).filter((w) => w.length > 3 && !GENERIC.has(w));
const strip = (h) => (h || "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function nearby(p) {
  const u = new URL(API);
  Object.entries({ action: "query", format: "json", generator: "geosearch", ggscoord: `${p.la}|${p.lo}`, ggsradius: "500", ggsnamespace: "6", ggslimit: "30",
    prop: "imageinfo", iiprop: "url|size|mime|extmetadata", iiurlwidth: "800" }).forEach(([k, v]) => u.searchParams.set(k, v));
  const r = await fetch(u, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return Object.values((await r.json()).query?.pages ?? {}).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
}

const data = JSON.parse(fs.readFileSync("data/places.json", "utf8"));
const out = fs.existsSync("data/photos.json") ? JSON.parse(fs.readFileSync("data/photos.json", "utf8")) : {};
fs.mkdirSync("public/images", { recursive: true });
let ok = 0, none = 0;
for (const p of data.places.filter((x) => CATS.includes(x.c) && (FORCE || !(x.id in out)))) {
  try {
    const want = toks(p.n);
    const hits = want.length ? (await nearby(p)).filter((pg) => {
      const ii = pg.imageinfo?.[0];
      return ii && ii.mime === "image/jpeg" && ii.width >= 800 && toks(pg.title).some((t) => want.includes(t));
    }).slice(0, 2) : [];
    const list = [];
    for (const [i, pg] of hits.entries()) {
      const ii = pg.imageinfo[0], m = ii.extmetadata ?? {};
      const img = await fetch(ii.thumburl, { headers: { "User-Agent": UA } });
      if (!img.ok) continue;
      const file = `${p.id}-${i + 1}.jpg`;
      fs.writeFileSync(`public/images/${file}`, Buffer.from(await img.arrayBuffer()));
      const lic = strip(m.LicenseShortName?.value);
      list.push({ f: `/images/${file}`, c: [strip(m.Artist?.value) || "Wikimedia Commons", lic].filter(Boolean).join(" · "), l: ii.descriptionurl });
      await sleep(300);
    }
    out[p.id] = list; list.length ? ok++ : none++;
    console.log(`${list.length ? "ok" : "-"} ${p.n}: ${list.length} foto`);
  } catch (e) { console.error(`[!] ${p.n}: ${e.message}`); }
  fs.writeFileSync("data/photos.json", JSON.stringify(out, null, 1));
  await sleep(300);
}
fs.writeFileSync("data/photos.json", JSON.stringify(out, null, 1));
console.log(`Selesai. Dengan foto: ${ok}, tanpa foto: ${none}`);
