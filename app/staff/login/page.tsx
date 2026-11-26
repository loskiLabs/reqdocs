import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Staff sign in | ReqDocs",
};

export default function StaffLoginPage() {
  return (
    <AuthShell
      description="Authorised staff can open one consented Service Pack with a short-lived code. Vaults and unrelated packs remain private."
      eyebrow="Staff portal"
      title="Review only what was shared"
    >
      <LoginForm staff />
    </AuthShell>
  );
}
