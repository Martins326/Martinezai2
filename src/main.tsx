import { createRoot } from "react-dom/client";
import { useEffect, useState, type FormEvent } from "react";
import {
  AuthError,
  account,
  isAuthConfigured,
} from "./services/account";
import App from "./App.tsx";
import { StorageService } from "./services/storage";
import "./index.css";

type AuthUser = Awaited<ReturnType<typeof account.get>>;

function AuthenticatedApp() {
  const [user, setUser] = useState<AuthUser | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [mode, setMode] = useState<"login" | "signup" | "forgot" | "reset">(
    "login",
  );

  const [recoveryUserId, setRecoveryUserId] = useState("");
  const [recoverySecret, setRecoverySecret] = useState("");
  const [passwordAgain, setPasswordAgain] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [authError, setAuthError] = useState("");
  const [accountNotice, setAccountNotice] = useState("");

  /*
   * Check the existing session and process email verification links.
   */
  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      if (!isAuthConfigured) {
        setAuthError(
        "MartinezAI account service is unavailable. Check that the backend server is running.",
      );

        setIsLoading(false);
        return;
      }

      /*
       * Appwrite returns the userId and secret in the verification URL.
       */
      const query = new URLSearchParams(window.location.search);

      const verificationUserId = query.get("userId");
      const verificationSecret = query.get("secret");

      // Handle a password-recovery link before processing email verification.
      if (query.get("recovery") === "1") {
        if (verificationUserId && verificationSecret) {
          setRecoveryUserId(verificationUserId);
          setRecoverySecret(verificationSecret);
          setMode("reset");
          setAccountNotice("Choose a new password for your account.");
        } else {
          setAuthError(
            "This password-reset link is incomplete. Please request a new one.",
          );
        }

        // Remove recovery credentials from the visible URL and browser history.
        window.history.replaceState(
          {},
          document.title,
          `${window.location.pathname}${window.location.hash}`,
        );

        setIsLoading(false);
        return;
      }

      if (verificationUserId && verificationSecret) {
        try {
          await account.updateVerification({
            userId: verificationUserId,
            secret: verificationSecret,
          });

          if (mounted) {
            setAccountNotice(
              "Your email address has been verified successfully.",
            );
          }
        } catch (verificationError: unknown) {
          if (mounted) {
            setAccountNotice(
              verificationError instanceof Error
                ? `Email verification could not be completed: ${verificationError.message}`
                : "Email verification could not be completed. Request a new link and try again.",
            );
          }
        } finally {
          /*
           * Remove verification secrets from the address bar.
           */
          window.history.replaceState(
            {},
            document.title,
            `${window.location.pathname}${window.location.hash}`,
          );
        }
      }

      /*
       * Check whether the user already has a session.
       */
      try {
        const currentUser = await account.get();

        if (!mounted) return;

        /*
         * Select this user's account-specific local storage.
         */
        await StorageService.setUserId(currentUser.$id);

        setUser(currentUser);
      } catch (error: unknown) {
        if (!mounted) return;

        StorageService.clearActiveUser();

        /*
         * A 401 normally means there is no active session.
         */
        if (!(error instanceof AuthError && error.code === 401)) {
          setAuthError(
            error instanceof Error
              ? error.message
              : "Unable to check your login session.",
          );
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    void checkSession();

    return () => {
      mounted = false;
    };
  }, []);

  /*
   * Handle account creation and sign-in.
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isAuthConfigured) {
      setAuthError(
        "MartinezAI account service is unavailable. Check that the backend server is running.",
      );
      return;
    }

    const cleanEmail = email.trim();

    if (!cleanEmail || !password) {
      setAuthError("Enter your email and password.");
      return;
    }

    if (mode === "signup" && password.length < 8) {
      setAuthError("For signup, use a password with at least 8 characters.");
      return;
    }

    if (password.length > 256) {
      setAuthError("Your password cannot exceed 256 characters.");
      return;
    }

    setIsSubmitting(true);
    setAuthError("");
    setAccountNotice("");

    try {
      if (mode === "signup") {
        const registration = await account.create({
          name: name.trim() || cleanEmail.split("@")[0],
          email: cleanEmail,
          password,
        });

        // Registration is pending until the emailed verification token is used.
        // The server does not create a session during registration.
        if (!registration.verificationSent || registration.user.emailVerification === true) {
          throw new AuthError(
            "Your registration is not pending verification. Please try again.",
            503,
            "verification_not_pending",
          );
        }

        setPassword("");
        setMode("login");
        setAccountNotice(
          `Registration is pending email verification. A verification link was sent to ${cleanEmail}. The account will remain blocked from signing in or using MartinezAI until you open that link. Check your inbox and spam folder.`,
        );
        return;
      }

      await account.createEmailPasswordSession({
        email: cleanEmail,
        password,
      });

      const currentUser = await account.get();

      // Defense in depth; the backend must enforce this too.
      if (!currentUser.emailVerification) {
        await account
          .deleteSession({ sessionId: "current" })
          .catch(() => undefined);
        StorageService.clearActiveUser();
        throw new AuthError(
          "Please verify your email before signing in. Check your inbox and spam folder, or request a new verification email.",
          403,
          "email_not_verified",
        );
      }

      await StorageService.setUserId(currentUser.$id);
      setUser(currentUser);
      setPassword("");
      setAuthError("");
    } catch (error: unknown) {
      setAuthError(
        error instanceof Error
          ? error.message
          : "Authentication failed. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleForgotPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isAuthConfigured) {
      setAuthError(
        "MartinezAI account service is unavailable. Check that the backend server is running.",
      );
      return;
    }

    const cleanEmail = email.trim();

    if (!cleanEmail) {
      setAuthError("Enter your email address first.");
      return;
    }

    setIsSubmitting(true);
    setAuthError("");
    setAccountNotice("");

    try {
      await account.createRecovery({
        email: cleanEmail,
        url: `${window.location.origin}${window.location.pathname}?recovery=1`,
      });

      setAccountNotice(
        "If an account exists for that email, a password-reset link has been sent. Check your inbox and spam folder.",
      );
    } catch (error: unknown) {
      // Avoid revealing whether a particular email has an account.
      if (
        error instanceof AuthError &&
        (error.code === 404 || error.type === "user_not_found")
      ) {
        setAccountNotice(
          "If an account exists for that email, a password-reset link has been sent. Check your inbox and spam folder.",
        );
      } else {
        setAuthError(
          error instanceof Error
            ? error.message
            : "Could not request a password reset. Please try again.",
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePasswordReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!recoveryUserId || !recoverySecret) {
      setAuthError(
        "Your reset link is invalid or incomplete. Please request a new one.",
      );
      return;
    }

    if (password.length < 8) {
      setAuthError("Your new password must contain at least 8 characters.");
      return;
    }

    if (password !== passwordAgain) {
      setAuthError("The passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    setAuthError("");
    setAccountNotice("");

    try {
      await account.updateRecovery({
        userId: recoveryUserId,
        secret: recoverySecret,
        password,
      });

      setPassword("");
      setPasswordAgain("");
      setRecoveryUserId("");
      setRecoverySecret("");
      setMode("login");

      setAccountNotice(
        "Your password has been changed successfully. Sign in with your new password.",
      );
    } catch (error: unknown) {
      setAuthError(
        error instanceof Error
          ? `${error.message} Please request a new reset link if this one has expired.`
          : "Password reset failed. Please request a new link and try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  /*
   * Sign out from the self-hosted authentication service.
   */
  async function handleSignOut() {
    try {
      await account.deleteSession({
        sessionId: "current",
      });

      StorageService.clearActiveUser();

      setUser(null);
      setPassword("");
      setAuthError("");
      setMode("login");
    } catch (error: unknown) {
      setAuthError(
        error instanceof Error
          ? error.message
          : "Could not sign out. Please try again.",
      );

      window.alert(
        "MartinezAI could not sign you out. Check your internet connection and try again.",
      );
    }
  }

  /*
   * Send or resend the email-verification link.
   */
  async function handleResendVerification() {
    if (!isAuthConfigured) {
      throw new Error(
        "MartinezAI authentication is not configured. Check your server settings.",
      );
    }

    const targetEmail = user?.email || email.trim();

    if (!targetEmail) {
      throw new Error("Enter your email address first.");
    }

    await account.createVerification({
      email: targetEmail,
      url: `${window.location.origin}${window.location.pathname}`,
    });
  }

  async function handleUpdateProfile(newName: string) {
    const cleanName = newName.trim();

    if (!cleanName) {
      throw new Error("Enter a name before saving.");
    }

    await account.updateName({
      name: cleanName,
    });

    const updatedUser = await account.get();

    setUser(updatedUser);
  }


  async function handleUpdateProfilePicture(
    imageDataUrl: string | null,
  ) {
    const updatedUser = imageDataUrl
      ? await account.updateProfilePicture(imageDataUrl)
      : await account.removeProfilePicture();

    setUser(updatedUser);
  }

  if (isLoading) {
    return (
      <main className="app-splash">
        <div className="splash-content">
          {/* Animated brand mark */}
          <div className="splash-brand">
            <div className="splash-logo-glow" />

            <div className="splash-logo">
              <span>M</span>
            </div>

            <div className="splash-orbit splash-orbit-one" />
            <div className="splash-orbit splash-orbit-two" />
          </div>

          {/* App name */}
          <div className="splash-heading">
            <h1>
              Martinez<span>AI</span>
            </h1>

            <p>Your intelligence. Your workspace.</p>
            <p>Enjoy Better EXPERIENCE and capability on mobile view</p>
          </div>

          {/* Loading indicator */}
          <div
            className="splash-loader"
            role="status"
            aria-label="Loading MartinezAI"
          >
            <div className="splash-loader-track">
              <div className="splash-loader-progress" />
            </div>

            <p>Preparing your workspace</p>
          </div>
        </div>

        {/* Bottom branding */}
        <div className="splash-footer">
          <span className="splash-status-dot" />
          <span>INITIALIZING YOUR EXPERIENCE</span>
        </div>
      </main>
    );
  }

  /*
   * Authenticated application.
   */
  if (user) {
    return (
      <App
        key={user.$id}
        onSignOut={handleSignOut}
        accountUser={user}
        onResendVerification={handleResendVerification}
        onUpdateProfile={handleUpdateProfile}
        authNotice={accountNotice}
        onUpdateProfilePicture={handleUpdateProfilePicture}
      />
    );
  }

  const isSignup = mode === "signup";
  const isForgot = mode === "forgot";
  const isReset = mode === "reset";
  /*
   * Sign-in and sign-up screen.
   */
  return (
    <main className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-5">
      <section className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900 p-6 sm:p-8 shadow-2xl">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600">
            <span className="text-2xl font-bold">M</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight">MartinezAI</h1>

          <p className="mt-2 text-sm text-neutral-400">
            {isSignup
              ? "Create your account to get started."
              : isForgot
                ? "We'll help you reset your password."
                : isReset
                  ? "Choose a new password for your account."
                  : "Sign in to continue learning."}
          </p>
        </div>

        {authError && (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300 break-words"
          >
            {authError}
          </div>
        )}

        {accountNotice && (
          <div
            role="status"
            className={`mb-5 rounded-xl border p-3 text-sm break-words ${
              accountNotice.toLowerCase().includes("could not") ||
              accountNotice.toLowerCase().includes("failed")
                ? "border-red-500/30 bg-red-500/10 text-red-300"
                : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
            }`}
          >
            {accountNotice}
          </div>
        )}

        <form
          onSubmit={
            isForgot
              ? handleForgotPassword
              : isReset
                ? handlePasswordReset
                : handleSubmit
          }
          className="space-y-4"
        >
          {isSignup && (
            <div>
              <label
                htmlFor="auth-name"
                className="mb-1.5 block text-sm text-neutral-300"
              >
                Your name
              </label>

              <input
                id="auth-name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Enter your name"
                className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-sm outline-none transition focus:border-indigo-500"
              />
            </div>
          )}
          {!isReset && (
            <div>
              <label
                htmlFor="auth-email"
                className="mb-1.5 block text-sm text-neutral-300"
              >
                Email address
              </label>

              <input
                id="auth-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-sm outline-none transition focus:border-indigo-500"
              />
            </div>
          )}

          {!isForgot && (
            <>
              <div>
                <label
                  htmlFor="auth-password"
                  className="mb-1.5 block text-sm text-neutral-300"
                >
                  {isReset ? "New password" : "Password"}
                </label>

                <input
                  id="auth-password"
                  type="password"
                  autoComplete={
                    isSignup || isReset ? "new-password" : "current-password"
                  }
                  required
                  minLength={8}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={
                    isSignup || isReset
                      ? "At least 8 characters"
                      : "Enter your password"
                  }
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-sm outline-none transition focus:border-indigo-500"
                />
              </div>

              {isReset && (
                <div>
                  <label
                    htmlFor="auth-password-again"
                    className="mb-1.5 block text-sm text-neutral-300"
                  >
                    Confirm new password
                  </label>

                  <input
                    id="auth-password-again"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={passwordAgain}
                    onChange={(event) => setPasswordAgain(event.target.value)}
                    placeholder="Enter your new password again"
                    className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-sm outline-none transition focus:border-indigo-500"
                  />
                </div>
              )}

              {mode === "login" && (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => {
                      setMode("forgot");
                      setAuthError("");
                      setAccountNotice("");
                    }}
                    className="text-sm font-semibold text-indigo-400 hover:text-indigo-300 disabled:opacity-50"
                  >
                    Forgot password?
                  </button>

                  <button
                    type="button"
                    disabled={isSubmitting || !email.trim()}
                    onClick={async () => {
                      setIsSubmitting(true);
                      setAuthError("");
                      setAccountNotice("");

                      try {
                        await account.createVerification({
                          email: email.trim(),
                          url: `${window.location.origin}${window.location.pathname}`,
                        });

                        setAccountNotice(
                          "If this account needs verification, a new link will be sent. Check your inbox and spam folder.",
                        );
                      } catch (error: unknown) {
                        setAuthError(
                          error instanceof Error
                            ? error.message
                            : "Could not request a verification email. Please try again.",
                        );
                      } finally {
                        setIsSubmitting(false);
                      }
                    }}
                    className="text-sm font-semibold text-indigo-400 hover:text-indigo-300 disabled:opacity-50"
                  >
                    Resend verification email
                  </button>
                </div>
              )}
            </>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting
              ? "Please wait..."
              : isSignup
                ? "Create account"
                : isForgot
                  ? "Send reset link"
                  : isReset
                    ? "Reset password"
                    : "Sign in"}
          </button>
        </form>

        {isForgot || isReset ? (
          <p className="mt-6 text-center text-sm text-neutral-400">
            {isForgot ? "Remember your password?" : "Changed your mind?"}

            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                setMode("login");
                setAuthError("");
                setAccountNotice("");
                setPassword("");
                setPasswordAgain("");
                setRecoveryUserId("");
                setRecoverySecret("");
              }}
              className="ml-2 font-semibold text-indigo-400 hover:text-indigo-300"
            >
              Back to sign in
            </button>
          </p>
        ) : (
          <p className="mt-6 text-center text-sm text-neutral-400">
            {isSignup ? "Already have an account?" : "Don't have an account?"}

            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                setMode(isSignup ? "login" : "signup");
                setAuthError("");
                setAccountNotice("");
              }}
              className="ml-2 font-semibold text-indigo-400 hover:text-indigo-300"
            >
              {isSignup ? "Sign in" : "Create one"}
            </button>
          </p>
        )}
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<AuthenticatedApp />);
