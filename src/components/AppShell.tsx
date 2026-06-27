import { Link, useRouterState } from "@tanstack/react-router";
import { Workflow, Users, Settings as SettingsIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";

export function AppShell({ children, hideNav = false }: { children: ReactNode; hideNav?: boolean }) {
  const path = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen bg-background bp-dots">
      <TopBar />
      <main className="mx-auto w-full max-w-[480px] px-4 pt-4 pb-28">{children}</main>
      {!hideNav && <BottomNav path={path} />}
    </div>
  );
}

function TopBar() {
  const { profile, isAdmin } = useAuth();
  const initials = profile?.initials ?? "??";

  return (
    <header className="sticky top-0 z-40 border-b-2 border-ink bg-surface/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[480px] items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <LogoMark className="h-5 w-5" />
          <span className="font-display text-[15px] font-bold tracking-tight uppercase">Onboard</span>
        </Link>
        <Link
          to="/settings"
          className="relative grid h-9 w-9 place-items-center border-2 border-ink bg-surface-dim font-mono text-[10px] font-bold"
          aria-label="Profile"
        >
          {initials}
          {isAdmin && (
            <span className="absolute -right-1 -top-1 h-2.5 w-2.5 border border-surface bg-ink" title="Admin" />
          )}
        </Link>
      </div>
    </header>
  );
}

function BottomNav({ path }: { path: string }) {
  const items = [
    { to: "/", label: "Pipeline", icon: Workflow },
    { to: "/candidate", label: "Candidates", icon: Users },
    { to: "/settings", label: "Settings", icon: SettingsIcon },
  ] as const;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-ink bg-surface">
      <div className="mx-auto grid max-w-[480px] grid-cols-3">
        {items.map(({ to, label, icon: Icon }) => {
          const active = to === "/" ? path === "/" : path.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              className={
                "flex flex-col items-center gap-1 px-2 py-3 text-[10px] font-mono uppercase tracking-wider " +
                (active ? "bg-ink text-surface" : "text-foreground hover:bg-surface-dim")
              }
            >
              <Icon className="h-4 w-4" strokeWidth={2.25} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function LogoMark({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.25">
      <path d="M3 20 L12 4 L21 20" strokeLinejoin="miter" />
      <circle cx="12" cy="14" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <div className={"inline-flex items-baseline gap-0.5 font-display font-extrabold tracking-tight " + className}>
      <span>onboard</span>
      <span className="relative inline-block">
        <span className="invisible">o</span>
        <span
          aria-hidden
          className="absolute inset-0 grid place-items-center"
          style={{ transform: "translate(-22%, 0)" }}
        >
          ◐
        </span>
      </span>
    </div>
  );
}

/* Reusable bits */
export function ScoreBlocks({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <span className="inline-flex items-center gap-1">
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} className="bp-score-block" data-filled={i < value} />
      ))}
    </span>
  );
}

export function Toggle({ on, onClick, label }: { on: boolean; onClick?: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      aria-label={label}
      className="relative inline-flex h-7 w-14 items-center border-2 border-ink bg-surface bp-press"
    >
      <span
        className={
          "block h-[22px] w-[22px] transition-transform " +
          (on ? "translate-x-[28px] bg-ink" : "translate-x-[2px] bg-ink")
        }
      />
      <span className="absolute inset-0 flex justify-between px-1.5 font-mono text-[8px] font-bold">
        <span className={on ? "text-ink" : "opacity-0"}>ON</span>
        <span className={on ? "opacity-0" : "text-ink"}>OFF</span>
      </span>
    </button>
  );
}

export function Tag({ children, variant = "default" }: { children: ReactNode; variant?: "default" | "solid" | "alert" }) {
  const cls =
    variant === "solid"
      ? "bg-ink text-surface"
      : variant === "alert"
        ? "bg-[oklch(0.6_0.24_25)] text-surface"
        : "bg-surface text-ink border-2 border-ink";
  return (
    <span className={"inline-flex items-center gap-1 px-2 py-1 font-mono text-[10px] uppercase tracking-widest " + cls}>
      {children}
    </span>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="bp-label">{children}</span>
      <span className="h-px flex-1 bg-ink/20" />
    </div>
  );
}
