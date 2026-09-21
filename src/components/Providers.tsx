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

export function LocaleToggle() {
  const { locale, setLocale } = useT();
  return (
    <button
      className="btn"
      title="Language"
      onClick={() => setLocale(locale === "en" ? "bn" : "en")}
      style={{ padding: ".35rem .6rem" }}
    >
      {locale === "en" ? "বাংলা" : "EN"}
    </button>
  );
}

export function ThemeToggle() {
  const toggle = () => {
    const el = document.documentElement;
    const dark = el.getAttribute("data-theme") === "dark";
    if (dark) {
      el.removeAttribute("data-theme");
      localStorage.setItem("hishab_theme", "light");
    } else {
      el.setAttribute("data-theme", "dark");
      localStorage.setItem("hishab_theme", "dark");
    }
  };
  return (
    <button className="btn" title="Theme" onClick={toggle} style={{ padding: ".35rem .6rem" }}>
      ◐
    </button>
  );
}
