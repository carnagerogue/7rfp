import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Logo, LogoWithWordmark } from "@/components/logo";
import { AppPreview } from "@/components/app-preview";
import { ScanPreview } from "@/components/scan-preview";
import {
  ArrowRight,
  Search,
  Sparkles,
  Download,
  Calendar,
  ShieldCheck,
  Briefcase,
  GraduationCap,
  CheckCircle2,
  Clock,
  Building2,
  DollarSign,
  Target,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="border-b border-border bg-background/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <LogoWithWordmark size={36} textClassName="text-xl" />
          <nav className="flex items-center gap-2">
            <Link href="/login">
              <Button variant="ghost" size="sm" data-testid="button-login-nav">
                Log in
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="sm" data-testid="button-signup-nav">
                Sign up free
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 pt-16 pb-20">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Left: copy */}
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1 rounded-full bg-secondary text-secondary-foreground mb-6">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Free during beta · No credit card</span>
              </div>
              <h1
                className="text-3xl md:text-4xl font-bold tracking-tight leading-[1.1] mb-5"
                data-testid="text-hero-title"
              >
                We make winning RFPs <span className="text-teal">easy</span>.
              </h1>
              <p className="text-base text-muted-foreground leading-relaxed mb-8 max-w-lg">
                Qualify opportunities. Build evidence-backed responses.
                Submit with confidence. One workspace per company, free during beta.
              </p>
              <div className="flex flex-wrap items-center gap-3 mb-8">
                <Link href="/signup">
                  <Button size="lg" data-testid="button-hero-signup">
                    Start free
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/login">
                  <Button size="lg" variant="outline" data-testid="button-hero-login">
                    Log in
                  </Button>
                </Link>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {[
                  "Run targeted discovery across configured procurement sources",
                  "Track requirements, owners, evidence, and readiness",
                  "One-click branded PDF, ready to submit",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Right: product screenshot */}
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-br from-primary/10 to-transparent rounded-2xl blur-2xl" />
              <div
                className="relative rounded-xl border border-border shadow-2xl overflow-hidden bg-card"
                data-testid="img-hero-product"
              >
                <AppPreview />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Source bar */}
      <section className="border-y border-border bg-muted/40">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider text-center mb-4">
            Configure discovery across
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm font-semibold text-foreground/70">
            <span>SAM.gov</span>
            <span className="text-border">•</span>
            <span>Cal eProcure</span>
            <span className="text-border">•</span>
            <span>BidNet Direct</span>
            <span className="text-border">•</span>
            <span>HigherGov</span>
            <span className="text-border">•</span>
            <span>GovTribe</span>
            <span className="text-border">•</span>
            <span>USAspending</span>
            <span className="text-border">•</span>
            <span>State Portals</span>
            <span className="text-border">•</span>
            <span>Court Systems</span>
          </div>
        </div>
      </section>

      {/* Three pillars */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="mb-12 max-w-2xl">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            How it works
          </p>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-3">
            Three things, all easy.
          </h2>
          <p className="text-base text-muted-foreground">
            Most RFP tools wait for you to find the opportunity. Achieve RFP finds it first.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              n: "01",
              icon: Search,
              title: "We find the RFPs",
              body: "Run targeted discovery using keywords and source presets for corrections education, managed IT, cybersecurity, cloud migration, and more.",
            },
            {
              n: "02",
              icon: Sparkles,
              title: "Build the response",
              body: "Create all 8 proposal sections from your company profile, then map requirements to owners and source-backed evidence. Edit everything inline.",
            },
            {
              n: "03",
              icon: Download,
              title: "You hit submit",
              body: "Export a clean, branded PDF — your logo on the cover, polished typography, page numbers, table of contents. Ready to submit.",
            },
          ].map((s) => (
            <Card key={s.n} className="p-6 hover:shadow-md transition-shadow">
              <div className="text-xs font-medium text-primary mb-3">{s.n}</div>
              <div className="h-9 w-9 rounded-md bg-primary/10 text-primary flex items-center justify-center mb-4">
                <s.icon className="h-4 w-4" />
              </div>
              <h3 className="text-base font-semibold mb-2">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Discovery engine showcase */}
      <section className="border-y border-border bg-muted/30">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1 rounded-full bg-primary/10 text-primary mb-6">
                <Calendar className="h-3.5 w-3.5" />
                <span>Auto-discovery engine</span>
              </div>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-4">
                Stop hunting. Start responding.
              </h2>
              <p className="text-base text-muted-foreground leading-relaxed mb-6">
                Run discovery when you need it, surface opportunities matched to your keywords,
                then verify each source and qualify Go / Watch / No-Go in one workspace.
              </p>
              <ul className="space-y-3 text-sm">
                {[
                  "6 built-in presets: Corrections, Managed IT, Cybersecurity, Cloud, Workforce Dev, Custom",
                  "Editable keyword lists per workspace",
                  "Source links and review states keep unverified data visible",
                  "On-demand 'Run scan now' workflow",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative">
              <div
                className="rounded-xl border border-border shadow-xl overflow-hidden bg-card"
                data-testid="img-scan-product"
              >
                <ScanPreview />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Illustrative workspace */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 mb-4">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Illustrative workspace</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-3">
              See the pipeline shape before you start.
            </h2>
            <p className="text-base text-muted-foreground">
              Sample records show how opportunities are organized. They are product examples,
              not current procurement notices.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>Verify every notice at its source</span>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Workspace A */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-5 pb-4 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                  <GraduationCap className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Workspace A</p>
                  <p className="text-xs text-muted-foreground">Corrections + reentry education</p>
                </div>
              </div>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-secondary">3 new</span>
            </div>
            <ul className="space-y-4">
              {[
                {
                  title: "Inmate Education Tablet Program — Statewide",
                  agency: "California Department of Corrections (CDCR)",
                  value: "Est. $8M – $12M IDIQ",
                  due: "Due Jun 9, 2026",
                  rec: "GO — Pursue",
                  recColor: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
                },
                {
                  title: "Reentry Workforce Development LMS",
                  agency: "Texas Workforce Commission",
                  value: "Est. $2.4M ceiling",
                  due: "Due May 28, 2026",
                  rec: "GO — Stretch",
                  recColor: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
                },
                {
                  title: "Juvenile Detention Digital Learning Platform",
                  agency: "Cook County (IL) Procurement",
                  value: "Not listed",
                  due: "Due Jun 2, 2026",
                  rec: "WATCH — RFI stage",
                  recColor: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
                },
              ].map((item) => (
                <li key={item.title} className="text-sm">
                  <p className="font-medium leading-snug mb-1">{item.title}</p>
                  <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Building2 className="h-3 w-3" /> {item.agency}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <DollarSign className="h-3 w-3" /> {item.value}
                    </span>
                    <span className="text-border">·</span>
                    <span className="text-muted-foreground">{item.due}</span>
                    <span className={`ml-auto font-medium px-2 py-0.5 rounded ${item.recColor}`}>
                      {item.rec}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          {/* Workspace B */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-5 pb-4 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                  <Briefcase className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Workspace B</p>
                  <p className="text-xs text-muted-foreground">Managed IT + infrastructure</p>
                </div>
              </div>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-secondary">3 new</span>
            </div>
            <ul className="space-y-4">
              {[
                {
                  title: "Enterprise M365 Migration + Managed Services",
                  agency: "Maricopa County (AZ)",
                  value: "Est. $5M over 5 yrs",
                  due: "Due Jun 12, 2026",
                  rec: "GO — Pursue",
                  recColor: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
                },
                {
                  title: "Statewide Network Infrastructure Refresh",
                  agency: "State of Nevada IT Services",
                  value: "Est. $14M IDIQ",
                  due: "Due Jun 20, 2026",
                  rec: "GO — Stretch",
                  recColor: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
                },
                {
                  title: "Cybersecurity Assessment + 24/7 SOC",
                  agency: "GSA — Federal Agency Cluster",
                  value: "Up to $50M IDIQ",
                  due: "Due Jul 1, 2026",
                  rec: "WATCH — Recompete",
                  recColor: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
                },
              ].map((item) => (
                <li key={item.title} className="text-sm">
                  <p className="font-medium leading-snug mb-1">{item.title}</p>
                  <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Building2 className="h-3 w-3" /> {item.agency}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <DollarSign className="h-3 w-3" /> {item.value}
                    </span>
                    <span className="text-border">·</span>
                    <span className="text-muted-foreground">{item.due}</span>
                    <span className={`ml-auto font-medium px-2 py-0.5 rounded ${item.recColor}`}>
                      {item.rec}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <p className="text-xs text-muted-foreground text-center mt-8 flex items-center justify-center gap-2">
          <Target className="h-3.5 w-3.5" />
          Illustrative records only · Source verification required before qualification
        </p>
      </section>

      {/* Vertical fit */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="mb-12 max-w-2xl">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Built for these teams
          </p>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
            Tuned to your vertical out of the box.
          </h2>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="p-8">
            <div className="h-10 w-10 rounded-md bg-primary/10 text-primary flex items-center justify-center mb-5">
              <GraduationCap className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Corrections + reentry education</h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Inmate education programs, tablet learning platforms, LMS for jails and prisons,
              juvenile detention digital learning, workforce development for justice-involved populations.
            </p>
            <p className="text-xs text-muted-foreground">
              Pre-loaded keywords: <span className="text-foreground/80">correctional education,
              inmate education, reentry program, tablet program inmates, LMS corrections</span>
            </p>
          </Card>
          <Card className="p-8">
            <div className="h-10 w-10 rounded-md bg-primary/10 text-primary flex items-center justify-center mb-5">
              <Briefcase className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Managed IT + infrastructure</h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Managed IT services, network infrastructure, data center, end-user support, cloud migrations
              (M365, Azure, AWS), cybersecurity, IT master agreements for public sector and mid-market.
            </p>
            <p className="text-xs text-muted-foreground">
              Pre-loaded keywords: <span className="text-foreground/80">managed IT services,
              help desk, cloud migration, M365, cybersecurity, IT master agreement</span>
            </p>
          </Card>
        </div>
      </section>

      {/* Pricing */}
      <section className="border-y border-border bg-muted/30">
        <div className="max-w-3xl mx-auto px-6 py-20 text-center">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Pricing
          </p>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-3">
            Free during beta.
          </h2>
          <p className="text-base text-muted-foreground mb-8">
            One workspace per company. Unlimited RFPs, unlimited drafts, unlimited PDFs.
            Pro tier with team seats and real-time scans coming soon.
          </p>
          <Link href="/signup">
            <Button size="lg" data-testid="button-pricing-signup">
              Start free — no credit card
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-6xl mx-auto px-6 py-20 text-center">
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-4">
          Your next RFP win is already on a portal somewhere.
        </h2>
        <p className="text-base text-muted-foreground max-w-xl mx-auto mb-8">
          Let Achieve RFP find it for you. Set up your workspace in under a minute.
        </p>
        <Link href="/signup">
          <Button size="lg" data-testid="button-final-signup">
            Create your workspace
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <LogoWithWordmark size={28} textClassName="text-base" />
            <p className="text-xs text-muted-foreground">
              An iT1 Nucleos company · Part of the Achieve product family.
            </p>
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} iT1 Nucleos. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
