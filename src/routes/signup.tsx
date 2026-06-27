import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AtSign, KeyRound, UserRound } from "lucide-react";
import { useState, type FormEvent } from "react";
import {
  AuthError,
  AuthField,
  AuthLayout,
  AuthSubmitButton,
  AuthSwitchLink,
  RoleSelector,
} from "@/components/auth/AuthLayout";
import { getAuthErrorMessage, signUp } from "@/lib/firebase/auth-service";
import type { UserRole } from "@/lib/firebase/types";
import { requireGuest } from "@/lib/route-guards";

export const Route = createFileRoute("/signup")({
  beforeLoad: requireGuest,
  head: () => ({
    meta: [
      { title: "Create Account · onboard" },
      { name: "description", content: "Register as an interviewer or admin for the onboard vetting platform." },
    ],
  }),
  component: SignUpPage,
});

function SignUpPage() {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("interviewer");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      await signUp({
        email: email.trim(),
        password,
        displayName: displayName.trim(),
        role,
      });
      navigate({ to: "/" });
    } catch (err) {
      console.log(err);
      setError(getAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Create Account"
      subtitle="Join the vetting team. Admins configure governance; interviewers score candidates across phases."
    >
      <form onSubmit={submit}>
        <div className="mb-6">
          <RoleSelector value={role} onChange={setRole} />
        </div>

        <AuthField
          icon={UserRound}
          label="Full Name"
          placeholder="Marcus Thorne"
          value={displayName}
          onChange={setDisplayName}
          autoComplete="name"
          required
        />
        <AuthField
          icon={AtSign}
          label="Corporate Email"
          placeholder="name@firm.com"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          required
        />
        <AuthField
          icon={KeyRound}
          label="Access Key"
          placeholder="Min. 6 characters"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          required
        />

        <AuthError message={error} />
        <AuthSubmitButton loading={loading}>Create Account</AuthSubmitButton>
        <AuthSwitchLink prompt="Already registered?" linkText="Sign in" to="/login" />
      </form>
    </AuthLayout>
  );
}
