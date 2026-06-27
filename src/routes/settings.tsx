import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { KeyRound, Bell, Users, LogOut, ShieldCheck, Trash2, RotateCcw, FileStack } from "lucide-react";
import { useState } from "react";
import { AppShell, Toggle } from "@/components/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { signOut } from "@/lib/firebase/auth-service";
import { deleteAllEvaluations, resetAppDataExceptUsers, clearAllPositionScenariosAndQuestions } from "@/lib/firebase/admin";
import { updateUserSettings } from "@/lib/firebase/users";
import { requireAuth } from "@/lib/route-guards";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  beforeLoad: requireAuth,
  head: () => ({
    meta: [
      { title: "Settings · onboard" },
      { name: "description", content: "System configuration: security keys, role toggles, and vetting alerts." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const { profile, isAdmin, refreshProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [adminBusy, setAdminBusy] = useState(false);

  if (!profile) return null;

  const updateSetting = async (key: "vettingAlerts" | "autoLock", value: boolean) => {
    setSaving(true);
    try {
      await updateUserSettings(profile.uid, { [key]: value });
      await refreshProfile();
      toast.success("Settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate({ to: "/login" });
    } catch {
      toast.error("Sign out failed");
    }
  };

  const confirmAndRun = async (message: string, action: () => Promise<unknown>) => {
    if (!window.confirm(message)) return;
    setAdminBusy(true);
    try {
      await action();
    } catch {
      toast.error("Administrative action failed");
    } finally {
      setAdminBusy(false);
    }
  };

  const handleDeleteEvaluations = () => {
    confirmAndRun("Delete all evaluations? This cannot be undone.", async () => {
      const count = await deleteAllEvaluations();
      toast.success(`${count} evaluation${count === 1 ? "" : "s"} removed`);
    });
  };

  const handleResetApp = () => {
    confirmAndRun("Reset the app data and remove positions, candidates, and evaluations while keeping interviewer accounts intact?", async () => {
      const summary = await resetAppDataExceptUsers();
      toast.success(`Reset complete. Removed ${summary.deletedPositions} positions, ${summary.deletedCandidates} candidates, and ${summary.deletedEvaluations} evaluations. Preserved ${summary.preservedUsers} user account${summary.preservedUsers === 1 ? "" : "s"}.`);
    });
  };

  const handleClearScenarios = () => {
    confirmAndRun("Clear all scenarios and questions from every phase? This will remove the current question scaffolding from all positions.", async () => {
      const count = await clearAllPositionScenariosAndQuestions();
      toast.success(`Cleared scenarios and questions from ${count} position${count === 1 ? "" : "s"}`);
    });
  };

  return (
    <AppShell>
      <div className="bp-fade-up">
        <p className="bp-label opacity-70">System Configuration</p>
        <h1 className="mt-2 font-display text-[34px] leading-[0.95] font-extrabold tracking-tight uppercase">Settings</h1>
      </div>

      <section className="bp-card mt-5 p-5">
        <p className="bp-label">Account</p>
        <div className="mt-3 flex items-center gap-3 border-2 border-ink bg-surface-dim p-3">
          <span className="grid h-12 w-12 place-items-center border-2 border-ink bg-ink font-mono text-[14px] font-bold text-surface">
            {profile.initials}
          </span>
          <div>
            <p className="font-display font-extrabold">{profile.displayName}</p>
            <p className="bp-meta">{profile.email}</p>
            <p className="mt-1 bp-meta capitalize">{profile.role}</p>
          </div>
        </div>
      </section>

      <section className="bp-card mt-5 divide-y-2 divide-dashed divide-ink/40">
        <Row
          icon={ShieldCheck}
          title="Admin Mode"
          desc={isAdmin ? "Privileged actions enabled" : "Interviewer access only"}
          on={isAdmin}
          disabled
        />
        <Row
          icon={Bell}
          title="Vetting Alerts"
          desc="Notify on phase transitions"
          on={profile.settings.vettingAlerts}
          onChange={() => updateSetting("vettingAlerts", !profile.settings.vettingAlerts)}
          disabled={saving}
        />
        <Row
          icon={KeyRound}
          title="Auto-Lock Session"
          desc="Idle after 5 minutes"
          on={profile.settings.autoLock}
          onChange={() => updateSetting("autoLock", !profile.settings.autoLock)}
          disabled={saving}
        />
      </section>

      {isAdmin && (
        <section className="bp-card mt-5 p-5">
          <p className="bp-label">Admin Controls</p>
          <p className="mt-1 bp-meta">Use these with care. They remove data from Firestore immediately.</p>
          <div className="mt-3 grid gap-2">
            <button
              type="button"
              onClick={handleDeleteEvaluations}
              disabled={adminBusy}
              className="flex items-center justify-between border-2 border-ink px-4 py-3 text-left bp-press disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="flex items-center gap-2 font-mono text-[11px] tracking-widest uppercase"><Trash2 className="h-4 w-4" /> Clear All Evaluations</span>
              <span className="font-mono text-[11px]">Delete</span>
            </button>
            <button
              type="button"
              onClick={handleResetApp}
              disabled={adminBusy}
              className="flex items-center justify-between border-2 border-ink px-4 py-3 text-left bp-press disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="flex items-center gap-2 font-mono text-[11px] tracking-widest uppercase"><RotateCcw className="h-4 w-4" /> Reset App Data</span>
              <span className="font-mono text-[11px]">Keep users</span>
            </button>
            <button
              type="button"
              onClick={handleClearScenarios}
              disabled={adminBusy}
              className="flex items-center justify-between border-2 border-ink px-4 py-3 text-left bp-press disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="flex items-center gap-2 font-mono text-[11px] tracking-widest uppercase"><FileStack className="h-4 w-4" /> Clear Scenarios & Questions</span>
              <span className="font-mono text-[11px]">Reset content</span>
            </button>
            <button className="flex items-center justify-between border-2 border-ink px-4 py-3 bp-press">
              <span className="flex items-center gap-2 font-mono text-[11px] tracking-widest uppercase"><Users className="h-4 w-4" /> Team Roles</span>
              <span className="font-mono text-[11px]">Admin</span>
            </button>
            <button className="flex items-center justify-between border-2 border-ink px-4 py-3 bp-press">
              <span className="flex items-center gap-2 font-mono text-[11px] tracking-widest uppercase"><KeyRound className="h-4 w-4" /> Security Keys</span>
              <span className="font-mono text-[11px]">Firebase</span>
            </button>
          </div>
        </section>
      )}

      <button
        type="button"
        onClick={handleSignOut}
        className="mt-5 flex w-full items-center justify-center gap-2 border-2 border-ink bg-surface py-4 bp-press"
      >
        <LogOut className="h-4 w-4" />
        <span className="font-mono text-[11px] tracking-widest uppercase">Sign Out</span>
      </button>

      <p className="mt-6 text-center bp-meta">VER: 2.1.0_BLPT</p>
    </AppShell>
  );
}

function Row({
  icon: Icon,
  title,
  desc,
  on,
  onChange,
  disabled,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  on: boolean;
  onChange?: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-4">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center border-2 border-ink bg-surface-dim">
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <p className="font-display font-bold">{title}</p>
          <p className="bp-meta">{desc}</p>
        </div>
      </div>
      <Toggle on={on} onClick={disabled ? undefined : onChange} label={title} />
    </div>
  );
}
