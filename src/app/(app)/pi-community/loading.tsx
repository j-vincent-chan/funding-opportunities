import { PageLoadingState } from "@/components/ui/page-loading-state";

export default function PiCommunityLoading() {
  return (
    <PageLoadingState
      message="Loading community signals…"
      detail="Pulling publications, grants, and activity across your watchlist."
    />
  );
}
