/**
 * Full-bleed in the main column: negates AppShell padding so the funding canvas
 * reaches the edges of the content area (and min-height fills the viewport).
 * `fo-funding-page` scopes warmer background + table chrome (see app-editorial.css).
 */
export default function FundingOpportunitiesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="fo-funding-page -mx-4 -my-6 flex min-h-[100dvh] flex-1 flex-col px-4 pb-16 pt-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      {children}
    </div>
  );
}
