import Link from "next/link";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

export default function UploadPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="app-page-title">Upload</h1>
        <p className="app-page-description">
          Upload workflows for investigator rosters and enrichment datasets will live here.
        </p>
      </header>

      <Card>
        <CardHeader title="Coming soon" />
        <CardBody className="space-y-2 text-sm text-[var(--fo-ink-body)]">
          <p>
            For now, use{" "}
            <Link href="/investigators" className="font-medium text-[var(--fo-interaction)] underline">
              Investigators
            </Link>{" "}
            to import CSV files and manage your faculty directory.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
