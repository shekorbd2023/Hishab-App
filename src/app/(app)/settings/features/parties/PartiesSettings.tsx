"use client";
import type { BizSettings } from "@/lib/settings";
import { PageTitle, Section, ToggleRow, useSettings } from "../../SettingsKit";

export default function PartiesSettings({ initial }: { initial: BizSettings; business: unknown }) {
  const { s, save, toastNode } = useSettings(initial);
  return (
    <div>
      <PageTitle>Party Settings</PageTitle>
      <Section title="Parties">
        <ToggleRow title="Party Category" desc="Group customers and suppliers into categories and filter by them." on={s.party_category} onChange={(v) => save({ party_category: v })} />
        <ToggleRow title="Upload Party Image" desc="Add a photo to each party to recognise them easily." on={s.party_image} onChange={(v) => save({ party_image: v })} />
      </Section>
      {toastNode}
    </div>
  );
}
