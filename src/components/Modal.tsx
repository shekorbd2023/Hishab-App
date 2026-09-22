"use client";
import React from "react";
import { Modal as M } from "./ui";

/** Back-compat wrapper around the shared ui Modal. */
export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return <M title={title} onClose={onClose} width={wide ? 760 : 480}>{children}</M>;
}

export function PageHeader({ title, count, children }: { title: string; count?: number; children?: React.ReactNode }) {
  return (
    <div className="page-head">
      <h1 className="page-title">{title}{count !== undefined && <span className="count">({count})</span>}</h1>
      <div style={{ display: "flex", gap: ".45rem", flexWrap: "wrap", alignItems: "center" }}>{children}</div>
    </div>
  );
}
