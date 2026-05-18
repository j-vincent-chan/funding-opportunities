import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

export function SidebarIconDashboard(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" aria-hidden {...props}>
      <path d="M4.5 10.5 12 4.5l7.5 6V21h-6v-6h-3v6h-6V10.5Z" />
    </svg>
  );
}

export function SidebarIconSearch(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" aria-hidden {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.2-4.2" />
    </svg>
  );
}

export function SidebarIconMatch(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" aria-hidden {...props}>
      <circle cx="9" cy="12" r="3.25" />
      <circle cx="15" cy="12" r="3.25" />
      <path d="M11.25 12h1.5" />
    </svg>
  );
}

export function SidebarIconCommunity(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" aria-hidden {...props}>
      <path d="M8.5 10a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
      <path d="M4 20v-1.5A3.5 3.5 0 0 1 7.5 15h2" />
      <path d="M15.5 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path d="M20 20v-1.5a4 4 0 0 0-4-4h-2.5" />
    </svg>
  );
}

export function SidebarIconInvestigators(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" aria-hidden {...props}>
      <path d="M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
      <path d="M5.5 20.5v-1.2A4.3 4.3 0 0 1 9.8 15h4.4a4.3 4.3 0 0 1 4.3 4.3v1.2" />
    </svg>
  );
}

export function SidebarIconSettings(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" aria-hidden {...props}>
      <circle cx="12" cy="12" r="3.25" />
      <path d="M12 2v1.5M12 20.5V22M4.22 4.22l1.06 1.06M18.72 18.72l1.06 1.06M2 12h1.5M20.5 12H22M4.22 19.78l1.06-1.06M18.72 5.28l1.06-1.06" />
    </svg>
  );
}

export function SidebarIconSignOut(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" aria-hidden {...props}>
      <path d="M10 17H7a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3" />
      <path d="M14 7.5 18.5 12 14 16.5" />
      <path d="M7 12h11.5" />
    </svg>
  );
}

/** Collapse rail — chevron points left */
export function SidebarIconPanelClose(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" aria-hidden {...props}>
      <path d="M15 6 9 12l6 6" />
      <path d="M4 5v14" opacity={0.35} />
    </svg>
  );
}

/** Expand rail — chevron points right */
export function SidebarIconPanelOpen(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" aria-hidden {...props}>
      <path d="M9 6 15 12l-6 6" />
      <path d="M4 5v14" opacity={0.35} />
    </svg>
  );
}
