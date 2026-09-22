"use client";
// Opening splash: Hishab logo + name, then the business's own logo + name. Shown once per browser session.
import { useEffect, useRef, useState } from "react";

// app/layout.tsx sets <html data-splash="seen"> before paint when this key exists, so reloads never flash it.
const KEY = "hishab_splash";

export default function Splash({ businessName, businessLogo }: { businessName: string; businessLogo?: string | null }) {
  const [gone, setGone] = useState(false);
  const seen = useRef<boolean | null>(null); // survives StrictMode's double effect run
  useEffect(() => {
    if (seen.current === null) {
      try { seen.current = !!sessionStorage.getItem(KEY); sessionStorage.setItem(KEY, "1"); } catch { seen.current = false; }
    }
    if (seen.current) { setGone(true); return; }
    const t = setTimeout(() => setGone(true), 1800);
    return () => clearTimeout(t);
  }, []);
  if (gone) return null;
  const init = (businessName || "?").trim().slice(0, 1).toUpperCase();
  return (
    <>
      <div className="splash hs-splash" aria-hidden>
        <div className="inner">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="" width={96} height={96} style={{ borderRadius: 24 }} />
          <div style={{ textAlign: "center", lineHeight: 1.15 }}>
            <div style={{ fontSize: 30, fontWeight: 800, color: "var(--navy)", letterSpacing: "-.01em" }}>Hishab</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: "var(--brand)" }}>হিসাব</div>
          </div>
          <div className="hs-splash-biz">
            {businessLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={businessLogo} alt="" width={72} height={72} style={{ borderRadius: 16, objectFit: "cover", border: "1px solid var(--border)", background: "#fff" }} />
            ) : (
              <span style={{ width: 72, height: 72, borderRadius: 16, background: "var(--brand-soft)", color: "var(--brand-dark)", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 28 }}>{init}</span>
            )}
            <div style={{ fontWeight: 700, fontSize: 16 }}>{businessName}</div>
          </div>
        </div>
      </div>
    </>
  );
}
