import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign in | ReqDocs",
};

export default function LoginPage() {
  return (
    <AuthShell
      description="Open your private Document Vault, prepare a Service Pack and review your access history."
      title="Welcome back"
    >
      <LoginForm />
    </AuthShell>
  );
}
