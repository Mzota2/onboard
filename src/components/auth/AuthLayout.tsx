import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { LogoMark, Wordmark } from "@/components/AppShell";

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle: string;
  footer?: ReactNode;
}

export function AuthLayout({ children, title, subtitle, footer }: AuthLayoutProps) {
  return (
    <div className="relative min-h-screen bg-background bp-grid-auth">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-surface to-transparent" />
      <div className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col px-4 py-6">
        <header className="relative bp-card bp-card-shadow-sm grid h-28 place-items-center bp-fade-up">
          <div className="flex items-center gap-3">
            <LogoMark className="h-7 w-7" />
            <Wordmark className="text-xl" />
          </div>
          <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-ink/10" aria-hidden />
        </header>

        <section className="bp-card relative mt-[-2px] flex-1 border-t-0 px-5 py-6 bp-fade-up">
          <div className="mb-6 border-b-2 border-dashed border-ink/25 pb-5">
            <p className="bp-label mb-2">Secure Access</p>
            <h1 className="font-display text-[32px] leading-[0.95] font-extrabold tracking-tight uppercase">
              {title}
            </h1>
            <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{subtitle}</p>
          </div>
          {children}
        </section>

        <footer className="flex items-center justify-between border-2 border-t-0 border-ink bg-surface-dim px-4 py-3">
          <p className="bp-meta">VER: 2.1.0_BLPT</p>
          {footer ?? <span className="bp-meta">Internal use only</span>}
        </footer>
      </div>
    </div>
  );
}

export function AuthField({
  icon: Icon,
  label,
  placeholder,
  type = "text",
  value,
  onChange,
  autoComplete,
  required,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  placeholder: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <div className="mt-5">
      <label className="bp-label mb-2 block">{label}</label>
      <div className="relative group">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          className="block w-full border-2 border-ink bg-surface px-4 py-3.5 pr-12 font-sans text-[15px] transition-colors placeholder:text-muted-foreground/70 focus:bg-surface-dim focus:outline-none focus:ring-2 focus:ring-ink/20"
        />
        <Icon className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground group-focus-within:text-ink" />
      </div>
    </div>
  );
}

export function AuthError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="mt-5 border-2 border-alert bg-alert/10 px-4 py-3" role="alert">
      <p className="font-mono text-[11px] uppercase tracking-wider text-alert">{message}</p>
    </div>
  );
}

export function AuthSubmitButton({ loading, children }: { loading?: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="mt-8 flex w-full items-center justify-center gap-2 border-2 border-ink bg-ink py-4 text-center font-mono text-[13px] tracking-[0.18em] uppercase text-surface bp-press disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? (
        <>
          <span className="h-4 w-4 animate-spin border-2 border-surface border-t-transparent" />
          Processing
        </>
      ) : (
        children
      )}
    </button>
  );
}

export function AuthSwitchLink({ prompt, linkText, to }: { prompt: string; linkText: string; to: string }) {
  return (
    <p className="mt-6 text-center text-[14px] text-muted-foreground">
      {prompt}{" "}
      <Link to={to} className="font-semibold text-ink underline-offset-4 hover:underline">
        {linkText}
      </Link>
    </p>
  );
}

export function RoleSelector({
  value,
  onChange,
}: {
  value: "interviewer" | "admin";
  onChange: (role: "interviewer" | "admin") => void;
}) {
  return (
    <div>
      <p className="bp-label mb-3">Access Role</p>
      <div className="grid grid-cols-2 border-2 border-ink">
        {(["interviewer", "admin"] as const).map((role) => (
          <button
            type="button"
            key={role}
            onClick={() => onChange(role)}
            className={
              "py-3.5 font-display text-[14px] font-bold transition-colors " +
              (value === role ? "bg-ink text-surface" : "bg-surface bp-press hover:bg-surface-dim") +
              (role === "interviewer" ? " border-r-2 border-ink" : "")
            }
          >
            {role === "interviewer" ? "Interviewer" : "Admin"}
          </button>
        ))}
      </div>
      <p className="mt-2 bp-meta">
        {value === "admin"
          ? "Full governance: consent gates, promotion, and result release."
          : "Evaluate candidates against defined criteria in each phase."}
      </p>
    </div>
  );
}
