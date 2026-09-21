import { redirect } from "next/navigation";
import { getCurrentUser, getActiveBusiness } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const ab = await getActiveBusiness(user.id);
  if (!ab) redirect("/login");
  redirect("/dashboard");
}
