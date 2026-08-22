"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { Button, Wordmark } from "@/components/ui";

export default function LoginPage() {
  const { token, isLoading } = useAuth();
  const router = useRouter();
  const [showEmailNotice, setShowEmailNotice] = useState(false);

  useEffect(() => {
    if (!isLoading && token) router.replace("/dashboard");
  }, [isLoading, token, router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white px-4">
      <div className="mb-8">
        <Wordmark />
      </div>

      <div className="w-full max-w-sm rounded-2xl border border-ink-200 px-8 py-10 shadow-card">
        <h1 className="mb-6 text-center text-3xl font-bold text-ink-900">Login</h1>

        <Button
          variant="google"
          className="w-full justify-center"
          onClick={() => {
            window.location.href = api.googleLoginUrl();
          }}
        >
          <GoogleIcon />
          Login with Google
        </Button>

        <div className="my-5 flex items-center gap-3 text-xs text-ink-500">
          <div className="h-px flex-1 bg-ink-200" />
          or sign up through email
          <div className="h-px flex-1 bg-ink-200" />
        </div>

        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            setShowEmailNotice(true);
          }}
        >
          <input type="email" placeholder="Email ID" autoComplete="email" className="field-input" />
          <input
            type="password"
            placeholder="Password"
            autoComplete="current-password"
            className="field-input"
          />
          <Button type="submit" className="w-full justify-center">
            Login
          </Button>
        </form>

        {showEmailNotice && (
          <p className="mt-3 text-center text-xs text-ink-500">
            Email/password sign-in isn&apos;t available in this build — please continue with
            Google above.
          </p>
        )}
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#4285F4"
        d="M45.1 24.5c0-1.6-.1-3.1-.4-4.6H24v9.1h11.9c-.5 2.7-2.1 5.1-4.4 6.6v5.5h7.1c4.1-3.8 6.5-9.4 6.5-16.6z"
      />
      <path
        fill="#34A853"
        d="M24 46c6 0 11-2 14.6-5.4l-7.1-5.5c-2 1.3-4.5 2.1-7.5 2.1-5.8 0-10.7-3.9-12.4-9.1H4.3v5.7C7.9 41.1 15.4 46 24 46z"
      />
      <path fill="#FBBC05" d="M11.6 28.1c-.4-1.3-.7-2.7-.7-4.1s.3-2.8.7-4.1v-5.7H4.3C2.8 17.1 2 20.5 2 24s.8 6.9 2.3 9.8z" />
      <path
        fill="#EA4335"
        d="M24 10.8c3.3 0 6.2 1.1 8.5 3.3l6.3-6.3C34.9 4.1 29.9 2 24 2 15.4 2 7.9 6.9 4.3 14.2l7.3 5.7c1.7-5.2 6.6-9.1 12.4-9.1z"
      />
    </svg>
  );
}
