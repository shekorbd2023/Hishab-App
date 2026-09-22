"use client";
import React, { createContext, useContext, useCallback } from "react";
import { makeT, type Locale } from "@/lib/i18n";
import { useRouter } from "next/navigation";

type Ctx = { locale: Locale; t: (k: string) => string; setLocale: (l: Locale) => void };
const I18nCtx = createContext<Ctx | null>(null);

export function Providers({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const router = useRouter();
  const t = makeT(locale);
  const setLocale = useCallback(
    (l: Locale) => {
      document.cookie = `hishab_locale=${l}; path=/; max-age=${60 * 60 * 24 * 365}`;
      router.refresh();
    },
    [router]
  );
  return <I18nCtx.Provider value={{ locale, t, setLocale }}>{children}</I18nCtx.Provider>;
}

export function useT() {
  const c = useContext(I18nCtx);
  if (!c) return { locale: "en" as Locale, t: (k: string) => k, setLocale: () => {} };
  return c;
}

/* ============================== Theme ============================== */
export type ThemeChoice = "light" | "dark" | "classic" | "system";
export const THEME_KEY = "hishab_theme";

export function readTheme(): ThemeChoice {
  try {
    const t = localStorage.getItem(THEME_KEY);
    if (t === "light" || t === "dark" || t === "classic" || t === "system") return t;
  } catch { /* ignore */ }
  return "light";
}

/** Apply a theme to <html data-theme> and remember it (same logic as the pre-paint script in app/layout.tsx). */
export function applyTheme(choice: ThemeChoice) {
  try { localStorage.setItem(THEME_KEY, choice); } catch { /* ignore */ }
  const el = document.documentElement;
  const resolved = choice === "system"
    ? (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : choice;
  if (resolved === "light") el.removeAttribute("data-theme");
  else el.setAttribute("data-theme", resolved);
}

export function LocaleToggle() {
  const { locale, setLocale } = useT();
  return (
    <button className="btn" title="Language" onClick={() => setLocale(locale === "en" ? "bn" : "en")} style={{ padding: ".35rem .6rem" }}>
      {locale === "en" ? "বাংলা" : "EN"}
    </button>
  );
}

/** Legacy one-click light/dark toggle (kept for older screens). */
export function ThemeToggle() {
  return (
    <button className="btn" title="Theme" style={{ padding: ".35rem .6rem" }}
      onClick={() => applyTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark")}>
      ◐
    </button>
  );
}
