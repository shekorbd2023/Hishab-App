import ListPage from "../documents/ListPage";

export const dynamic = "force-dynamic";
export const metadata = { title: "Quotations" };

export default function Page() {
  return <ListPage kind="quotation" />;
}
