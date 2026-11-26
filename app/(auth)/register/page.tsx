import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = {
  title: "Create account | ReqDocs",
};

export default function RegisterPage() {
  return (
    <AuthShell
      description="Create a private space for reusable documents and see what each supported service needs before you travel."
      title="Prepare once. Arrive ready."
    >
      <RegisterForm />
    </AuthShell>
  );
}
