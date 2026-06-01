import { redirect } from "next/navigation";

export default function PiCommunityEngagementRedirectPage({
  params,
}: {
  params: { id: string };
}) {
  redirect(`/portfolio-intelligence/engagements/${params.id}`);
}
