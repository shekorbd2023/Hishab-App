"use client";
import { useEffect, useRef, useState } from "react";

const OCCASIONS = [
  { t: "Eid Mubarak", m: "Wishing you and your family a blessed Eid.", c1: "#166534", c2: "#052e16" },
  { t: "Happy New Year", m: "May the new year bring prosperity to your business.", c1: "#1d4ed8", c2: "#0b1e4d" },
  { t: "Shubho Noboborsho", m: "শুভ নববর্ষ — best wishes for the Bengali New Year.", c1: "#b91c1c", c2: "#450a0a" },
  { t: "Thank You", m: "Thank you for being our valued customer.", c1: "#0ea5a4", c2: "#134e4a" },
];

export default function GreetingCardClient({ business, logo }: { business: string; logo: string }) {
  const [i, setI] = useState(0);
  const [title, setTitle] = useState(OCCASIONS[0].t);
  const [message, setMessage] = useState(OCCASIONS[0].m);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  function pick(idx: number) { setI(idx); setTitle(OCCASIONS[idx].t); setMessage(OCCASIONS[idx].m); }

  function draw() {
    const c = canvasRef.current; if (!c) return; const ctx = c.getContext("2d"); if (!ctx) return;
    const W = 1000, H = 640; c.width = W; c.height = H;
    const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, OCCASIONS[i].c1); g.addColorStop(1, OCCASIONS[i].c2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // decorative border
    ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.lineWidth = 3; ctx.strokeRect(30, 30, W - 60, H - 60);
    ctx.textAlign = "center"; ctx.fillStyle = "#fff";
    ctx.font = "800 68px 'Plus Jakarta Sans', Arial, sans-serif"; ctx.fillText(title || "Greetings", W / 2, 230);
    ctx.font = "400 30px Arial, sans-serif";
    wrap(ctx, message || "", W / 2, 320, W - 220, 42);
    ctx.font = "700 30px Arial, sans-serif"; ctx.fillText("— " + (business || "Your Business"), W / 2, H - 90);
    if (logo) {
      const img = new Image();
      img.onload = () => { const s = 90; ctx.save(); ctx.beginPath(); ctx.arc(W / 2, H - 190, s / 2 + 10, 0, Math.PI * 2); ctx.fillStyle = "rgba(255,255,255,.15)"; ctx.fill(); ctx.clip(); ctx.drawImage(img, W / 2 - s / 2, H - 190 - s / 2, s, s); ctx.restore(); };
      img.src = logo;
    }
    ctx.textAlign = "left";
  }
  function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number) {
    const words = text.split(" "); let line = ""; let yy = y;
    for (const w of words) { const test = line + w + " "; if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line.trim(), x, yy); line = w + " "; yy += lh; } else line = test; }
    if (line) ctx.fillText(line.trim(), x, yy);
  }
  useEffect(() => { draw(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [i, title, message, business, logo]);

  function downloadCard() {
    const c = canvasRef.current; if (!c) return; draw();
    setTimeout(() => { const a = document.createElement("a"); a.href = c.toDataURL("image/png"); a.download = "greeting-card.png"; a.click(); }, 200);
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "1rem" }}>Greeting Card</h1>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: "1rem", alignItems: "start" }} className="gc-grid">
        <div className="card" style={{ padding: "1.25rem", display: "grid", gap: ".6rem" }}>
          <div>
            <label className="label">Occasion</label>
            <div style={{ display: "flex", gap: ".4rem", flexWrap: "wrap" }}>
              {OCCASIONS.map((o, idx) => (
                <button key={o.t} className="btn" onClick={() => pick(idx)} style={{ background: i === idx ? "var(--brand)" : undefined, color: i === idx ? "#fff" : undefined, borderColor: i === idx ? "var(--brand)" : undefined }}>{o.t}</button>
              ))}
            </div>
          </div>
          <div><label className="label">Title</label><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div><label className="label">Message</label><textarea className="input" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} /></div>
        </div>
        <div className="card" style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: ".75rem" }}>
          <canvas ref={canvasRef} style={{ width: "100%", height: "auto", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,.15)" }} />
          <button className="btn btn-primary" onClick={downloadCard}>⬇ Download Greeting Card (PNG)</button>
        </div>
      </div>
      <style>{`@media(max-width:760px){.gc-grid{grid-template-columns:1fr !important;}}`}</style>
    </div>
  );
}
