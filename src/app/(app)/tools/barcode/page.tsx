import { requireCtx } from "@/lib/auth";
import { redirect } from "next/navigation";
import BarcodeGen from "./BarcodeGen";

export const dynamic = "force-dynamic";

export default async function BarcodePage() {
  const ctx = await requireCtx();
  if (!ctx) redirect("/login");
  return <BarcodeGen />;
}
