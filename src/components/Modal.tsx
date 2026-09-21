"use client";
import React from "react";

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "grid", placeItems: "center", zIndex: 50, padding: "1rem" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card scroll-thin"
        style={{ padding: "1.25rem", width: "100%", maxWidth: wide ? 760 : 440, maxHeight: "90vh", overflowY: "auto" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h2 style={{ fontWeight: 700, fontSize: "1.1rem" }}>{title}</h2>
          <button className="btn" onClick={onClose} style={{ padding: ".3rem .6rem" }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function PageHeader({ title, count, children }: { title: string; count?: number; children?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: ".5rem", marginBottom: "1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 800 }}>
        {title} {count !== undefined && <span className="text-muted" style={{ fontWeight: 600, fontSize: "1rem" }}>({count})</span>}
      </h1>
      <div style={{ display: "flex", gap: ".4rem", flexWrap: "wrap" }}>{children}</div>
    </div>
  );
}
