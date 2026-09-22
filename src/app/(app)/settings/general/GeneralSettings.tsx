"use client";
import { useEffect, useState } from "react";
import { Seg } from "@/components/ui";
import type { BizSettings } from "@/lib/settings";
import { PageTitle, Row, Section, ToggleRow, useSettings } from "../SettingsKit";

export default function GeneralSettings({ initial }: { initial: BizSettings; business: unknown }) {
  const { s, save, toastNode } = useSettings(initial);
  const [theme, setTheme] = useState("light");
  useEffect(() => { try { setTheme(localStorage.getItem("hishab_theme") || "light"); } catch { /* ignore */ } }, []);
  function applyTheme(t: string) {
    setTheme(t);
    try { localStorage.setItem("hishab_theme", t); } catch { /* ignore */ }
    const el = document.documentElement;
    const eff = t === "system" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : t;
    if (eff === "light") el.removeAttribute("data-theme"); else el.setAttribute("data-theme", eff);
    save({ theme: t as BizSettings["theme"] }, "Theme updated");
  }
  return (
    <div>
      <PageTitle>General Settings</PageTitle>
      <Section title="Appearance">
        <Row title="Theme" desc="Choose how Hishab looks on this device."><Seg value={theme} onChange={applyTheme} options={[{ v: "light", l: "Light" }, { v: "classic", l: "Classic" }, { v: "dark", l: "Dark" }, { v: "system", l: "System" }]} /></Row>
      </Section>
      <Section title="Regional">
        <Row title="Currency Position" desc="Where the currency symbol appears."><Seg value={s.currency_position} onChange={(v) => save({ currency_position: v })} options={[{ v: "start", l: "Tk. 100" }, { v: "end", l: "100 Tk." }]} /></Row>
        <Row title="Date Format"><select className="input" style={{ width: 170 }} value={s.date_format} onChange={(e) => save({ date_format: e.target.value as BizSettings["date_format"] })}>
          <option value="DD MMM YYYY">23 Sep 2026</option><option value="DD/MM/YYYY">23/09/2026</option><option value="MM/DD/YYYY">09/23/2026</option><option value="YYYY-MM-DD">2026-09-23</option></select></Row>
        <Row title="Number Format"><Seg value={s.number_format} onChange={(v) => save({ number_format: v })} options={[{ v: "intl", l: "1,000,000" }, { v: "indian", l: "10,00,000" }]} /></Row>
      </Section>
      <Section title="Privacy & Security">
        <ToggleRow title="Privacy Mode" desc="Hides business figures on the dashboard and item purchase prices." on={s.privacy_mode} onChange={(v) => save({ privacy_mode: v })} />
      </Section>
      {toastNode}
    </div>
  );
}
