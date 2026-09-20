import { cookies } from "next/headers";
import { makeT, isLocale, type Locale } from "./i18n";

export async function getT(): Promise<{ t: (k: string) => string; locale: Locale }> {
  const jar = await cookies();
  const lc = jar.get("hishab_locale")?.value;
  const locale: Locale = isLocale(lc) ? lc : "en";
  return { t: makeT(locale), locale };
}
