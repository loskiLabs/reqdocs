"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { registerIndividual } from "@/app/(auth)/actions";
import { initialAuthActionState } from "@/lib/auth/action-state";
import { SubmitButton } from "./submit-button";

const inputClassName =
  "mt-2 min-h-12 w-full border border-slate-400 bg-white px-3 py-2 text-base text-[var(--foreground)] focus:border-[var(--primary)]";

export function RegisterForm() {
  const [state, formAction] = useActionState(
    registerIndividual,
    initialAuthActionState,
  );
  const [showPasswords, setShowPasswords] = useState(false);
  const statusSummaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.status !== "idle") {
      const focusTimer = window.setTimeout(() => {
        statusSummaryRef.current?.focus();
      }, 0);

      return () => window.clearTimeout(focusTimer);
    }
  }, [state]);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <div>
        <h2 className="text-2xl font-bold">Create your account</h2>
        <p className="mt-2 leading-6 text-[var(--muted)]">
          Public accounts are always created for individual users.
        </p>
      </div>

      {state.status !== "idle" ? (
        <div
          className={
            state.status === "success"
              ? "border-l-4 border-green-700 bg-green-50 p-4 text-green-950"
              : "border-l-4 border-red-700 bg-red-50 p-4 text-red-950"
          }
          id="registration-status-summary"
          ref={statusSummaryRef}
          role={state.status === "error" ? "alert" : "status"}
          tabIndex={-1}
        >
          <p className="font-bold">
            {state.status === "success" ? "Account created" : "Check your details"}
          </p>
          <p className="mt-1 text-sm">{state.message}</p>
        </div>
      ) : null}

      <div>
        <label className="font-bold" htmlFor="displayName">
          Display name
        </label>
        <input
          aria-describedby={
            state.fieldErrors?.displayName ? "display-name-error" : undefined
          }
          aria-invalid={Boolean(state.fieldErrors?.displayName)}
          autoComplete="name"
          className={inputClassName}
          defaultValue={state.values?.displayName}
          id="displayName"
          maxLength={100}
          name="displayName"
          required
          type="text"
        />
        {state.fieldErrors?.displayName ? (
          <p
            className="mt-2 text-sm font-semibold text-red-800"
            id="display-name-error"
          >
            {state.fieldErrors.displayName}
          </p>
        ) : null}
      </div>

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

      <fieldset className="space-y-5">
        <legend className="font-bold">Choose a password</legend>
        <p className="text-sm leading-6 text-[var(--muted)]" id="password-help">
          Use 8–72 characters with an uppercase letter, a lowercase letter and a
          number.
        </p>

        <div>
          <div className="flex items-center justify-between gap-4">
            <label className="font-bold" htmlFor="password">
              Password
            </label>
            <button
              aria-controls="password confirmPassword"
              aria-pressed={showPasswords}
              className="min-h-11 px-2 text-sm font-bold text-[var(--primary)] underline-offset-4 hover:underline"
              onClick={() => setShowPasswords((current) => !current)}
              type="button"
            >
              {showPasswords ? "Hide passwords" : "Show passwords"}
            </button>
          </div>
          <input
            aria-describedby={`password-help${state.fieldErrors?.password ? " password-error" : ""}`}
            aria-invalid={Boolean(state.fieldErrors?.password)}
            autoComplete="new-password"
            className={inputClassName}
            id="password"
            maxLength={72}
            name="password"
            required
            type={showPasswords ? "text" : "password"}
          />
          {state.fieldErrors?.password ? (
            <p
              className="mt-2 text-sm font-semibold text-red-800"
              id="password-error"
            >
              {state.fieldErrors.password}
            </p>
          ) : null}
        </div>

        <div>
          <label className="font-bold" htmlFor="confirmPassword">
            Confirm password
          </label>
          <input
            aria-describedby={
              state.fieldErrors?.confirmPassword
                ? "confirm-password-error"
                : undefined
            }
            aria-invalid={Boolean(state.fieldErrors?.confirmPassword)}
            autoComplete="new-password"
            className={inputClassName}
            id="confirmPassword"
            maxLength={72}
            name="confirmPassword"
            required
            type={showPasswords ? "text" : "password"}
          />
          {state.fieldErrors?.confirmPassword ? (
            <p
              className="mt-2 text-sm font-semibold text-red-800"
              id="confirm-password-error"
            >
              {state.fieldErrors.confirmPassword}
            </p>
          ) : null}
        </div>
      </fieldset>

      <SubmitButton idleLabel="Create account" pendingLabel="Creating account…" />

      <p className="text-sm leading-6 text-[var(--muted)]">
        Already have an account?{" "}
        <Link className="font-bold text-[var(--primary)] underline" href="/login">
          Sign in
        </Link>
        .
      </p>
    </form>
  );
}
