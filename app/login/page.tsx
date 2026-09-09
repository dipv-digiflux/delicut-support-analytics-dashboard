"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";

function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") || "/dashboard";
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error?.message || "Login failed");
        return;
      }
      router.replace(next.startsWith("/") ? next : "/dashboard");
      router.refresh();
    } catch {
      setError("Network error — try again");
    } finally {
      setPending(false);
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm"
    >
      <h1 className="text-xl font-bold text-[var(--brand-ink)]">Admin sign in</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Delicut Support Analytics is restricted. Use your admin ID and password.
      </p>

      <label className="mt-5 block text-xs font-medium text-[var(--muted)]">
        Admin ID
        <input
          autoFocus
          autoComplete="username"
          className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </label>
      <label className="mt-3 block text-xs font-medium text-[var(--muted)]">
        Password
        <input
          type="password"
          autoComplete="current-password"
          className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>

      {error && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-5 w-full rounded-lg bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-hover)] disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[linear-gradient(160deg,#fff5f5_0%,#f5f6f8_45%,#ffffff_100%)] px-4">
      <div className="mb-6">
        <Image
          src="/logo.png"
          alt="Delicut"
          width={160}
          height={48}
          className="h-10 w-auto object-contain"
          priority
        />
      </div>
      <Suspense fallback={<div className="h-64 w-full max-w-sm animate-pulse rounded-2xl bg-white" />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
