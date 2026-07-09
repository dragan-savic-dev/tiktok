import { redirect } from "next/navigation";
import { hasSession } from "@/lib/session";
import DashboardClient from "./dashboard-client";

export default async function DashboardPage() {
  if (!(await hasSession())) redirect("/");
  return <DashboardClient />;
}
