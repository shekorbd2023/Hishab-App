"use client";
import Link from "next/link";
import { Dropdown, Icon } from "@/components/ui";
import { useT } from "@/components/Providers";

export default function DashActions() {
  const { t } = useT();
  return (
    <div className="row" style={{ flexWrap: "wrap" }}>
      <Link href="/pos" className="btn btn-primary"><Icon name="pos" size={15} />{t("quick_pos")}<span className="db-new">NEW</span></Link>
      <Link href="/documents/new?kind=sales_invoice" className="btn"><Icon name="plus" size={15} />{t("add_sales")}</Link>
      <Link href="/documents/new?kind=purchase_bill" className="btn"><Icon name="plus" size={15} />{t("add_purchase")}</Link>
      <Dropdown width={210} items={[
        { label: t("payment_in"), icon: "arrowDown", href: "/payment-in?new=1" },
        { label: t("payment_out"), icon: "arrowUp", href: "/payment-out?new=1" },
        { label: "Quotation", icon: "statement", href: "/documents/new?kind=quotation" },
        { label: t("sales_return"), icon: "swap", href: "/documents/new?kind=sales_return" },
        { label: t("purchase_return"), icon: "swap", href: "/documents/new?kind=purchase_return" },
        { label: t("expense"), icon: "wallet", href: "/expense?new=1" },
        { label: t("income"), icon: "income", href: "/income?new=1" },
      ]} trigger={(tg) => (
        <button type="button" className="btn" onClick={tg}>{t("add_more")}<Icon name="chevronDown" size={14} /></button>
      )} />
    </div>
  );
}
