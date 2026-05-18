import { MatchSubNav } from "@/components/layout/match-sub-nav";

export default function MatchSectionLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-5">
      <div className="border-b border-[var(--fo-border)] pb-3">
        <MatchSubNav />
      </div>
      {children}
    </div>
  );
}
