import { CommunitySubnav } from "@/components/pi-community/community-subnav";

export default function PiCommunityLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <CommunitySubnav />
      {children}
    </div>
  );
}
