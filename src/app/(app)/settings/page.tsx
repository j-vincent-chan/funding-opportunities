import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, role")
    .eq("id", user?.id ?? "")
    .maybeSingle();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="app-page-title">Settings</h1>
        <p className="app-page-description">
          Account basics. User administration will expand in a later phase.
        </p>
      </header>

      <Card>
        <CardHeader title="Profile" />
        <CardBody className="space-y-2 text-sm text-[var(--fo-ink-body)]">
          <p>
            <span className="font-medium text-[var(--fo-title)]">Email:</span>{" "}
            {profile?.email ?? user?.email ?? "—"}
          </p>
          <p>
            <span className="font-medium text-[var(--fo-title)]">Name:</span>{" "}
            {profile?.full_name ?? "—"}
          </p>
          <p>
            <span className="font-medium text-[var(--fo-title)]">Role:</span>{" "}
            {profile?.role ?? "—"}
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
