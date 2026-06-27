import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AtSign, KeyRound } from "lucide-react";
import { useState, type FormEvent } from "react";
import {
  AuthError,
  AuthField,
  AuthLayout,
  AuthSubmitButton,
  AuthSwitchLink,
} from "@/components/auth/AuthLayout";
import { getAuthErrorMessage, signIn } from "@/lib/firebase/auth-service";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { requireGuest } from "@/lib/route-guards";

export const Route = createFileRoute("/login")({
  beforeLoad: requireGuest,
  head: () => ({
    meta: [
      { title: "Sign In · onboard" },
      { name: "description", content: "Internal access portal for interviewers and admin interviewers." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      navigate({ to: "/" });
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Sign In"
      subtitle="Access the high-precision vetting companion. Evaluate candidates with administrative governance."
    >
      <form onSubmit={submit}>
        {!isFirebaseConfigured() && (
          <div className="mb-4 border-2 border-dashed border-ink/50 bg-surface-dim px-3 py-2">
            <p className="bp-meta leading-relaxed">
              Copy <code className="font-mono">.env.example</code> to <code className="font-mono">.env</code> and add your Firebase credentials.
            </p>
          </div>
        )}
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
          placeholder="••••••••••••"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          required
        />

        <AuthError message={error} />
        <AuthSubmitButton loading={loading}>Sign In</AuthSubmitButton>
        <AuthSwitchLink prompt="New to onboard?" linkText="Create account" to="/signup" />
      </form>
    </AuthLayout>
  );
}
