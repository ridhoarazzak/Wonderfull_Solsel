"use client";
import { useEffect, useMemo, useState, type PointerEvent } from "react";
import { TABS, WISATA, type Place, type Tab, level, near, fmtKm, mapsUrl } from "@/lib/places";
import { Sprite, Illustration } from "./Sprite";
import { Map3D } from "./Map3D";

const STEP = 24;
const NAV: [Tab, string][] = [["wisata", "Beranda"], ["peta", "Peta 3D"], ["kuliner", "Kuliner"], ["penginapan", "Menginap"], ["kesehatan", "Kesehatan"]];
const Ico = ({ c }: { c: string }) => <svg viewBox="0 0 64 64"><use href={`#i-${c}`} /></svg>;
const Score = ({ p }: { p: Place }) => (
  <>
    {p.r ? <><span className="star">★</span> {p.r}</> : null}
    {p.r && p.z ? " · " : null}
    {p.z ? level(p.z) : p.r ? null : p.s}
  </>
);

export function Explorer({ places, generated }: { places: Place[]; generated: string }) {
  const [tab, setTab] = useState<Tab>("wisata");
  const [mood, setMood] = useState<"all" | "ramai" | "tenang">("all");
  const [sel, setSel] = useState<string | null>(null);
  const [favOnly, setFavOnly] = useState(false);
  const [lim, setLim] = useState(STEP);
  const [q, setQ] = useState("");
  const [favs, setFavs] = useState<string[]>([]);

  useEffect(() => { try { setFavs(JSON.parse(localStorage.getItem("solsel-fav3") || "[]")); } catch {} }, []);
  const toggleFav = (id: string) => setFavs((f) => {
    const n = f.includes(id) ? f.filter((x) => x !== id) : [...f, id];
    try { localStorage.setItem("solsel-fav3", JSON.stringify(n)); } catch {}
    return n;
  });
  const tilt = (e: PointerEvent<HTMLButtonElement>) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--ry", `${((e.clientX - r.left) / r.width - 0.5) * 26}deg`);
    e.currentTarget.style.setProperty("--rx", `${-((e.clientY - r.top) / r.height - 0.5) * 26}deg`);
  };
  const untilt = (e: PointerEvent<HTMLButtonElement>) => { e.currentTarget.style.setProperty("--rx", "0deg"); e.currentTarget.style.setProperty("--ry", "0deg"); };
  const go = (t: Tab) => { setTab(t); setFavOnly(false); setSel(null); setLim(STEP); };

  const list = useMemo(() => places
    .filter((p) => (favOnly ? favs.includes(p.id) : tab === "wisata" ? WISATA.includes(p.c) : p.c === tab))
    .filter((p) => !q || p.n.toLowerCase().includes(q))
    .filter((p) => favOnly || tab !== "wisata" || mood === "all" || (mood === "ramai" ? (p.z ?? 0) >= 7 : (p.z ?? 0) < 7)),
  [places, tab, favOnly, favs, q, mood]);

  const p = sel ? places.find((x) => x.id === sel) ?? null : null;
  const title = p ? p.n.split(" ").slice(0, 2).join(" ") : favOnly ? "Favoritku" : tab === "wisata" ? "Jelajah Solsel" : TABS[tab];
  const groups = p ? ([["Menginap terdekat", "penginapan", 3, () => true], ["Ngopi & makan terdekat", "kuliner", 3, (x: Place) => (x.r ?? 0) >= 4.3], ["Layanan kesehatan terdekat", "kesehatan", 1, () => true]] as const).filter((g) => g[1] !== p.c) : [];

  return (
    <>
      <Sprite />
      <header>
        <div className="logo"><svg width="30" height="30" viewBox="0 0 64 64"><use href="#i-budaya" /></svg><div>Pojok Solsel<small>WISATA &amp; CERITA KECIL</small></div></div>
        <nav>{NAV.map(([k, l]) => <button key={k} aria-current={!favOnly && tab === k} onClick={() => go(k)}>{l}</button>)}</nav>
        <div className="pill">
          <span><b>{places.length}</b> tempat</span>
          <button aria-label="Lihat favorit" onClick={() => { setFavOnly(!favOnly); setSel(null); }}>♥ {favs.length}</button>
          <button aria-label="Ganti tema" onClick={() => { const d = document.documentElement; d.dataset.theme = getComputedStyle(d).getPropertyValue("--bg").trim() === "#241A14" ? "light" : "dark"; }}>◐</button>
        </div>
      </header>

      <main>
        <section className="left">
          <div>
            <div className="back" style={{ visibility: p ? "visible" : "hidden", cursor: "pointer" }} onClick={() => setSel(null)}>Kembali ke daftar</div>
            <h1>{title}</h1>
          </div>
          <Illustration />
        </section>

        <section className="panel" aria-live="polite">
          <div className="tabs">{(Object.keys(TABS) as Tab[]).map((k) => <button key={k} className="tab" aria-pressed={!favOnly && k === tab} onClick={() => go(k)}>{TABS[k]}</button>)}</div>

          {!p && tab !== "peta" && <input className="srch" type="search" placeholder="Cari nama tempat…" aria-label="Cari nama tempat" onChange={(e) => { setQ(e.target.value.trim().toLowerCase()); setLim(STEP); }} />}
          {!p && tab === "wisata" && !favOnly && (
            <div className="tabs">
              <span style={{ alignSelf: "center", color: "var(--mute)", fontSize: ".8rem" }}>Keramaian zona:</span>
              {([["all", "Semua"], ["ramai", "Ramai"], ["tenang", "Lebih tenang"]] as const).map(([k, l]) => <button key={k} className="tab" aria-pressed={mood === k} onClick={() => { setMood(k); setLim(STEP); }}>{l}</button>)}
            </div>
          )}

          {p ? (
            <div className="detail">
              {p.ph?.length ? <div className="gal">{p.ph.map((f) => <img key={f.f} src={f.f} alt={p.n} loading="lazy" />)}</div> : null}
              <h2>{p.n}</h2>
              <div className="m">{p.r ? <><span className="star">★ {p.r}</span> · </> : null}{p.s}{p.nag ? ` · Nagari ${p.nag}${p.kec ? `, Kec. ${p.kec}` : ""}` : ""}{p.z ? ` · ${level(p.z)} (skor ${p.z})` : ""}</div>
              <p>{p.d ?? "Info lengkap belum tersedia di data. Buka Google Maps untuk foto dan ulasan terbaru."}</p>
              {p.h && <p className="m">Jam: {p.h}</p>}
              {p.ph?.length ? <p className="m" style={{ fontSize: ".72rem" }}>Foto: {p.ph.map((f, k) => <span key={f.f}>{k ? "; " : ""}<a href={f.l} target="_blank" rel="noopener noreferrer">{f.c}</a></span>)} (Wikimedia Commons)</p> : null}
              <a className="btn" href={mapsUrl(p)} target="_blank" rel="noopener noreferrer">Buka di Google Maps</a>
              <button className="btn o" onClick={() => toggleFav(p.id)}>{favs.includes(p.id) ? "♥ Tersimpan" : "♡ Simpan"}</button>
              <button className="btn o" onClick={() => setSel(null)}>Kembali</button>
              <div className="near">
                {groups.map(([label, c, n, f]) => {
                  const L = near(places, p, c, n, f);
                  return L.length ? <div key={c}><h3>{label}</h3>{L.map(([x, d]) => <button key={x.id} className="nb" onClick={() => { setSel(x.id); window.scrollTo({ top: 0, behavior: "smooth" }); }}>{x.n}<span>{fmtKm(d)}</span></button>)}</div> : null;
                })}
              </div>
            </div>
          ) : tab === "peta" && !favOnly ? (
            <Map3D places={places} onSelect={(id) => { setSel(id); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
          ) : list.length ? (
            <>
              <div className="items">
                {list.slice(0, lim).map((x, i) => (
                  <button key={x.id} className="it" style={{ animationDelay: `${(i % 12) * 45}ms` }} onPointerMove={tilt} onPointerLeave={untilt} onClick={() => { setSel(x.id); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                    <div className="disc">{x.ph?.[0] ? <img src={x.ph[0].f} alt={x.n} loading="lazy" /> : <Ico c={x.c} />}</div><b>{x.n}</b><span><Score p={x} /></span>
                  </button>
                ))}
              </div>
              {list.length > lim && <button className="btn o more" onClick={() => setLim(lim + STEP)}>Tampilkan lebih banyak ({list.length - lim})</button>}
            </>
          ) : <p className="m" style={{ color: "var(--mute)" }}>{favOnly ? "Belum ada favorit. Buka sebuah tempat lalu tekan Simpan." : "Tidak ada tempat yang cocok. Coba kata kunci lain."}</p>}
        </section>
      </main>

      <footer>Keramaian zona = seberapa ramai kawasan itu dikunjungi penduduk dan orang yang lalu lalang (skor lebih tinggi = lebih ramai). Sumber: data aset wisata, penginapan, kuliner, dan fasilitas kesehatan (koordinat dari Google Maps), diperbarui {generated}. Rating dan jam buka dapat berubah; cek tautan Maps sebelum berangkat.</footer>
      <div className="dock"><div className="logo" style={{ fontSize: "1.3rem" }}><svg width="24" height="24" viewBox="0 0 64 64"><use href="#i-budaya" /></svg>Solsel</div><em>Teh, rumah gadang, dan udara sejuk.</em><small>Sumatera Barat</small></div>
    </>
  );
         }
    
