import { redirect } from "next/navigation";
import { hasSession } from "@/lib/session";
import DashboardShell from "./shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await hasSession())) redirect("/");
  return <DashboardShell>{children}</DashboardShell>;
}
