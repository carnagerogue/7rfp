import { useState } from "react";
import { useLocation } from "wouter";
import AppShell from "./app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function SettingsPage() {
  const { account, logout } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);

  async function changePassword() {
    if (next.length < 8) {
      toast({ title: "Password too short", description: "Minimum 8 characters.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      await apiRequest("POST", "/api/auth/change-password", {
        currentPassword: current,
        newPassword: next,
      });
      toast({ title: "Password updated" });
      setCurrent("");
      setNext("");
    } catch (err: any) {
      toast({ title: "Could not change password", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  function handleLogout() {
    logout();
    setLocation("/");
  }

  return (
    <AppShell title="Settings">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card className="p-6">
          <h2 className="text-base font-semibold mb-4">Account</h2>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={account?.email ?? ""} readOnly disabled data-testid="input-settings-email" />
            </div>
            <div className="space-y-1.5">
              <Label>Plan</Label>
              <div>
                <Badge variant="outline" data-testid="badge-plan" className="capitalize">
                  {account?.plan ?? "free"}
                </Badge>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                  Free beta includes on-demand discovery and unlimited proposals. Planned upgrades
                  include provider-backed drafting, document import, and team workflows.
                </p>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-base font-semibold mb-4">Change password</h2>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Current password</Label>
              <Input
                type="password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                data-testid="input-current-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label>New password</Label>
              <Input
                type="password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                data-testid="input-new-password"
              />
            </div>
            <div className="flex justify-end pt-1">
              <Button
                onClick={changePassword}
                disabled={busy || !current || !next}
                data-testid="button-change-password"
              >
                {busy ? "Updating..." : "Update password"}
              </Button>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-base font-semibold mb-3">Session</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Log out to end your session in this browser.
          </p>
          <Button variant="outline" onClick={handleLogout} data-testid="button-settings-logout">
            Log out
          </Button>
        </Card>
      </div>
    </AppShell>
  );
}
