import { AppShellSidebar } from "@/components/layout/app-shell-sidebar";

export function AppShell({
  children,
  userEmail,
}: {
  children: React.ReactNode;
  userEmail?: string | null;
}) {
  return (
    <div className="app-editorial-root flex min-h-screen flex-col bg-[var(--fo-canvas)] md:flex-row md:items-stretch">
      <AppShellSidebar userEmail={userEmail} />
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-clip">
        <div className="mx-auto flex min-h-0 w-full max-w-none flex-1 flex-col px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
          {children}
        </div>
      </main>
    </div>
  );
}
