import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Logo, LogoWithWordmark } from "@/components/logo";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  FileText,
  User,
  Settings as SettingsIcon,
  BookOpenCheck,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import type { Profile } from "@shared/schema";

const NAV = [
  { href: "/app/rfps", label: "RFP Ready", icon: FileText, testid: "nav-rfps" },
  { href: "/app/profile", label: "Company Profile", icon: User, testid: "nav-profile" },
  { href: "/app/company-evidence", label: "Company Evidence", icon: BookOpenCheck, testid: "nav-company-evidence" },
  { href: "/app/settings", label: "Settings", icon: SettingsIcon, testid: "nav-settings" },
];

function NavList({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const [location] = useLocation();
  const { account } = useAuth();
  // Pull unread Team Notes count for the RFP Ready badge.
  const { data: rfpData } = useQuery<{ unreadTotal?: number }>({
    queryKey: ["/api/rfps"],
    enabled: !!account,
  });
  const unread = rfpData?.unreadTotal ?? 0;
  return (
    <nav className={`flex flex-col gap-0.5 ${collapsed ? "px-1.5" : "px-2"}`}>
      {NAV.map((item) => {
        const Icon = item.icon;
        const active = location.startsWith(item.href);
        const showBadge = item.href === "/app/rfps" && unread > 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            data-testid={item.testid}
            title={
              collapsed
                ? showBadge
                  ? `${item.label} — ${unread} new Team Note${unread === 1 ? "" : "s"}`
                  : item.label
                : undefined
            }
            className={`flex items-center ${collapsed ? "justify-center px-2" : "gap-2.5 px-3"} py-2 rounded-md text-sm transition-colors relative ${
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                : "text-sidebar-foreground hover:bg-sidebar-accent/60"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="truncate">{item.label}</span>}
            {!collapsed && showBadge ? (
              <span
                className="ml-auto inline-flex items-center justify-center rounded-full bg-red-600 text-white text-[10px] leading-none font-semibold min-w-[18px] h-[18px] px-1.5"
                data-testid="badge-nav-team-notes"
              >
                {unread > 99 ? "99+" : unread}
              </span>
            ) : null}
            {collapsed && showBadge ? (
              <span
                className="absolute top-0.5 right-0.5 inline-block h-2 w-2 rounded-full bg-red-600"
                aria-label={`${unread} new Team Notes`}
                data-testid="dot-nav-team-notes"
              />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarInner({ collapsed = false }: { collapsed?: boolean }) {
  const { account } = useAuth();
  const { data } = useQuery<{ profile: Profile | null }>({
    queryKey: ["/api/profile"],
    enabled: !!account,
  });
  const logo = data?.profile?.logoDataUrl;
  const company = account?.companyName;

  return (
    <>
      <div
        className={`h-16 flex items-center border-b border-sidebar-border ${collapsed ? "px-2 justify-center" : "px-4 gap-2.5"}`}
      >
        {logo ? (
          <>
            <img
              src={logo}
              alt={company ? `${company} logo` : "Company logo"}
              className="h-8 w-8 rounded object-contain bg-white shrink-0"
              data-testid="img-tenant-logo"
            />
            {!collapsed && (
              <span
                className="text-sm font-semibold truncate"
                data-testid="text-tenant-name"
              >
                {company || "Workspace"}
              </span>
            )}
          </>
        ) : collapsed ? (
          <Logo size={26} className="text-primary" />
        ) : (
          <LogoWithWordmark size={32} textClassName="text-base" />
        )}
      </div>
      <div className="flex-1 py-4">
        <NavList collapsed={collapsed} />
      </div>
      {!collapsed && (
        <div className="px-4 py-4 border-t border-sidebar-border text-xs text-muted-foreground">
          Free plan
        </div>
      )}
    </>
  );
}

export default function AppShell({ children, title }: { children: ReactNode; title?: string }) {
  const { account, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [collapsed, setCollapsed] = useState(true);

  function handleLogout() {
    logout();
    setLocation("/");
  }

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* Desktop sidebar — collapsible */}
      <aside
        className={`hidden md:flex ${collapsed ? "w-14" : "w-60"} flex-col bg-sidebar border-r border-sidebar-border transition-[width] duration-200`}
      >
        <SidebarInner collapsed={collapsed} />
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-border bg-card/50 backdrop-blur flex items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-2 min-w-0">
            {/* Desktop collapse toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="hidden md:inline-flex h-8 w-8"
              onClick={() => setCollapsed((c) => !c)}
              data-testid="button-toggle-sidebar"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </Button>
            {/* Mobile menu */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden" data-testid="button-mobile-menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-60 bg-sidebar border-r border-sidebar-border">
                <div className="h-full flex flex-col">
                  <SidebarInner />
                </div>
              </SheetContent>
            </Sheet>
            <h1 className="text-base font-semibold truncate" data-testid="text-page-title">
              {title}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-sm text-muted-foreground" data-testid="text-company-name">
              {account?.companyName}
            </span>
            <Button variant="outline" size="sm" onClick={handleLogout} data-testid="button-logout">
              <LogOut className="h-4 w-4 mr-1.5" />
              Log out
            </Button>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
