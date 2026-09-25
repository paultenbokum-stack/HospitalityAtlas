import { signOut, auth } from "@/auth";
import { Nav } from "@/components/nav";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { requirePageContext, roleAtLeast } from "@/lib/session";

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requirePageContext();
  const session = await auth();

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="border-b border-border bg-surface md:sticky md:top-0 md:h-screen md:w-56 md:shrink-0 md:border-r md:border-b-0">
        <div className="flex items-center justify-between gap-2 px-4 py-3 md:block">
          <div className="text-sm font-semibold">Atlas CRM</div>
          <div className="md:mt-3">
            <WorkspaceSwitcher current={ctx.workspace.id} available={ctx.available} canCreate={ctx.isSuperadmin} />
          </div>
        </div>
        <Nav showSettings={roleAtLeast(ctx.role, "admin")} />
        <div className="hidden px-4 py-3 text-xs text-muted md:absolute md:bottom-0 md:block md:w-56">
          <div className="truncate">{session?.user?.email}</div>
          <div className="capitalize">{ctx.role}</div>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button className="mt-2 underline">Sign out</button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-5 md:px-8">{children}</main>
    </div>
  );
}
