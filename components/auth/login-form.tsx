"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { signIn } from "@/app/(auth)/actions";
import { initialAuthActionState } from "@/lib/auth/action-state";
import { SubmitButton } from "./submit-button";

type LoginFormProps = {
  staff?: boolean;
};

const inputClassName =
  "mt-2 min-h-12 w-full border border-slate-400 bg-white px-3 py-2 text-base text-[var(--foreground)] focus:border-[var(--primary)]";

export function LoginForm({ staff = false }: LoginFormProps) {
  const [state, formAction] = useActionState(signIn, initialAuthActionState);
  const [showPassword, setShowPassword] = useState(false);
  const errorSummaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.status === "error") {
      const focusTimer = window.setTimeout(() => {
        errorSummaryRef.current?.focus();
      }, 0);

      return () => window.clearTimeout(focusTimer);
    }
  }, [state]);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <div>
        <h2 className="text-2xl font-bold">{staff ? "Staff sign in" : "Sign in"}</h2>
        <p className="mt-2 leading-6 text-[var(--muted)]">
          Enter the email and password for your ReqDocs account.
        </p>
      </div>

      {state.status === "error" ? (
        <div
          className="border-l-4 border-red-700 bg-red-50 p-4 text-red-950"
          id="login-error-summary"
          ref={errorSummaryRef}
          role="alert"
          tabIndex={-1}
        >
          <p className="font-bold">We could not sign you in</p>
          <p className="mt-1 text-sm">{state.message}</p>
        </div>
      ) : null}

      <div>
        <label className="font-bold" htmlFor="email">
          Email address
        </label>
        <input
          aria-describedby={state.fieldErrors?.email ? "email-error" : undefined}
          aria-invalid={Boolean(state.fieldErrors?.email)}
          autoComplete="email"
          className={inputClassName}
          defaultValue={state.values?.email}
          id="email"
          inputMode="email"
          name="email"
          required
          type="email"
        />
        {state.fieldErrors?.email ? (
          <p className="mt-2 text-sm font-semibold text-red-800" id="email-error">
            {state.fieldErrors.email}
          </p>
        ) : null}
      </div>

      <div>
        <div className="flex items-center justify-between gap-4">
          <label className="font-bold" htmlFor="password">
            Password
          </label>
          <button
            aria-controls="password"
            aria-pressed={showPassword}
            className="min-h-11 px-2 text-sm font-bold text-[var(--primary)] underline-offset-4 hover:underline"
            onClick={() => setShowPassword((current) => !current)}
            type="button"
          >
            {showPassword ? "Hide password" : "Show password"}
          </button>
        </div>
        <input
          aria-describedby={
            state.fieldErrors?.password ? "password-error" : undefined
          }
          aria-invalid={Boolean(state.fieldErrors?.password)}
          autoComplete="current-password"
          className={inputClassName}
          id="password"
          name="password"
          required
          type={showPassword ? "text" : "password"}
        />
        {state.fieldErrors?.password ? (
          <p className="mt-2 text-sm font-semibold text-red-800" id="password-error">
            {state.fieldErrors.password}
          </p>
        ) : null}
      </div>

      <SubmitButton idleLabel="Sign in" pendingLabel="Signing in…" />

      {staff ? (
        <p className="text-sm leading-6 text-[var(--muted)]">
          Not a staff member?{" "}
          <Link className="font-bold text-[var(--primary)] underline" href="/login">
            Use individual sign in
          </Link>
          .
        </p>
      ) : (
        <p className="text-sm leading-6 text-[var(--muted)]">
          New to ReqDocs?{" "}
          <Link className="font-bold text-[var(--primary)] underline" href="/register">
            Create an account
          </Link>
          .
        </p>
      )}
    </form>
  );
}
