import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import logoMindbloom from "../assets/svgs/logo-mindbloom.svg";
import { LoadingScreen } from "../components/ui/loading";

export default function LoginPage() {
  const { session, loading, user, isAdmin, accessError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? "/";

  useEffect(() => {
    if (session && user && isAdmin) {
      navigate(from, { replace: true });
    }
  }, [from, isAdmin, navigate, session, user]);

  if (loading) {
    return (
      <LoadingScreen
        eyebrow="Loading"
        title="Checking session"
        description="Verifying whether an admin session is already active."
      />
    );
  }

  if (session && user && isAdmin) {
    return <Navigate to={from} replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");
    setSubmitting(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setSubmitting(false);
      return;
    }
  };

  const handleSendReset = async () => {
    setError("");
    setNotice("");

    if (!email.trim()) {
      setError("Enter your email first, then we can send a reset link.");
      return;
    }

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setNotice("Reset link sent. Check your inbox.");
  };

  return (
    <main className="grid min-h-screen place-items-center p-4">
      <section className="w-full max-w-[560px] rounded-[28px] border border-[#e3d4c6] bg-[rgba(255,253,249,0.92)] px-6 py-5 shadow-[0_14px_36px_rgba(65,43,27,0.06)]">
        <img
          src={logoMindbloom}
          alt="MindBloom"
          className="mx-auto h-11 w-auto object-contain"
        />
        <h1 className="mt-3 text-center text-[clamp(30px,3vw,44px)] font-semibold tracking-tight text-[#2f2a24]">
          Admin login
        </h1>
        <p className="mt-2 text-center text-[15px] leading-7 text-[#7b6d5f]">
          Sign in to manage the MindBloom landing page content.
        </p>

        <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
          <label className="grid gap-2 text-sm text-[#7b6d5f]">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
              className="h-11 rounded-2xl border border-[#e3d4c6] bg-white px-4 text-sm text-[#2f2a24] outline-none placeholder:text-[#b39f8f]"
            />
          </label>

          <label className="grid gap-2 text-sm text-[#7b6d5f]">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
              className="h-11 rounded-2xl border border-[#e3d4c6] bg-white px-4 text-sm text-[#2f2a24] outline-none placeholder:text-[#b39f8f]"
            />
          </label>

          {error || accessError ? (
            <p className="rounded-2xl border border-[#e3d4c6] bg-[rgba(255,253,249,0.88)] px-4 py-3 text-sm text-[#a94135]">
              {error || accessError}
            </p>
          ) : null}

          {notice ? (
            <p className="rounded-2xl border border-[#b9d7b1] bg-[rgba(237,247,233,0.98)] px-4 py-3 text-sm text-[#35613a]">
              {notice}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              className="inline-flex h-11 items-center justify-center rounded-full bg-[#6f4f40] px-4 text-sm font-medium text-white transition-colors hover:bg-[#5d4337]"
              disabled={submitting}
            >
              {submitting ? "Signing in..." : "Sign in"}
            </button>

            <button
              type="button"
              className="inline-flex h-11 items-center justify-center rounded-full border border-[#e3d4c6] bg-white px-4 text-sm font-medium text-[#7b6d5f] transition-colors hover:bg-[#f7efe6] hover:text-[#2f2a24]"
              onClick={handleSendReset}
              disabled={submitting}
            >
              Forgot password?
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
