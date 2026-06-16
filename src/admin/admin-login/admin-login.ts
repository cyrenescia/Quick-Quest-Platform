import { useState, type FormEvent } from "react";
import { persistAccessToken } from "../../app/global.service";
import {
  adminLoginCopy,
  getAdminLoginErrorMessage,
  loginAdminAccount,
  type AdminLoginSession,
} from "./admin-login.service";

export type AdminLoginViewText = typeof adminLoginCopy;

type UseAdminLoginVMParams = {
  onAdminAuthenticated: (session: AdminLoginSession) => void;
};

export function getAdminLoginViewText(): AdminLoginViewText {
  return adminLoginCopy;
}

export function useAdminLoginVM({ onAdminAuthenticated }: UseAdminLoginVMParams) {
  const [identity, setIdentityState] = useState("");
  const [password, setPasswordState] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  function setIdentity(value: string) {
    setIdentityState(value);
    if (formError) {
      setFormError("");
    }
  }

  function setPassword(value: string) {
    setPasswordState(value);
    if (formError) {
      setFormError("");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    if (!identity.trim() || !password.trim()) {
      setFormError("Identity dan password admin wajib diisi.");
      return;
    }

    setIsSubmitting(true);
    try {
      const session = await loginAdminAccount(identity, password);
      persistAccessToken(session.accessToken);
      onAdminAuthenticated(session);
    } catch (error) {
      setFormError(getAdminLoginErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return {
    identity,
    password,
    isSubmitting,
    formError,
    setIdentity,
    setPassword,
    handleSubmit,
  };
}

export function exitAdminToUserLogin(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event("qqm-exit-admin-panel"));
}
