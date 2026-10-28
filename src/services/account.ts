
export interface AuthUser {
  $id: string;
  name: string;
  email: string;
  emailVerification: boolean;
  hasProfilePicture?: boolean;
  profilePictureUpdatedAt?: number;
}

export class AuthError extends Error {
  code: number;
  type: string;

  constructor(message: string, code = 500, type = "auth_error") {
    super(message);
    this.name = "AuthError";
    this.code = code;
    this.type = type;
  }
}

export const isAuthConfigured = true;

async function request<T>(
  url: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: "same-origin",
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers || {}),
    },
  });

  const payload = await response.json().catch(() => null) as
    | { user?: AuthUser; error?: string; code?: string }
    | null;

  if (!response.ok) {
    throw new AuthError(
      payload?.error || `Account request failed (${response.status}).`,
      response.status,
      payload?.code || (response.status === 401 ? "unauthorized" : "auth_error"),
    );
  }

  return payload as unknown as T;
}

export const ID = {
  unique(): string {
    return (
      globalThis.crypto?.randomUUID?.() ||
      `${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
  },
};

export const account = {
  async get(): Promise<AuthUser> {
    const result = await request<{ user: AuthUser }>(
      "/api/auth/me",
    );
    return result.user;
  },

  async create(input: {
    name: string;
    email: string;
    password: string;
  }): Promise<{
    user: AuthUser;
    verificationSent: boolean;
    message: string;
  }> {
    const result = await request<{
      user: AuthUser;
      verificationSent?: boolean;
      message?: string;
    }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name: input.name,
        email: input.email,
        password: input.password,
      }),
    });

    if (!result.user || result.user.emailVerification === true || result.verificationSent !== true) {
      throw new AuthError(
        "The server did not confirm that email verification is pending. Please try again.",
        503,
        "verification_not_sent",
      );
    }

    return {
      user: result.user,
      verificationSent: true,
      message:
        typeof result.message === "string" && result.message.trim()
          ? result.message
          : "Registration is pending email verification.",
    };
  },

  async createEmailPasswordSession(input: {
    email: string;
    password: string;
  }): Promise<{ userId: string }> {
    const result = await request<{ user: AuthUser }>(
      "/api/auth/login",
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
    return { userId: result.user.$id };
  },

  async createVerification(input: { email: string; url: string }): Promise<void> {
    await request("/api/auth/verification/request", {
      method: "POST",
      body: JSON.stringify({
        email: input.email.trim(),
        url: input.url,
      }),
    });
  },

  async updateVerification(input: {
    userId: string;
    secret: string;
  }): Promise<AuthUser> {
    const result = await request<{ user: AuthUser }>(
      "/api/auth/verification/confirm",
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
    return result.user;
  },

  async createRecovery(input: {
    email: string;
    url: string;
  }): Promise<void> {
    await request("/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async updateRecovery(input: {
    userId: string;
    secret: string;
    password: string;
  }): Promise<void> {
    await request("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async deleteSession(_input: {
    sessionId: string;
  }): Promise<void> {
    await request("/api/auth/logout", {
      method: "POST",
      body: JSON.stringify({}),
    });
  },

  async updateName(input: { name: string }): Promise<AuthUser> {
    const result = await request<{ user: AuthUser }>(
      "/api/auth/profile",
      {
        method: "PATCH",
        body: JSON.stringify(input),
      },
    );
    return result.user;
  },

  async updateProfilePicture(image: string): Promise<AuthUser> {
  const result = await request<{ user: AuthUser }>(
    "/api/auth/profile-picture",
    {
      method: "PATCH",
      body: JSON.stringify({ image }),
    },
  );

  return result.user;
},

async removeProfilePicture(): Promise<AuthUser> {
  const result = await request<{ user: AuthUser }>(
    "/api/auth/profile-picture",
    {
      method: "DELETE",
      body: JSON.stringify({}),
    },
  );

  return result.user;
},
};
