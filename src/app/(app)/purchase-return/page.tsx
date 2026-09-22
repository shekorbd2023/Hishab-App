import ListPage from "../documents/ListPage";

export const dynamic = "force-dynamic";
export const metadata = { title: "Purchase Return" };

export default function Page() {
  return <ListPage kind="purchase_return" />;
}
