"use client";
// Top bar of every printable preview (invoice, bill, return, quotation, money receipt):
// ← title · Regular/Thermal switch · Download PDF · Print PDF · ⋮ (children).
// Printing prints ONLY the `.pv-paper` element (see the "Invoice print" block in globals.css).
import React, { useCallback, useEffect } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Icon } from "./ui";

/** Wait for fonts + images inside the paper so the print never shows half-loaded content. */
async function ready() {
  try { await (document as Document & { fonts?: FontFaceSet }).fonts?.ready; } catch { /* ignore */ }
  const imgs = Array.from(document.querySelectorAll<HTMLImageElement>(".pv-paper img"));
  await Promise.all(imgs.map((img) => (img.complete ? null : new Promise((r) => { img.onload = img.onerror = r; }))));
}

/** Thermal rolls have no fixed height: size the @page to the receipt so it prints as one strip. */
function fitThermalPage() {
  const paper = document.querySelector<HTMLElement>(".pv-paper.thermal");
  let tag = document.getElementById("pv-thermal-page") as HTMLStyleElement | null;
  if (!paper) { tag?.remove(); return; }
  const widthMm = paper.classList.contains("w58") ? 58 : 80;
  const hMm = Math.ceil((paper.scrollHeight * 25.4) / 96) + 6;
  if (!tag) { tag = document.createElement("style"); tag.id = "pv-thermal-page"; document.head.appendChild(tag); }
  tag.textContent = `@page { size: ${widthMm}mm ${Math.max(hMm, 60)}mm; margin: 0; }`;
}

/** Open the browser print dialog for the paper. With `fileName`, the saved PDF gets that name. */
export async function printPaper(fileName?: string) {
  await ready();
  fitThermalPage();
  const old = document.title;
  if (fileName) document.title = fileName;
  const restore = () => { document.title = old; window.removeEventListener("afterprint", restore); };
  window.addEventListener("afterprint", restore);
  window.print();
  setTimeout(restore, 1500);
}

export default function PrintBar({
  title, backHref, fileName, thermal, children, showModeSwitch = true,
}: {
  title: React.ReactNode;
  backHref: string;
  fileName: string;
  thermal?: boolean;
  children?: React.ReactNode;
  showModeSwitch?: boolean;
}) {
  const sp = useSearchParams();
  const pathname = usePathname();
  const auto = sp.get("print") === "1";

  const hrefFor = useCallback((t: boolean) => {
    const p = new URLSearchParams(sp.toString());
    p.delete("print");
    if (t) { p.set("thermal", "1"); p.delete("regular"); } else { p.delete("thermal"); p.set("regular", "1"); }
    return `${pathname}?${p.toString()}`;
  }, [sp, pathname]);

  useEffect(() => {
    fitThermalPage();
    if (!auto) return;
    const t = setTimeout(() => {
      printPaper(fileName);
      const p = new URLSearchParams(window.location.search);
      p.delete("print");
      const qs = p.toString();
      window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : ""));
    }, 350);
    return () => clearTimeout(t);
  }, [auto, fileName, thermal]);

  useEffect(() => {
    const before = () => fitThermalPage();
    window.addEventListener("beforeprint", before);
    return () => window.removeEventListener("beforeprint", before);
  }, []);

  return (
    <div className="pv-bar no-print">
      <div className="pv-title">
        <Link href={backHref} className="back-btn" aria-label="Go back"><Icon name="back" size={18} /></Link>
        <span>{title}</span>
      </div>
      <div className="pv-actions">
        {showModeSwitch && (
          <div className="seg pv-mode" role="tablist" aria-label="Print type">
            <Link href={hrefFor(false)} replace className={!thermal ? "on" : ""} role="tab" aria-selected={!thermal}>Regular</Link>
            <Link href={hrefFor(true)} replace className={thermal ? "on" : ""} role="tab" aria-selected={!!thermal}>Thermal</Link>
          </div>
        )}
        <button type="button" className="btn btn-primary" onClick={() => printPaper(fileName)}
          title={`Opens the print dialog — choose “Save as PDF” as the destination to save ${fileName}.pdf`}>
          <Icon name="download" size={15} />Download PDF
        </button>
        <button type="button" className="btn" onClick={() => printPaper()} title="Print on your printer">
          <Icon name="printer" size={15} />Print PDF
        </button>
        {children}
      </div>
    </div>
  );
}

/** ⋮ trigger button styled for the print bar. */
export function BarMoreButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="btn btn-icon" onClick={onClick} aria-label="More actions" title="More actions">
      <Icon name="more" size={16} />
    </button>
  );
}

/** A4 grey stage that holds the white paper. `pageCss` is the @page rule for this document. */
export function PrintStage({ children, pageCss }: { children: React.ReactNode; pageCss: string }) {
  return (
    <div className="pv-stage">
      <style>{pageCss}</style>
      {children}
    </div>
  );
}
