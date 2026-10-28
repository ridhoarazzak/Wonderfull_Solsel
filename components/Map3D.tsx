"use client";
import { useEffect, useRef, useState } from "react";
import { WISATA, type Place } from "../lib/places";

/* Peta 3D memakai MapLibre GL (dimuat dari CDN saat tombol ditekan, jadi tidak menambah dependensi npm).
   Medan 3D: AWS Terrain Tiles (terrarium). Peta dasar: OpenStreetMap. Batas nagari: public/nagari.geojson. */
const VER = "4.7.1";
const CDN = `https://cdn.jsdelivr.net/npm/maplibre-gl@${VER}/dist`;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

function loadMapLibre(): Promise<any> {
  const w = window as any;
  if (w.maplibregl) return Promise.resolve(w.maplibregl);
  return new Promise((res, rej) => {
    if (!document.getElementById("ml-css")) {
      const l = document.createElement("link");
      l.id = "ml-css"; l.rel = "stylesheet"; l.href = `${CDN}/maplibre-gl.css`;
      document.head.appendChild(l);
    }
    const s = document.createElement("script");
    s.src = `${CDN}/maplibre-gl.js`;
    s.onload = () => res((window as any).maplibregl);
    s.onerror = () => rej(new Error("Pustaka peta gagal dimuat. Periksa koneksi internet."));
    document.head.appendChild(s);
  });
}

type Ring = number[][];
const hit = (x: number, y: number, ring: Ring) => {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};
const polysOf = (f: any): Ring[] => (f.geometry.type === "Polygon" ? [f.geometry.coordinates[0]] : f.geometry.coordinates.map((p: Ring[]) => p[0]));

export function Map3D({ places, onSelect }: { places: Place[]; onSelect: (id: string) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [started, setStarted] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [is3d, setIs3d] = useState(true);
  const sel = useRef(onSelect);
  sel.current = onSelect;

  useEffect(() => {
    if (!started) return;
    let dead = false;
    setLoading(true);
    (async () => {
      try {
        const [ml, geo] = await Promise.all([loadMapLibre(), fetch("/nagari.geojson").then((r) => { if (!r.ok) throw new Error("nagari.geojson tidak ditemukan di folder public"); return r.json(); })]);
        if (dead || !box.current) return;

        // hitung jumlah tempat per nagari
        const cnt = (f: any, cats: string[]) => places.filter((p) => cats.includes(p.c) && polysOf(f).some((r) => hit(p.lo, p.la, r))).length;
        let xs: number[] = [], ys: number[] = [];
        for (const f of geo.features) {
          f.properties.w = cnt(f, WISATA);
          f.properties.k = cnt(f, ["kuliner"]);
          f.properties.p = cnt(f, ["penginapan"]);
          for (const r of polysOf(f)) for (const [x, y] of r) { xs.push(x); ys.push(y); }
        }
        const b: [[number, number], [number, number]] = [[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]];

        const map = new ml.Map({
          container: box.current,
          style: { version: 8, sources: { osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, maxzoom: 19, attribution: "© OpenStreetMap contributors" } }, layers: [{ id: "osm", type: "raster", source: "osm" }] },
          bounds: b, fitBoundsOptions: { padding: 24, pitch: 58, bearing: -14 }, pitch: 58, bearing: -14, maxPitch: 80,
        });
        mapRef.current = map;
        map.addControl(new ml.NavigationControl({ visualizePitch: true }), "top-right");
        map.addControl(new ml.AttributionControl({ compact: true, customAttribution: "Medan: AWS Terrain Tiles" }));

        map.on("load", () => {
          const dem = { type: "raster-dem", tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"], encoding: "terrarium", tileSize: 256, maxzoom: 14 };
          map.addSource("dem", dem);
          map.addSource("dem-hs", dem);
          map.setTerrain({ source: "dem", exaggeration: 1.6 });
          map.addLayer({ id: "hill", type: "hillshade", source: "dem-hs", paint: { "hillshade-exaggeration": 0.45, "hillshade-shadow-color": "#473B24" } });
          map.addSource("nagari", { type: "geojson", data: geo });
          map.addLayer({ id: "nagari-fill", type: "fill", source: "nagari", paint: { "fill-color": ["interpolate", ["linear"], ["get", "w"], 0, "#EBDDBB", 1, "#E9B86A", 3, "#C8742A", 6, "#B3322A"], "fill-opacity": 0.42 } });
          map.addLayer({ id: "nagari-line", type: "line", source: "nagari", paint: { "line-color": "#7A2219", "line-width": 1.3, "line-opacity": 0.85 } });

          map.on("click", "nagari-fill", (e: any) => {
            const p = e.features?.[0]?.properties; if (!p) return;
            new ml.Popup({ closeButton: false }).setLngLat(e.lngLat)
              .setHTML(`<b>${esc(String(p.n))}</b><br><small>Kec. ${esc(String(p.kec))}</small><br><small>${p.w} wisata · ${p.k} kuliner · ${p.p} penginapan</small>`).addTo(map);
          });
          map.on("mouseenter", "nagari-fill", () => (map.getCanvas().style.cursor = "pointer"));
          map.on("mouseleave", "nagari-fill", () => (map.getCanvas().style.cursor = ""));

          // pin wisata
          for (const p of places.filter((x) => WISATA.includes(x.c))) {
            const el = document.createElement("button");
            el.className = "pin-wrap"; el.setAttribute("aria-label", p.n); el.title = p.n;
            el.innerHTML = '<span class="pin"></span>';
            el.onclick = (ev) => { ev.stopPropagation(); sel.current(p.id); };
            new ml.Marker({ element: el, anchor: "bottom" }).setLngLat([p.lo, p.la]).addTo(map);
          }
          // label nagari (muncul saat zoom dekat)
          for (const f of geo.features) {
            const r = polysOf(f).sort((a, c) => c.length - a.length)[0];
            const cx = r.reduce((s, q) => s + q[0], 0) / r.length, cy = r.reduce((s, q) => s + q[1], 0) / r.length;
            const el = document.createElement("div"); el.className = "nlab"; el.textContent = f.properties.n;
            new ml.Marker({ element: el }).setLngLat([cx, cy]).addTo(map);
          }
          const lab = () => box.current?.classList.toggle("z-lab", map.getZoom() >= 10.3);
          map.on("zoom", lab); lab();
          setLoading(false);
        });
        map.on("error", (e: any) => { if (e?.error?.message && /Failed to fetch|NetworkError/i.test(e.error.message)) return; });
      } catch (e: any) { if (!dead) { setErr(e.message || "Peta gagal dimuat"); setLoading(false); } }
    })();
    return () => { dead = true; mapRef.current?.remove(); mapRef.current = null; };
  }, [started, places]);

  const toggle = () => {
    const m = mapRef.current; if (!m) return;
    const next = !is3d; setIs3d(next);
    m.setTerrain(next ? { source: "dem", exaggeration: 1.6 } : null);
    m.easeTo({ pitch: next ? 58 : 0, bearing: next ? -14 : 0, duration: 800 });
  };

  if (!started) return (
    <div className="map-cta">
      <div className="map-cta-ico" aria-hidden="true">⛰️</div>
      <h3>Peta 3D Solok Selatan</h3>
      <p>Lihat bukit dan lembah, batas 39 nagari, dan pin tempat wisata. Peta ini memuat data medan dan ubin peta (± beberapa MB), jadi dimuat hanya saat kamu menekan tombol.</p>
      <button className="btn" onClick={() => setStarted(true)}>Muat peta 3D</button>
    </div>
  );
  return (
    <div className="mapwrap">
      <div className="mapbox" ref={box} />
      {loading && !err && <div className="map-msg">Memuat peta…</div>}
      {err && <div className="map-msg">{err}</div>}
      <div className="map-tools"><button className="tab" aria-pressed={is3d} onClick={toggle}>{is3d ? "3D" : "2D"}</button></div>
      <div className="map-legend"><b>Warna nagari</b>: jumlah tempat wisata<br /><i style={{ background: "#EBDDBB" }} />0 <i style={{ background: "#E9B86A" }} />1 <i style={{ background: "#C8742A" }} />3 <i style={{ background: "#B3322A" }} />6+<br /><small>Ketuk nagari untuk detail, ketuk pin untuk membuka tempat. Geser dua jari untuk memiringkan.</small></div>
    </div>
  );
}
