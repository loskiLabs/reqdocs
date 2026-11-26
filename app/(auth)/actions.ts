"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { AuthActionState, AuthFieldErrors } from "@/lib/auth/action-state";
import { getRoleHome, isUserRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

const emailSchema = z.email("Enter a valid email address.").max(254);
const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(72, "Use no more than 72 characters.")
  .regex(/[a-z]/, "Include a lowercase letter.")
  .regex(/[A-Z]/, "Include an uppercase letter.")
  .regex(/[0-9]/, "Include a number.");

const registerSchema = z
  .object({
    confirmPassword: z.string(),
    displayName: z
      .string()
      .trim()
      .min(2, "Enter at least 2 characters.")
      .max(100, "Enter no more than 100 characters."),
    email: emailSchema,
    password: passwordSchema,
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "The passwords do not match.",
    path: ["confirmPassword"],
  });

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password.").max(72),
});

function getString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function getFieldErrors(error: z.ZodError): AuthFieldErrors {
  const errors: AuthFieldErrors = {};

  for (const issue of error.issues) {
    const field = issue.path[0];

    if (
      typeof field === "string" &&
      ["confirmPassword", "displayName", "email", "password"].includes(field) &&
      !errors[field as keyof AuthFieldErrors]
    ) {
      errors[field as keyof AuthFieldErrors] = issue.message;
    }
  }

  return errors;
}

export async function registerIndividual(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const submittedValues = {
    confirmPassword: getString(formData, "confirmPassword"),
    displayName: getString(formData, "displayName"),
    email: getString(formData, "email").trim().toLowerCase(),
    password: getString(formData, "password"),
  };
  const result = registerSchema.safeParse(submittedValues);

  if (!result.success) {
    return {
      fieldErrors: getFieldErrors(result.error),
      message: "Check the highlighted fields and try again.",
      status: "error",
      values: {
        displayName: submittedValues.displayName,
        email: submittedValues.email,
      },
    };
  }

  let hasSession = false;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email: result.data.email,
      options: {
        data: {
          display_name: result.data.displayName,
        },
      },
      password: result.data.password,
    });

    if (error) {
      return {
        message: "We could not create the account. Check your details and try again.",
        status: "error",
        values: {
          displayName: result.data.displayName,
          email: result.data.email,
        },
      };
    }

    hasSession = Boolean(data.session);
  } catch {
    return {
      message: "Account creation is temporarily unavailable. Try again shortly.",
      status: "error",
      values: {
        displayName: result.data.displayName,
        email: result.data.email,
      },
    };
  }

  if (!hasSession) {
    return {
      message: "Account created. Check your email to finish signing in.",
      status: "success",
    };
  }

  redirect("/dashboard");
}

export async function signIn(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const submittedValues = {
    email: getString(formData, "email").trim().toLowerCase(),
    password: getString(formData, "password"),
  };
  const result = loginSchema.safeParse(submittedValues);

  if (!result.success) {
    return {
      fieldErrors: getFieldErrors(result.error),
      message: "Check the highlighted fields and try again.",
      status: "error",
      values: { email: submittedValues.email },
    };
  }

  let destination: "/dashboard" | "/staff";

  try {
    const supabase = await createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: result.data.email,
      password: result.data.password,
    });

    if (signInError) {
      return {
        message: "The email or password is incorrect.",
        status: "error",
        values: { email: result.data.email },
      };
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      await supabase.auth.signOut();
      return {
        message: "We could not verify this account. Try signing in again.",
        status: "error",
        values: { email: result.data.email },
      };
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile || !isUserRole(profile.role)) {
      await supabase.auth.signOut();
      return {
        message: "We could not verify this account. Try signing in again.",
        status: "error",
        values: { email: result.data.email },
      };
    }

    destination = getRoleHome(profile.role);
  } catch {
    return {
      message: "Sign in is temporarily unavailable. Try again shortly.",
      status: "error",
      values: { email: result.data.email },
    };
  }

  redirect(destination);
}

export async function signOut() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let destination: "/login" | "/staff/login" = "/login";

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role === "staff") {
      destination = "/staff/login";
    }
  }

  await supabase.auth.signOut();
  redirect(destination);
}
