import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Wordmark } from "@/components/brand";
import { LogoWithWordmark } from "@/components/logo";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

export default function SignupPage() {
  const { signup } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await signup(email, password, companyName);
      toast({ title: "Welcome to 7RFP", description: "Your workspace is ready." });
      setLocation("/app/rfps");
    } catch (err: any) {
      setError(err.message || "Sign up failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center">
          <Link href="/" className="inline-flex">
            <Wordmark />
          </Link>
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <Card className="w-full max-w-md p-8">
          <div className="flex justify-center mb-5">
            <LogoWithWordmark size={48} textClassName="text-2xl" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight mb-1">Create your workspace</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Free forever. Each company gets an isolated workspace.
          </p>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="companyName">Company name</Label>
              <Input
                id="companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
                data-testid="input-company-name"
                placeholder="Acme Federal Solutions"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Work email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                data-testid="input-email"
                placeholder="you@company.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                data-testid="input-password"
                placeholder="At least 8 characters"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                data-testid="input-confirm-password"
              />
            </div>
            {error && (
              <p className="text-sm text-destructive" data-testid="text-signup-error">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={busy} data-testid="button-signup">
              {busy ? "Creating workspace..." : "Sign up free"}
            </Button>
          </form>
          <p className="text-xs text-muted-foreground mt-6 text-center">
            Already have an account?{" "}
            <Link href="/login" className="text-primary font-medium hover:underline" data-testid="link-login">
              Log in
            </Link>
          </p>
        </Card>
      </main>
    </div>
  );
}
