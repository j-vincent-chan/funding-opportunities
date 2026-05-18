import { Card, CardBody, CardHeader } from "@/components/ui/card";

export default function FundingOpportunityDetailLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-4 w-40 rounded bg-slate-200" />
      <div className="h-8 max-w-3xl rounded bg-slate-200" />
      <div className="h-4 w-2/3 rounded bg-slate-100" />
      <div className="h-10 w-44 rounded bg-slate-200" />
      <Card>
        <CardHeader title="Metadata" />
        <CardBody>
          <div className="h-24 rounded bg-slate-100" />
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Loading…" />
        <CardBody>
          <p className="text-sm text-slate-500">Preparing this funding notice.</p>
        </CardBody>
      </Card>
    </div>
  );
}
