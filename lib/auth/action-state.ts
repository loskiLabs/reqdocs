export type AuthFieldErrors = Partial<
  Record<"confirmPassword" | "displayName" | "email" | "password", string>
>;

export type AuthActionState = {
  fieldErrors?: AuthFieldErrors;
  message?: string;
  status: "idle" | "error" | "success";
  values?: {
    displayName?: string;
    email?: string;
  };
};

export const initialAuthActionState: AuthActionState = {
  status: "idle",
};
