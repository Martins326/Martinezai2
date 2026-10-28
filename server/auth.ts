
import type { Express, Request, Response, RequestHandler } from "express";
import {
  randomBytes,
  randomUUID,
  scrypt as scryptCallback,
  createHash,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import {
  mkdir,
  readFile,
  rename,
  unlink,
  writeFile,
  readdir,
} from "node:fs/promises";
import path from "node:path";
import nodemailer from "nodemailer";

const scrypt = promisify(scryptCallback);

const SESSION_COOKIE = "martinezai_session";
const SESSION_LIFETIME_SECONDS = 60 * 60 * 24 * 30;
const RESET_LIFETIME_MS = 30 * 60 * 1000;
const VERIFY_LIFETIME_MS = 24 * 60 * 60 * 1000;

type PublicUser = {
  $id: string;
  name: string;
  email: string;
  emailVerification: boolean;
  hasProfilePicture?: boolean;
  profilePictureUpdatedAt?: number;
};

type UserRecord = PublicUser & {
  passwordHash: string;
  createdAt: number;
  updatedAt: number;
  profilePictureDataUrl?: string;
  profilePictureUpdatedAt?: number;
};

type SessionRecord = {
  userId: string;
  expiresAt: number;
  createdAt: number;
};

type TokenRecord = {
  userId: string;
  expiresAt: number;
  purpose: "reset" | "verify";
};

function authRoot(): string {
  return path.resolve(
    process.env.MARTINEZAI_AUTH_DIR ||
      path.join(process.cwd(), "data", "auth"),
  );
}

function collection(name: string): string {
  return path.join(authRoot(), name);
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function userFile(id: string): string {
  return path.join(collection("users"), `${digest(id)}.json`);
}

function emailFile(email: string): string {
  return path.join(
    collection("email-index"),
    `${digest(email.trim().toLowerCase())}.json`,
  );
}

function sessionFile(token: string): string {
  return path.join(collection("sessions"), `${digest(token)}.json`);
}

function resetFile(token: string): string {
  return path.join(collection("reset-tokens"), `${digest(token)}.json`);
}

function verifyFile(token: string): string {
  return path.join(collection("verify-tokens"), `${digest(token)}.json`);
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function writeJsonAtomic(
  file: string,
  value: unknown,
): Promise<void> {
  await mkdir(path.dirname(file), {
    recursive: true,
    mode: 0o700,
  });

  const temporary = `${file}.${randomUUID()}.tmp`;

  try {
    await writeFile(temporary, JSON.stringify(value), {
      encoding: "utf8",
      mode: 0o600,
      flag: "wx",
    });

    await rename(temporary, file);
  } catch (error) {
    await unlink(temporary).catch(() => undefined);
    throw error;
  }
}

function publicUser(user: UserRecord): PublicUser {
  return {
    $id: user.$id,
    name: user.name,
    email: user.email,
    emailVerification: user.emailVerification,
    hasProfilePicture: Boolean(user.profilePictureDataUrl),
    ...(typeof user.profilePictureUpdatedAt === "number"
      ? { profilePictureUpdatedAt: user.profilePictureUpdatedAt }
      : {}),
  };
}

function normalizeEmail(value: unknown): string {
  return typeof value === "string"
    ? value.trim().toLowerCase()
    : "";
}

function validEmail(email: string): boolean {
  return (
    email.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  );
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;

  return `scrypt$${salt}$${derived.toString("hex")}`;
}

async function verifyPassword(
  password: string,
  encoded: string,
): Promise<boolean> {
  const [algorithm, salt, storedHex] = encoded.split("$");

  if (
    algorithm !== "scrypt" ||
    !salt ||
    !storedHex ||
    !/^[a-f0-9]+$/i.test(storedHex)
  ) {
    return false;
  }

  const stored = Buffer.from(storedHex, "hex");
  const derived = (await scrypt(
    password,
    salt,
    stored.length,
  )) as Buffer;

  return (
    stored.length === derived.length &&
    timingSafeEqual(stored, derived)
  );
}

function sessionTokenFromRequest(req: Request): string | null {
  const cookie = req.headers.cookie || "";

  for (const part of cookie.split(";")) {
    const [name, ...rest] = part.trim().split("=");

    if (name === SESSION_COOKIE) {
      try {
        return decodeURIComponent(rest.join("="));
      } catch {
        return null;
      }
    }
  }

  return null;
}

function setSessionCookie(res: Response, token: string): void {
  const secure =
    process.env.NODE_ENV === "production" ||
    process.env.COOKIE_SECURE === "true";

  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_LIFETIME_SECONDS}${secure ? "; Secure" : ""}`,
  );
}

function clearSessionCookie(res: Response): void {
  const secure =
    process.env.NODE_ENV === "production" ||
    process.env.COOKIE_SECURE === "true";

  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`,
  );
}

function assertSameOrigin(req: Request, res: Response): boolean {
  const origin = req.get("Origin");

  if (!origin) return true;

  try {
    const parsed = new URL(origin);

    if (parsed.host !== req.get("host")) {
      res.status(403).json({
        error: "This request origin is not allowed.",
      });
      return false;
    }

    return true;
  } catch {
    res.status(403).json({
      error: "This request origin is not allowed.",
    });
    return false;
  }
}

function getBaseUrl(req: Request): URL {
  const configured = process.env.PUBLIC_APP_URL?.trim();
  const value = configured || `${req.protocol}://${req.get("host")}`;
  const url = new URL(value);

  url.search = "";
  url.hash = "";

  return url;
}

function safeFrontendUrl(req: Request, candidate: unknown): URL {
  const base = getBaseUrl(req);
  let result = new URL(base.toString());

  if (typeof candidate === "string" && candidate.trim()) {
    try {
      const parsed = new URL(candidate, base);

      if (parsed.host === base.host) {
        result = parsed;
      }
    } catch {
      // Use the configured application URL.
    }
  }

  return result;
}

function createMailer() {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASSWORD;
  const port = Number(process.env.SMTP_PORT || 587);

  if (
    !host ||
    !user ||
    !password ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    auth: { user, pass: password },
  });
}

function fromAddress(): string {
  return (
    process.env.SMTP_FROM?.trim() ||
    process.env.SMTP_USER?.trim() ||
    "MartinezAI <no-reply@localhost>"
  );
}

async function sendAuthEmail(
  to: string,
  subject: string,
  text: string,
  html: string,
): Promise<void> {
  const mailer = createMailer();

  if (!mailer) {
    throw new Error(
      "Email delivery is not configured. Add the SMTP settings to the server environment.",
    );
  }

  await mailer.sendMail({
    from: fromAddress(),
    to,
    subject,
    text,
    html,
  });
}

async function sendVerificationEmail(
  req: Request,
  user: UserRecord,
  candidateUrl?: unknown,
): Promise<void> {
  const secret = randomBytes(32).toString("hex");
  const tokenPath = verifyFile(secret);

  await writeJsonAtomic(tokenPath, {
    userId: user.$id,
    purpose: "verify",
    expiresAt: Date.now() + VERIFY_LIFETIME_MS,
  } satisfies TokenRecord);

  try {
    const link = safeFrontendUrl(req, candidateUrl);

    // Do not carry stale recovery/verification parameters into a fresh link.
    link.search = "";
    link.hash = "";
    link.searchParams.set("userId", user.$id);
    link.searchParams.set("secret", secret);

    const verificationUrl = link.toString();
    const escapedUrl = verificationUrl
      .replace(/&/g, "&amp;")
      .replace(/\"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    await sendAuthEmail(
      user.email,
      "Verify your MartinezAI email",
      `Verify your email within 24 hours:\n\n${verificationUrl}`,
      `<p>Verify your email within 24 hours.</p><p><a href="${escapedUrl}">Verify email</a></p>`,
    );
  } catch (error) {
    await unlink(tokenPath).catch(() => undefined);
    throw error;
  }
}

const emailLocks = new Map<string, Promise<unknown>>();

async function withEmailLock<T>(
  email: string,
  task: () => Promise<T>,
): Promise<T> {
  const key = digest(email.trim().toLowerCase());
  const previous = emailLocks.get(key) || Promise.resolve();
  const current = previous.catch(() => undefined).then(task);

  emailLocks.set(key, current);

  try {
    return await current;
  } finally {
    if (emailLocks.get(key) === current) {
      emailLocks.delete(key);
    }
  }
}

const attempts = new Map<
  string,
  { count: number; startsAt: number }
>();

function rateLimit(max: number, windowMs: number): RequestHandler {
  return (req, res, next) => {
    const key = `${req.ip || req.socket.remoteAddress || "unknown"}:${req.path}`;
    const now = Date.now();

    let entry = attempts.get(key);

    if (!entry || now - entry.startsAt > windowMs) {
      entry = { count: 0, startsAt: now };
    }

    entry.count += 1;
    attempts.set(key, entry);

    if (attempts.size > 5000) {
      for (const [storedKey, storedEntry] of attempts) {
        if (now - storedEntry.startsAt > windowMs * 2) {
          attempts.delete(storedKey);
        }
      }
    }

    if (entry.count > max) {
      res.setHeader(
        "Retry-After",
        String(
          Math.ceil((windowMs - (now - entry.startsAt)) / 1000),
        ),
      );

      res.status(429).json({
        error: "Too many attempts. Please wait and try again.",
      });
      return;
    }

    next();
  };
}

/*
 * Validate the server-managed session cookie and derive the
 * account ID from the session record, never from a request body.
 */
export async function authenticateRequest(
  req: Request,
  res: Response,
): Promise<string | null> {
  const token = sessionTokenFromRequest(req);

  if (!token || !/^[a-f0-9]{64}$/i.test(token)) {
    res.status(401).json({
      error: "Sign in is required to access this resource.",
    });
    return null;
  }

  try {
    const file = sessionFile(token);
    const session = await readJson<SessionRecord>(file);

    if (!session || session.expiresAt <= Date.now()) {
      await unlink(file).catch(() => undefined);

      res.status(401).json({
        error: "Your session has expired. Please sign in again.",
      });

      return null;
    }

    const user = await readJson<UserRecord>(
      userFile(session.userId),
    );

    if (!user) {
      await unlink(file).catch(() => undefined);
      clearSessionCookie(res);

      res.status(401).json({
        error: "Your account could not be found. Please sign in again.",
      });

      return null;
    }

    if (user.emailVerification !== true) {
      await unlink(file).catch(() => undefined);
      clearSessionCookie(res);

      res.status(403).json({
        error:
          "Please verify your email before accessing MartinezAI. Check your inbox and spam folder.",
        code: "EMAIL_NOT_VERIFIED",
      });
      return null;
    }

    return user.$id;
  } catch (error) {
    console.error("Session validation failed:", error);

    res.status(503).json({
      error: "Authentication is temporarily unavailable.",
    });

    return null;
  }
}

async function requireUser(
  req: Request,
  res: Response,
): Promise<UserRecord | null> {
  try {
    const id = await authenticateRequest(req, res);

    if (!id) return null;

    const user = await readJson<UserRecord>(userFile(id));

    if (!user) {
      if (!res.headersSent) {
        res.status(401).json({
          error: "Sign in again to continue.",
        });
      }
      return null;
    }

    return user;
  } catch (error) {
    console.error("Could not load the authenticated user:", error);

    if (!res.headersSent) {
      res.status(503).json({
        error: "Authentication is temporarily unavailable.",
      });
    }

    return null;
  }
}

async function revokeUserSessions(userId: string): Promise<void> {
  const dir = collection("sessions");
  let names: string[];

  try {
    names = await readdir(dir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }

  await Promise.all(
    names
      .filter((name) => name.endsWith(".json"))
      .map(async (name) => {
        const file = path.join(dir, name);
        const session = await readJson<SessionRecord>(file).catch(
          () => null,
        );

        if (session?.userId === userId) {
          await unlink(file).catch(() => undefined);
        }
      }),
  );
}

export function registerAuthRoutes(app: Express): void {
  app.use("/api/auth", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  /*
   * Registration: password hashes are stored, never plain passwords.
   */
  app.post("/api/auth/register", rateLimit(8, 15 * 60 * 1000), async (req, res) => {
    if (!assertSameOrigin(req, res)) return;

    const email = normalizeEmail(req.body?.email);
    const password =
      typeof req.body?.password === "string" ? req.body.password : "";
    const name =
      typeof req.body?.name === "string"
        ? req.body.name.trim().slice(0, 80)
        : "";

    if (!validEmail(email)) {
      res.status(400).json({ error: "Enter a valid email address." });
      return;
    }

    if (password.length < 8 || password.length > 256) {
      res.status(400).json({
        error: "Use a password between 8 and 256 characters.",
      });
      return;
    }

    if (/[\u0000-\u001f]/.test(password)) {
      res.status(400).json({
        error: "That password contains unsupported characters.",
      });
      return;
    }

    const mailer = createMailer();
    const isDev = process.env.NODE_ENV !== "production" || !process.env.SMTP_HOST;

    if (!mailer && !isDev) {
      res.status(503).json({
        error:
          "Email verification is temporarily unavailable because email delivery is not configured. Please try again later.",
      });
      return;
    }

    try {
      const user = await withEmailLock(email, async () => {
        const index = await readJson<{ userId: string }>(
          emailFile(email),
        );

        if (index) return null;

        const createdAt = Date.now();

        const record: UserRecord = {
          $id: randomUUID(),
          name: name || email.split("@")[0].slice(0, 80),
          email,
          emailVerification: !mailer, // auto-verify in dev/demo if SMTP not configured
          passwordHash: await hashPassword(password),
          createdAt,
          updatedAt: createdAt,
        };

        const recordPath = userFile(record.$id);
        const indexPath = emailFile(email);

        try {
          await writeJsonAtomic(recordPath, record);
          await writeJsonAtomic(indexPath, { userId: record.$id });
          if (mailer) {
            await sendVerificationEmail(req, record, req.body?.url);
          }
        } catch (error) {
          await Promise.all([
            unlink(recordPath).catch(() => undefined),
            unlink(indexPath).catch(() => undefined),
          ]);
          throw error;
        }

        return record;
      });

      if (!user) {
        res.status(409).json({
          error: "An account with that email may already exist. Try signing in instead.",
        });
        return;
      }

      if (user.emailVerification) {
        // Auto-logged in
        const token = randomBytes(32).toString("hex");
        const createdAt = Date.now();
        await writeJsonAtomic(sessionFile(token), {
          userId: user.$id,
          createdAt,
          expiresAt: createdAt + SESSION_LIFETIME_SECONDS * 1000,
        } satisfies SessionRecord);
        setSessionCookie(res, token);
        res.status(201).json({
          user: publicUser(user),
          accountStatus: "active",
          message: "Account created successfully.",
        });
        return;
      }

      // A pending registration is accepted, but the account is not activated.
      res.status(202).json({
        user: publicUser(user),
        accountStatus: "pending_verification",
        verificationSent: true,
        message:
          "Registration is pending email verification. Check your inbox and spam folder, then verify your email before signing in.",
      });
    } catch (error) {
      console.error("Account registration failed:", error);

      res.status(500).json({
        error:
          "Could not create your account or send the verification email. Please check your email settings and try again.",
      });
    }
  });

  /*
   * Login: random session tokens are stored server-side and returned
   * only as an HttpOnly cookie, not exposed to frontend JavaScript.
   */
  app.post("/api/auth/login", rateLimit(12, 15 * 60 * 1000), async (req, res) => {
    if (!assertSameOrigin(req, res)) return;

    const email = normalizeEmail(req.body?.email);
    const password =
      typeof req.body?.password === "string" ? req.body.password : "";

    if (!email || !password) {
      res.status(400).json({
        error: "Enter your email and password.",
      });
      return;
    }

    try {
      const index = await readJson<{ userId: string }>(
        emailFile(email),
      );

      const user = index
        ? await readJson<UserRecord>(userFile(index.userId))
        : null;

      const valid = user
        ? await verifyPassword(password, user.passwordHash)
        : false;

      if (!user || !valid) {
        res.status(401).json({
          error: "Invalid email or password.",
        });
        return;
      }

      if (user.emailVerification !== true) {
        clearSessionCookie(res);
        res.status(403).json({
          error:
            "Please verify your email before signing in. Check your inbox and spam folder, or request a new verification email.",
          code: "EMAIL_NOT_VERIFIED",
        });
        return;
      }

      const token = randomBytes(32).toString("hex");
      const createdAt = Date.now();

      await writeJsonAtomic(sessionFile(token), {
        userId: user.$id,
        createdAt,
        expiresAt:
          createdAt + SESSION_LIFETIME_SECONDS * 1000,
      } satisfies SessionRecord);

      setSessionCookie(res, token);

      res.setHeader("Cache-Control", "no-store");
      res.json({ user: publicUser(user) });
    } catch (error) {
      console.error("Sign-in failed:", error);

      res.status(500).json({
        error: "Could not sign in right now. Please try again.",
      });
    }
  });

  app.get("/api/auth/me", async (req, res) => {
    const user = await requireUser(req, res);

    if (!user) return;

    res.setHeader("Cache-Control", "private, no-store");
    res.json({ user: publicUser(user) });
  });
  // Return the authenticated user's profile picture as an image.
// The picture data is not included in the public account response.
app.get("/api/auth/profile-picture", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const match =
    typeof user.profilePictureDataUrl === "string"
      ? user.profilePictureDataUrl.match(
          /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/i,
        )
      : null;

  if (!match) {
    res.status(404).json({
      error: "No profile picture has been uploaded.",
    });
    return;
  }

  const mimeType = match[1].toLowerCase();
  const imageBytes = Buffer.from(match[2], "base64");

  if (!imageBytes.length || imageBytes.length > 2 * 1024 * 1024) {
    res.status(413).json({
      error: "The stored profile picture is invalid or too large.",
    });
    return;
  }

  res.setHeader("Content-Type", mimeType);
  res.setHeader("Content-Length", String(imageBytes.length));
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");

  res.status(200).send(imageBytes);
});

// Upload or replace the current user's profile picture.
app.patch("/api/auth/profile-picture", async (req, res) => {
  if (!assertSameOrigin(req, res)) return;

  const user = await requireUser(req, res);
  if (!user) return;

  const image = req.body?.image;

  const match =
    typeof image === "string"
      ? image.match(
          /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/i,
        )
      : null;

  if (!match) {
    res.status(400).json({
      error: "Choose a valid PNG, JPEG, or WebP profile picture.",
    });
    return;
  }

  const imageBytes = Buffer.from(match[2], "base64");
  const MAX_PROFILE_PICTURE_BYTES = 2 * 1024 * 1024;

  if (
    !imageBytes.length ||
    imageBytes.length > MAX_PROFILE_PICTURE_BYTES
  ) {
    res.status(413).json({
      error: "Your profile picture must be 2 MB or smaller after processing.",
    });
    return;
  }

  try {
    user.profilePictureDataUrl =
      `data:${match[1].toLowerCase()};base64,${match[2]}`;

    user.profilePictureUpdatedAt = Date.now();
    user.updatedAt = Date.now();

    await writeJsonAtomic(userFile(user.$id), user);

    res.json({ user: publicUser(user) });
  } catch (error) {
    console.error("Profile picture update failed:", error);

    res.status(500).json({
      error: "Could not save your profile picture.",
    });
  }
});

app.delete("/api/auth/profile-picture", async (req, res) => {
  if (!assertSameOrigin(req, res)) return;

  const user = await requireUser(req, res);
  if (!user) return;

  try {
    delete user.profilePictureDataUrl;

    user.profilePictureUpdatedAt = Date.now();
    user.updatedAt = Date.now();

    await writeJsonAtomic(userFile(user.$id), user);

    res.json({ user: publicUser(user) });
  } catch (error) {
    console.error("Profile picture removal failed:", error);

    res.status(500).json({
      error: "Could not remove your profile picture.",
    });
  }
});

  app.post("/api/auth/logout", async (req, res) => {
    if (!assertSameOrigin(req, res)) return;

    const token = sessionTokenFromRequest(req);

    if (token && /^[a-f0-9]{64}$/i.test(token)) {
      await unlink(sessionFile(token)).catch(() => undefined);
    }

    clearSessionCookie(res);
    res.json({ signedOut: true });
  });

  app.patch("/api/auth/profile", async (req, res) => {
    if (!assertSameOrigin(req, res)) return;

    const user = await requireUser(req, res);
    if (!user) return;

    const name =
      typeof req.body?.name === "string"
        ? req.body.name.trim().slice(0, 80)
        : "";

    if (!name) {
      res.status(400).json({
        error: "Enter a name before saving.",
      });
      return;
    }

    try {
      user.name = name;
      user.updatedAt = Date.now();

      await writeJsonAtomic(userFile(user.$id), user);
      res.json({ user: publicUser(user) });
    } catch (error) {
      console.error("Profile update failed:", error);

      res.status(500).json({
        error: "Could not update your profile.",
      });
    }
  });

  /*
   * Password recovery: the token is random, single-use, expires after
   * 30 minutes, and is stored on disk only in hashed form.
   */
  app.post("/api/auth/forgot-password", rateLimit(6, 15 * 60 * 1000), async (req, res) => {
    if (!assertSameOrigin(req, res)) return;

    if (!createMailer()) {
      res.status(503).json({
        error: "Password recovery email is not configured yet. Add SMTP settings to the server .env file.",
      });
      return;
    }

    const email = normalizeEmail(req.body?.email);

    if (!validEmail(email)) {
      res.status(400).json({ error: "Enter a valid email address." });
      return;
    }

    try {
      const index = await readJson<{ userId: string }>(
        emailFile(email),
      );

      if (index) {
        const user = await readJson<UserRecord>(
          userFile(index.userId),
        );

        if (user) {
          const secret = randomBytes(32).toString("hex");
          const now = Date.now();

          await writeJsonAtomic(resetFile(secret), {
            userId: user.$id,
            purpose: "reset",
            expiresAt: now + RESET_LIFETIME_MS,
          } satisfies TokenRecord);

          const link = safeFrontendUrl(req, req.body?.url);
          link.searchParams.set("recovery", "1");
          link.searchParams.set("userId", user.$id);
          link.searchParams.set("secret", secret);

          await sendAuthEmail(
            user.email,
            "Reset your MartinezAI password",
            `Use this link within 30 minutes to reset your MartinezAI password:\n\n${link.toString()}\n\nIf you did not request this, you can ignore this message.`,
            `<p>Use the link below within 30 minutes to reset your MartinezAI password.</p><p><a href="${link.toString()}">Reset password</a></p><p>If you did not request this, you can ignore this message.</p>`,
          );
        }
      }

      // Same response whether or not the account exists.
      res.json({
        message: "If an account exists for that email, a password-reset link has been sent.",
      });
    } catch (error) {
      console.error("Password recovery request failed:", error);

      res.status(500).json({
        error: "Could not send the reset email. Check your server's SMTP settings.",
      });
    }
  });

  app.post("/api/auth/reset-password", rateLimit(8, 15 * 60 * 1000), async (req, res) => {
    if (!assertSameOrigin(req, res)) return;

    const userId =
      typeof req.body?.userId === "string" ? req.body.userId : "";
    const secret =
      typeof req.body?.secret === "string" ? req.body.secret : "";
    const password =
      typeof req.body?.password === "string" ? req.body.password : "";

    if (
      !userId ||
      !secret ||
      password.length < 8 ||
      password.length > 256
    ) {
      res.status(400).json({
        error: "The reset link or new password is invalid.",
      });
      return;
    }

    try {
      const tokenPath = resetFile(secret);
      const token = await readJson<TokenRecord>(tokenPath);

      if (
        !token ||
        token.purpose !== "reset" ||
        token.userId !== userId ||
        token.expiresAt <= Date.now()
      ) {
        res.status(400).json({
          error: "This password-reset link is invalid or has expired. Request a new one.",
        });
        return;
      }

      const user = await readJson<UserRecord>(userFile(userId));

      if (!user) {
        res.status(400).json({
          error: "This password-reset link is invalid or has expired. Request a new one.",
        });
        return;
      }

      user.passwordHash = await hashPassword(password);
      user.updatedAt = Date.now();

      await writeJsonAtomic(userFile(user.$id), user);
      await unlink(tokenPath).catch(() => undefined);
      await revokeUserSessions(user.$id);

      clearSessionCookie(res);
      res.json({ updated: true });
    } catch (error) {
      console.error("Password reset failed:", error);

      res.status(500).json({
        error: "Could not reset the password. Please try again.",
      });
    }
  });

  app.post(
    "/api/auth/verification/request",
    rateLimit(4, 30 * 60 * 1000),
    async (req, res) => {
      if (!assertSameOrigin(req, res)) return;

      const email = normalizeEmail(req.body?.email);

      if (!validEmail(email)) {
        res.status(400).json({ error: "Enter a valid email address." });
        return;
      }

      if (!createMailer()) {
        res.status(503).json({
          error:
            "Email verification is not configured yet. Please try again later.",
        });
        return;
      }

      try {
        const index = await readJson<{ userId: string }>(emailFile(email));
        const user = index
          ? await readJson<UserRecord>(userFile(index.userId))
          : null;

        // Use the same response for missing and already-verified accounts.
        if (!user || user.emailVerification === true) {
          res.json({
            sent: true,
            message:
              "If the account needs verification, an email will be sent.",
          });
          return;
        }

        await sendVerificationEmail(req, user, req.body?.url);

        res.json({
          sent: true,
          message:
            "If the account needs verification, an email will be sent.",
        });
      } catch (error) {
        console.error("Verification email failed:", error);
        res.status(500).json({
          error: "Could not send the verification email. Please try again later.",
        });
      }
    },
  );

  app.post("/api/auth/verification/confirm", rateLimit(12, 15 * 60 * 1000), async (req, res) => {
    if (!assertSameOrigin(req, res)) return;

    const userId =
      typeof req.body?.userId === "string" ? req.body.userId : "";
    const secret =
      typeof req.body?.secret === "string" ? req.body.secret : "";

    try {
      const file = secret ? verifyFile(secret) : "";
      const token = secret
        ? await readJson<TokenRecord>(file)
        : null;

      if (
        !userId ||
        !token ||
        token.userId !== userId ||
        token.purpose !== "verify" ||
        !Number.isFinite(token.expiresAt) ||
        token.expiresAt <= Date.now()
      ) {
        res.status(400).json({
          error: "This verification link is invalid or has expired.",
        });
        return;
      }

      const user = await readJson<UserRecord>(userFile(userId));

      if (!user) {
        res.status(400).json({
          error: "This verification link is invalid or has expired.",
        });
        return;
      }

      user.emailVerification = true;
      user.updatedAt = Date.now();

      await writeJsonAtomic(userFile(user.$id), user);
      await unlink(file).catch(() => undefined);

      res.json({ user: publicUser(user) });
    } catch (error) {
      console.error("Email verification failed:", error);

      res.status(500).json({
        error: "Could not verify your email. Please try again.",
      });
    }
  });

  console.log("[MartinezAI] Self-hosted authentication routes registered.");
}
