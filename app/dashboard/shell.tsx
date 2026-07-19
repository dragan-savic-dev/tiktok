"use client";

import { useState, type ComponentType, type SVGProps } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChartIcon,
  CloseIcon,
  GridIcon,
  LogoutIcon,
  MenuIcon,
  TikTokIcon,
  TrendUpIcon,
  VerifiedIcon,
  VideoIcon,
} from "@/app/components/icons";
import InstallButton from "@/app/components/install-button";
import LanguageSwitcher from "@/app/components/language-switcher";
import LiveIndicator from "@/app/components/live-indicator";
import { useT } from "@/app/components/locale-provider";
import StatsProvider, { useStats } from "./stats-context";

interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Match esatto (voce "Panoramica") o per prefisso (sottopagine). */
  exact?: boolean;
}

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: GridIcon, exact: true },
  { href: "/dashboard/growth", label: "Growth", icon: TrendUpIcon },
  { href: "/dashboard/video", label: "Videos", icon: VideoIcon },
  { href: "/dashboard/analytics", label: "Analytics", icon: ChartIcon },
];

function isActive(pathname: string, item: NavItem): boolean {
  return item.exact ? pathname === item.href : pathname.startsWith(item.href);
}

/** Card profilo in cima alla sidebar (avatar + nome), come nella dashboard di riferimento. */
function SidebarProfile() {
  const { stats } = useStats();
  const t = useT();
  const user = stats?.user;
  const avatar = user?.avatar_large_url ?? user?.avatar_url;

  return (
    <div className="flex flex-col items-center gap-2 px-4 py-5 text-center">
      <div className="relative">
        <div
          className="absolute -inset-1 rounded-full bg-gradient-to-tr from-tt-cyan via-tt-cyan/40 to-tt-pink opacity-70 blur-md"
          aria-hidden="true"
        />
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element -- avatar da CDN TikTok con URL a scadenza
          <img
            src={avatar}
            alt={user?.display_name ?? t("Profile")}
            className="relative h-16 w-16 rounded-full border-2 border-black object-cover"
          />
        ) : (
          <div className="relative h-16 w-16 rounded-full border-2 border-black bg-zinc-800" />
        )}
      </div>
      <div className="flex flex-col items-center gap-0.5">
        <div className="flex items-center gap-1">
          <span className="font-semibold text-white">
            {user?.display_name ?? t("Profile")}
          </span>
          {user?.is_verified && <VerifiedIcon className="h-4 w-4 text-tt-cyan" />}
        </div>
        {user?.username && (
          <span className="text-xs text-zinc-500">@{user.username}</span>
        )}
        {user?.bio_description && (
          <p className="mt-1 line-clamp-2 max-w-[13rem] text-xs text-zinc-600">
            {user.bio_description}
          </p>
        )}
      </div>
    </div>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const t = useT();
  return (
    <nav className="flex flex-col gap-1 px-3">
      {NAV.map((item) => {
        const active = isActive(pathname, item);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
              active
                ? "bg-gradient-to-r from-tt-pink/20 to-tt-cyan/10 text-white shadow-[inset_2px_0_0_var(--color-tt-pink)]"
                : "text-zinc-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            <Icon className={`h-5 w-5 ${active ? "text-tt-pink" : ""}`} />
            {t(item.label)}
          </Link>
        );
      })}
    </nav>
  );
}

/** LiveIndicator che legge il tick dal contesto condiviso. */
function HeaderLive() {
  const { tick, error } = useStats();
  return <LiveIndicator tick={tick} error={!!error} />;
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const t = useT();
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-5 py-5 font-semibold text-white">
        <TikTokIcon className="h-6 w-6" />
        <span>
          TikTok <span className="text-tt-cyan">Stats</span>
        </span>
      </div>
      <SidebarProfile />
      <div className="mt-2 flex-1 overflow-y-auto">
        <NavLinks onNavigate={onNavigate} />
      </div>
      <div className="border-t border-white/5 p-3">
        <a
          href="/api/auth/logout"
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
        >
          <LogoutIcon className="h-5 w-5" />
          {t("Log out")}
        </a>
      </div>
    </div>
  );
}

function ShellChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const t = useT();
  // I link della sidebar chiudono il drawer via onNavigate al click.
  const [drawerOpen, setDrawerOpen] = useState(false);

  const active = NAV.find((item) => isActive(pathname, item));
  const title = t(active?.label ?? "Dashboard");

  // Solo la lista Video usa lo shell ad altezza fissa (tabella scrollabile
  // internamente). Il dettaglio e le altre pagine scrollano come documento.
  const fixedHeight = pathname === "/dashboard/video";

  return (
    <div className={`flex bg-[#050505] ${fixedHeight ? "h-dvh overflow-hidden" : "min-h-dvh"}`}>
      {/* Sidebar fissa su desktop */}
      <aside
        className={`hidden w-64 shrink-0 border-r border-white/5 bg-[#0a0a0a] md:block ${
          fixedHeight ? "h-full" : "sticky top-0 h-dvh"
        }`}
      >
        <SidebarContent />
      </aside>

      {/* Drawer mobile: sempre montato, animato via transizioni. `inert` quando
          chiuso lo esclude da focus e pointer (React 19). */}
      <div
        className={`fixed inset-0 z-40 md:hidden ${drawerOpen ? "" : "pointer-events-none"}`}
        inert={!drawerOpen}
      >
        <button
          aria-label={t("Close menu")}
          onClick={() => setDrawerOpen(false)}
          className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
            drawerOpen ? "opacity-100" : "opacity-0"
          }`}
        />
        <div
          className={`absolute left-0 top-0 h-full w-72 max-w-[80%] border-r border-white/10 bg-[#0a0a0a] shadow-2xl transition-transform duration-300 ease-out ${
            drawerOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <button
            aria-label={t("Close menu")}
            onClick={() => setDrawerOpen(false)}
            className="absolute right-3 top-4 rounded-lg p-1.5 text-zinc-400 hover:bg-white/5 hover:text-white"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
          <SidebarContent onNavigate={() => setDrawerOpen(false)} />
        </div>
      </div>

      <div className={`flex min-w-0 flex-1 flex-col ${fixedHeight ? "h-full" : ""}`}>
        {/* Header */}
        <header
          className={`z-30 shrink-0 border-b border-white/5 bg-[#050505]/80 backdrop-blur-md ${
            fixedHeight ? "" : "sticky top-0"
          }`}
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
            <div className="flex items-center gap-3">
              <button
                aria-label={t("Open menu")}
                onClick={() => setDrawerOpen(true)}
                className="rounded-lg p-1.5 text-zinc-300 hover:bg-white/5 hover:text-white md:hidden"
              >
                <MenuIcon className="h-5 w-5" />
              </button>
              <h1 className="text-base font-semibold text-white sm:text-lg">{title}</h1>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <HeaderLive />
              <LanguageSwitcher />
              <InstallButton compact />
            </div>
          </div>
        </header>

        <main
          className={`min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-6 ${
            fixedHeight ? "min-h-0 overflow-y-auto" : ""
          }`}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <StatsProvider>
      <ShellChrome>{children}</ShellChrome>
    </StatsProvider>
  );
}
