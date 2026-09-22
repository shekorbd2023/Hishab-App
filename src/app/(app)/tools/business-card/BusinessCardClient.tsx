"use client";
import { useEffect, useRef, useState } from "react";

type Data = { name: string; business: string; address: string; phone: string; email: string; logo: string };
const COLORS = ["#16a34a", "#e11d48", "#2563eb", "#ea580c", "#0ea5a4", "#166534", "#db2777"];

export default function BusinessCardClient({ initial }: { initial: Data }) {
  const [f, setF] = useState<Data>(initial);
  const [color, setColor] = useState(COLORS[0]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const set = (k: keyof Data) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  function draw() {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    const W = 1000, H = 560; c.width = W; c.height = H;
    ctx.clearRect(0, 0, W, H);
    // background
    ctx.fillStyle = color; ctx.fillRect(0, 0, W, H);
    // white curved panel on the right
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(W, 0); ctx.lineTo(W, H); ctx.lineTo(640, H);
    ctx.quadraticCurveTo(760, H / 2, 640, 0); ctx.closePath(); ctx.fill();
    // text
    ctx.fillStyle = "#ffffff"; ctx.textBaseline = "alphabetic";
    ctx.font = "800 54px 'Plus Jakarta Sans', Arial, sans-serif";
    ctx.fillText(f.name || "Your Name", 60, 120);
    ctx.font = "600 30px Arial, sans-serif";
    ctx.fillText(f.business || "Business", 60, 165);
    ctx.fillStyle = "rgba(255,255,255,.4)"; ctx.fillRect(60, 195, 300, 3);
    ctx.fillStyle = "#ffffff"; ctx.font = "400 28px Arial, sans-serif";
    const rows = [f.phone && "☎  " + f.phone, f.email && "✉  " + f.email, f.address && "⌂  " + f.address].filter(Boolean) as string[];
    rows.forEach((r, i) => ctx.fillText(r, 60, 380 + i * 52));
    // logo inside a circle on the white panel
    const cx = 800, cy = 280, r = 150;
    if (f.logo) {
      const img = new Image();
      img.onload = () => {
        ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
        const ar = img.width / img.height; let dw = r * 2, dh = r * 2;
        if (ar > 1) dh = dw / ar; else dw = dh * ar;
        ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh); ctx.restore();
      };
      img.src = f.logo;
    } else {
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.font = "800 90px Arial"; ctx.textAlign = "center";
      ctx.fillText((f.business || "H").slice(0, 1).toUpperCase(), cx, cy + 32); ctx.textAlign = "left";
    }
  }
  useEffect(() => { draw(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [f, color]);

  function downloadCard() {
    const c = canvasRef.current; if (!c) return;
    // redraw synchronously then export (logo may be async; small delay)
    draw();
    setTimeout(() => {
      const url = c.toDataURL("image/png");
      const a = document.createElement("a"); a.href = url; a.download = `${(f.business || "business").replace(/[^a-z0-9]/gi, "_")}-card.png`; a.click();
    }, 200);
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "1rem" }}>Business Card</h1>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: "1rem", alignItems: "start" }} className="bc-grid">
        <div className="card" style={{ padding: "1.25rem", display: "grid", gap: ".6rem" }}>
          <div><label className="label">Your Name</label><input className="input" value={f.name} onChange={set("name")} /></div>
          <div><label className="label">Business Name</label><input className="input" value={f.business} onChange={set("business")} /></div>
          <div><label className="label">Address</label><input className="input" value={f.address} onChange={set("address")} /></div>
          <div><label className="label">Phone</label><input className="input" value={f.phone} onChange={set("phone")} /></div>
          <div><label className="label">Email</label><input className="input" value={f.email} onChange={set("email")} /></div>
          <div>
            <label className="label">Card color</label>
            <div style={{ display: "flex", gap: ".4rem", flexWrap: "wrap" }}>
              {COLORS.map((c) => (
                <button key={c} onClick={() => setColor(c)} aria-label={c}
                  style={{ width: 32, height: 32, borderRadius: 8, background: c, border: color === c ? "3px solid var(--text)" : "1px solid var(--border)", cursor: "pointer" }} />
              ))}
            </div>
          </div>
          <p className="text-muted" style={{ fontSize: ".78rem" }}>Logo comes from Settings → Business Profile. Update it there to change the card logo.</p>
        </div>
        <div className="card" style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: ".75rem" }}>
          <canvas ref={canvasRef} style={{ width: "100%", height: "auto", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,.15)" }} />
          <button className="btn btn-primary" onClick={downloadCard}>⬇ Download Business Card (PNG)</button>
        </div>
      </div>
      <style>{`@media(max-width:760px){.bc-grid{grid-template-columns:1fr !important;}}`}</style>
    </div>
  );
}
