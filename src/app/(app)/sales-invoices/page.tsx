import ListPage from "../documents/ListPage";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sales Invoices" };

export default function Page() {
  return <ListPage kind="sales_invoice" />;
}
