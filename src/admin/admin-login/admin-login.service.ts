import GlobalEndpoint, {
  ApiRequestError,
  clearAccessToken,
  postJson,
  requestJson,
} from "../../app/global.service";

export type AdminLoginRequestPayload = {
  identity: string;
  password: string;
};

export type AdminLoginResponse = {
  success: boolean;
  message: string;
  data?: {
    session?: {
      accessToken?: string;
      issuedAt?: number;
      expiresAt?: number;
      user?: {
        id?: string;
        username?: string;
        email?: string;
        phone?: string;
        fullname?: string;
      };
    };
    authorization?: string;
    user_role?: string;
  };
};

export type AdminLoginSession = {
  accessToken: string;
  authorization: string;
  email: string;
  username: string;
};

export const adminLoginCopy = {
  title: "Admin Login",
  subtitle:
    "Masuk ulang memakai akun admin/root untuk membuka panel operasional internal QuickQuest.",
  identityLabel: "Email / Username / No. HP Admin",
  passwordLabel: "Password Admin",
  submitLabel: "Masuk Admin Side",
  submittingLabel: "Memeriksa akses...",
  backToUserLoginLabel: "Kembali ke Login User",
  unauthorizedMessage: "Akun tidak ditemukan.",
};

export function isAdminAuthorization(value: string | undefined): boolean {
  switch ((value ?? "").trim().toLowerCase()) {
    case "admin":
    case "root":
    case "compliance":
      return true;
    default:
      return false;
  }
}

export async function loginAdminAccount(
  identity: string,
  password: string,
): Promise<AdminLoginSession> {
  const payload: AdminLoginRequestPayload = {
    identity: identity.trim(),
    password,
  };

  if (!payload.identity || !payload.password.trim()) {
    throw new ApiRequestError("Identity dan password admin wajib diisi.", 400);
  }

  const response = await postJson<AdminLoginRequestPayload, AdminLoginResponse>(
    GlobalEndpoint().auth.login,
    payload,
  );

  const authorization = response.data?.authorization?.trim() || "user";
  const accessToken = response.data?.session?.accessToken?.trim() ?? "";
  if (!response.success || !accessToken) {
    throw new ApiRequestError(response.message || "Login admin tidak valid.", 500);
  }

  if (!isAdminAuthorization(authorization)) {
    clearAccessToken();
    try {
      await requestJson(GlobalEndpoint().auth.logout, { method: "POST" });
    } catch {
      // Best effort cleanup. Backend admin guard tetap menolak akun non-admin.
    }
    throw new ApiRequestError(adminLoginCopy.unauthorizedMessage, 404);
  }

  return {
    accessToken,
    authorization,
    email: response.data?.session?.user?.email ?? "",
    username: response.data?.session?.user?.username ?? "",
  };
}

export function getAdminLoginErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError || error instanceof Error) {
    return error.message;
  }

  return "Login admin gagal diproses.";
}
