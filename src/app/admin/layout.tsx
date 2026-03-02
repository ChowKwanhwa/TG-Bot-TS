import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SUPER_ADMIN_EMAIL } from "@/lib/constants";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/");
  }

  if (session.user.email?.toLowerCase() !== SUPER_ADMIN_EMAIL.toLowerCase()) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b bg-white px-6 py-4 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold">TG Repeat Bot</h1>
            <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
              ADMIN
            </span>
          </div>
          <span className="text-sm text-zinc-500">{session.user.email}</span>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
