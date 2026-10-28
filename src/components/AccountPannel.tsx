import React, { useEffect, useRef, useState } from "react";
import {
  Archive,
  BadgeCheck,
  LogOut,
  Mail,
  ShieldCheck,
  Trash2,
  Camera,
  Check,
  Copy,
  ImagePlus,
  Sparkles,
} from "lucide-react";

interface AccountPanelProps {
  profile: {
    $id: string;
    name: string;
    email: string;
    emailVerification: boolean;
    hasProfilePicture?: boolean;
    profilePictureUpdatedAt?: number;
  };

  showArchived: boolean;
  onToggleArchived: () => void;
  onClearAll: () => void;
  onSignOut: () => Promise<void> | void;
  onResendVerification: () => Promise<void>;
  onUpdateProfile: (name: string) => Promise<void>;
  authNotice: string;
  onClose: () => void;

  onUpdateProfilePicture: (
    imageDataUrl: string | null,
  ) => Promise<void>;

  onSummarizeProfilePicture: () => Promise<string>;
  profilePictureSummary: string;
}

/**
 * Resize a gallery image before uploading it.
 *
 * Supported output formats:
 * - WebP
 * - PNG fallback if WebP encoding is unavailable
 *
 * The server receives a small data URL rather than the original,
 * potentially very large image.
 */
async function prepareProfilePicture(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose an image from your gallery.");
  }

  if (file.size > 12 * 1024 * 1024) {
    throw new Error(
      "Choose an image smaller than 12 MB to process it safely.",
    );
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>(
      (resolve, reject) => {
        const element = new Image();

        element.onload = () => resolve(element);

        element.onerror = () => {
          reject(
            new Error(
              "This image could not be opened. Try another picture.",
            ),
          );
        };

        element.src = objectUrl;
      },
    );

    if (
      !image.naturalWidth ||
      !image.naturalHeight
    ) {
      throw new Error("The selected image has invalid dimensions.");
    }

    // Prevent unnecessarily large canvas allocations.
    const maxSide = 640;
    const maxPixels = 40_000_000;

    if (
      image.naturalWidth * image.naturalHeight >
      maxPixels
    ) {
      throw new Error(
        "This image has too many pixels. Choose a smaller picture.",
      );
    }

    const scale = Math.min(
      1,
      maxSide /
        Math.max(
          image.naturalWidth,
          image.naturalHeight,
        ),
    );

    const canvas = document.createElement("canvas");

    canvas.width = Math.max(
      1,
      Math.round(image.naturalWidth * scale),
    );

    canvas.height = Math.max(
      1,
      Math.round(image.naturalHeight * scale),
    );

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error(
        "Your browser could not process this image.",
      );
    }

    context.drawImage(
      image,
      0,
      0,
      canvas.width,
      canvas.height,
    );

    const blob = await new Promise<Blob | null>(
      (resolve) => {
        canvas.toBlob(
          resolve,
          "image/webp",
          0.86,
        );
      },
    );

    if (!blob) {
      throw new Error(
        "Your browser could not prepare this image.",
      );
    }

    if (blob.size > 2 * 1024 * 1024) {
      throw new Error(
        "The processed profile picture must be 2 MB or smaller.",
      );
    }

    return await new Promise<string>(
      (resolve, reject) => {
        const reader = new FileReader();

        reader.onerror = () => {
          reject(
            new Error(
              "Could not read the processed image.",
            ),
          );
        };

        reader.onload = () => {
          if (typeof reader.result === "string") {
            resolve(reader.result);
          } else {
            reject(
              new Error(
                "Could not prepare the profile picture.",
              ),
            );
          }
        };

        reader.readAsDataURL(blob);
      },
    );
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export const AccountPanel: React.FC<AccountPanelProps> = ({
  profile,
  onSignOut,
  onResendVerification,
  onUpdateProfile,
  authNotice,
  onClose,
  showArchived,
  onToggleArchived,
  onClearAll,
  onUpdateProfilePicture,
  onSummarizeProfilePicture,
  profilePictureSummary,
}) => {
  // Profile details
  const [profileName, setProfileName] = useState(
    profile.name || "",
  );

  const [isBusy, setIsBusy] = useState(false);

  // Notifications
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Profile picture
  const [isPictureBusy, setIsPictureBusy] =
    useState(false);

  const [isSummaryBusy, setIsSummaryBusy] =
    useState(false);

  const [summary, setSummary] = useState(
    profilePictureSummary || "",
  );

  // Account ID copy feedback
  const [copiedAccountId, setCopiedAccountId] =
    useState(false);

  // Gallery input
  const fileInputRef =
    useRef<HTMLInputElement>(null);

  // Keep the display name synchronized with account changes.
  useEffect(() => {
    setProfileName(profile.name || "");
  }, [profile.name]);

  // Keep the displayed AI summary synchronized with saved settings.
  useEffect(() => {
    setSummary(profilePictureSummary || "");
  }, [profilePictureSummary]);

  /**
   * Save the user's display name.
   */
  async function saveName(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const name = profileName.trim();

    if (!name) {
      setError("Enter a name before saving.");
      setMessage("");
      return;
    }

    setIsBusy(true);
    setError("");
    setMessage("");

    try {
      await onUpdateProfile(name);

      setMessage(
        "Your profile name has been updated.",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not update your profile.",
      );
    } finally {
      setIsBusy(false);
    }
  }

  /**
   * Request another verification email.
   */
  async function resendVerification() {
    setIsBusy(true);
    setError("");
    setMessage("");

    try {
      await onResendVerification();

      setMessage(
        `A verification link has been requested for ${profile.email}. Check your inbox and spam folder.`,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not send a verification email.",
      );
    } finally {
      setIsBusy(false);
    }
  }

  /**
   * Copy the complete account ID.
   *
   * The fallback helps on browsers where clipboard permissions
   * are unavailable or the Clipboard API is unsupported.
   */
  async function copyAccountId() {
    setError("");
    setMessage("");

    try {
      let copied = false;

      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(
            profile.$id,
          );

          copied = true;
        } catch {
          // Continue to the fallback below.
        }
      }

      if (!copied) {
        const fallback =
          document.createElement("textarea");

        fallback.value = profile.$id;
        fallback.setAttribute("readonly", "true");

        fallback.style.position = "fixed";
        fallback.style.left = "-9999px";
        fallback.style.top = "0";
        fallback.style.opacity = "0";

        document.body.appendChild(fallback);

        try {
          fallback.focus();
          fallback.select();
          fallback.setSelectionRange(
            0,
            fallback.value.length,
          );

          copied = document.execCommand("copy");
        } finally {
          fallback.remove();
        }
      }

      if (!copied) {
        throw new Error(
          "Could not copy the account ID. Please select and copy it manually.",
        );
      }

      setCopiedAccountId(true);

      setMessage(
        "Account ID copied to clipboard.",
      );

      window.setTimeout(() => {
        setCopiedAccountId(false);
      }, 1800);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not copy the account ID.",
      );
    }
  }

  /**
   * Upload or replace the profile picture selected from the gallery.
   */
  async function handlePictureSelected(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const input = event.currentTarget;
    const file = input.files?.[0];

    // Reset the input so the same file can be selected again.
    input.value = "";

    if (!file) {
      return;
    }

    setIsPictureBusy(true);
    setError("");
    setMessage("");

    try {
      const imageDataUrl =
        await prepareProfilePicture(file);

      await onUpdateProfilePicture(
        imageDataUrl,
      );

      // The old summary no longer describes the new picture.
      setSummary("");

      setMessage(
        "Your profile picture has been updated.",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not update your profile picture.",
      );
    } finally {
      setIsPictureBusy(false);
    }
  }

  /**
   * Remove the saved profile picture.
   */
  async function removeProfilePicture() {
    if (
      isPictureBusy ||
      isSummaryBusy
    ) {
      return;
    }

    const confirmed = window.confirm(
      "Remove your profile picture?",
    );

    if (!confirmed) {
      return;
    }

    setIsPictureBusy(true);
    setError("");
    setMessage("");

    try {
      await onUpdateProfilePicture(null);

      setSummary("");

      setMessage(
        "Your profile picture has been removed.",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not remove your profile picture.",
      );
    } finally {
      setIsPictureBusy(false);
    }
  }

  /**
   * Ask the AI to summarize the user's saved picture.
   */
  async function summarizeProfilePicture() {
    if (
      isPictureBusy ||
      isSummaryBusy ||
      !profile.hasProfilePicture
    ) {
      return;
    }

    setIsSummaryBusy(true);
    setError("");
    setMessage("");

    try {
      const result =
        await onSummarizeProfilePicture();

      setSummary(result);

      setMessage(
        "The AI picture summary has been saved for future chats.",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not summarize your profile picture.",
      );
    } finally {
      setIsSummaryBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Profile card */}
      <section className="relative overflow-hidden rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-900 to-neutral-950 p-5 sm:p-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-indigo-500/10 blur-3xl"
        />

        {/* Avatar and account information */}
        <div className="relative flex items-start gap-4">
          {/* Profile avatar */}
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-700 text-2xl font-bold text-white shadow-xl shadow-indigo-950/50">
            {profile.hasProfilePicture ? (
              <img
                key={profile.profilePictureUpdatedAt || 0}
                src={`/api/auth/profile-picture?v=${
                  profile.profilePictureUpdatedAt || 0
                }`}
                alt={`${
                  profile.name || "User"
                }'s profile`}
                className="h-full w-full object-cover"
              />
            ) : (
              (
                profile.name.trim() ||
                profile.email ||
                "M"
              )
                .slice(0, 1)
                .toUpperCase()
            )}
          </div>

          {/* Account information */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="max-w-full truncate text-lg font-semibold tracking-tight text-white">
                {profile.name.trim() ||
                  "MartinezAI user"}
              </h3>

              {profile.emailVerification ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-[10px] font-medium text-emerald-300">
                  <BadgeCheck size={12} />
                  Verified
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-[10px] font-medium text-amber-300">
                  <ShieldCheck size={12} />
                  Verification needed
                </span>
              )}
            </div>

            <p className="mt-1 flex min-w-0 items-center gap-1.5 text-sm text-neutral-400">
              <Mail
                size={14}
                className="shrink-0"
              />

              <span className="truncate">
                {profile.email}
              </span>
            </p>

            {/* Full account ID and copy button */}
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-neutral-500">
              <span>Account ID:</span>

              <code
                title={profile.$id}
                className="max-w-[13rem] truncate rounded-md border border-white/10 bg-black/20 px-2 py-1 font-mono text-neutral-300"
              >
                {profile.$id}
              </code>

              <button
                type="button"
                onClick={() => void copyAccountId()}
                className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1.5 text-neutral-300 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                aria-label="Copy full account ID"
                title="Copy full account ID"
              >
                {copiedAccountId ? (
                  <Check size={12} />
                ) : (
                  <Copy size={12} />
                )}

                {copiedAccountId
                  ? "Copied"
                  : "Copy ID"}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Profile picture management */}
      <section className="space-y-3 rounded-2xl border border-neutral-800 bg-neutral-900/45 p-4">
        <div>
          <h3 className="text-sm font-semibold text-white">
            Profile picture
          </h3>

          <p className="mt-1 text-[11px] leading-relaxed text-neutral-500">
            Upload a photo from your phone gallery.
            You decide when the AI analyzes it; its saved
            description can help with future chats.
          </p>
        </div>

        {/* Hidden gallery input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/*"
          className="hidden"
          onChange={(event) =>
            void handlePictureSelected(event)
          }
          aria-label="Choose a profile picture"
        />

        {/* Picture actions */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              fileInputRef.current?.click()
            }
            disabled={
              isPictureBusy ||
              isSummaryBusy
            }
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3.5 py-2.5 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {profile.hasProfilePicture ? (
              <Camera size={15} />
            ) : (
              <ImagePlus size={15} />
            )}

            {isPictureBusy
              ? "Saving photo…"
              : profile.hasProfilePicture
                ? "Change photo"
                : "Upload from gallery"}
          </button>

          {profile.hasProfilePicture && (
            <>
              {/* AI picture summary */}
              <button
                type="button"
                onClick={() =>
                  void summarizeProfilePicture()
                }
                disabled={
                  isPictureBusy ||
                  isSummaryBusy
                }
                className="inline-flex items-center gap-2 rounded-xl border border-violet-400/25 bg-violet-500/10 px-3.5 py-2.5 text-xs font-semibold text-violet-200 transition hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Sparkles size={15} />

                {isSummaryBusy
                  ? "Analyzing picture…"
                  : summary
                    ? "Refresh AI summary"
                    : "Summarize picture"}
              </button>

              {/* Remove picture */}
              <button
                type="button"
                onClick={() =>
                  void removeProfilePicture()
                }
                disabled={
                  isPictureBusy ||
                  isSummaryBusy
                }
                className="inline-flex items-center gap-2 rounded-xl border border-rose-500/25 px-3.5 py-2.5 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 size={14} />
                Remove
              </button>
            </>
          )}
        </div>

        {/* Saved AI summary */}
        {summary && (
          <div className="rounded-xl border border-violet-400/20 bg-violet-500/[0.06] p-3">
            <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-violet-200">
              <Sparkles size={13} />
              Saved AI picture summary
            </p>

            <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-neutral-300">
              {summary}
            </p>
          </div>
        )}
      </section>

      {/* Mobile-only conversation actions */}
      <section className="space-y-2 rounded-2xl border border-neutral-800 bg-neutral-900/45 p-3 md:hidden">
        <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
          Conversations
        </p>

        <button
          type="button"
          onClick={() => {
            onToggleArchived();
            onClose();
          }}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-neutral-200 transition hover:bg-neutral-800"
        >
          <Archive
            size={17}
            className="shrink-0 text-indigo-300"
          />

          <span className="flex-1">
            {showArchived
              ? "View Active Chats"
              : "Archived Chats"}
          </span>

          <span className="text-xs text-neutral-500">
            ›
          </span>
        </button>

        <button
          type="button"
          onClick={onClearAll}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-rose-300 transition hover:bg-rose-500/10"
        >
          <Trash2
            size={17}
            className="shrink-0"
          />

          <span>Clear All Conversations</span>
        </button>
      </section>

      {/* Notifications */}
      {authNotice && (
        <p
          role="status"
          className="rounded-xl border border-indigo-500/25 bg-indigo-500/10 px-4 py-3 text-xs leading-relaxed text-indigo-200"
        >
          {authNotice}
        </p>
      )}

      {message && (
        <p
          role="status"
          className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-300"
        >
          {message}
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-xs leading-relaxed text-rose-300"
        >
          {error}
        </p>
      )}

      {/* Edit profile */}
      <section className="space-y-3 rounded-2xl border border-neutral-800 bg-neutral-900/45 p-4">
        <div>
          <h3 className="text-sm font-semibold text-white">
            Profile details
          </h3>

          <p className="mt-1 text-[11px] text-neutral-500">
            Choose the name MartinezAI displays for your account.
          </p>
        </div>

        <form
          onSubmit={saveName}
          className="space-y-3"
        >
          <label className="block space-y-1.5">
            <span className="text-[11px] font-medium text-neutral-300">
              Display name
            </span>

            <input
              value={profileName}
              onChange={(event) =>
                setProfileName(event.target.value)
              }
              maxLength={128}
              autoComplete="name"
              placeholder="Your name"
              className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/10"
            />
          </label>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={
                isBusy ||
                !profileName.trim() ||
                profileName.trim() === profile.name
              }
              className="rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isBusy
                ? "Saving profile…"
                : "Save profile"}
            </button>
          </div>
        </form>
      </section>

      {/* Email verification */}
      <section className="flex flex-col gap-3 rounded-2xl border border-neutral-800 bg-neutral-900/45 p-4 sm:flex-row sm:items-center">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            profile.emailVerification
              ? "bg-emerald-500/10 text-emerald-300"
              : "bg-amber-500/10 text-amber-300"
          }`}
        >
          {profile.emailVerification ? (
            <BadgeCheck size={19} />
          ) : (
            <Mail size={19} />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-white">
            Email verification
          </h3>

          <p className="mt-1 text-[11px] leading-relaxed text-neutral-400">
            {profile.emailVerification
              ? "Your email address has been verified."
              : `Verify ${profile.email} to confirm you own this address. Check your inbox and spam folder.`}
          </p>
        </div>

        {!profile.emailVerification && (
          <button
            type="button"
            onClick={() =>
              void resendVerification()
            }
            disabled={isBusy}
            className="shrink-0 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs font-semibold text-amber-200 transition hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isBusy
              ? "Please wait…"
              : "Resend email"}
          </button>
        )}
      </section>

      {/* Sign out */}
      <button
        type="button"
        onClick={() => {
          onClose();
          void onSignOut();
        }}
        className="flex w-full items-center justify-between rounded-2xl border border-rose-500/20 bg-rose-500/[0.04] px-4 py-3.5 text-left transition hover:border-rose-500/40 hover:bg-rose-500/[0.08]"
      >
        <span className="flex items-center gap-3">
          <span className="rounded-xl bg-rose-500/10 p-2 text-rose-300">
            <LogOut size={16} />
          </span>

          <span>
            <span className="block text-xs font-semibold text-rose-200">
              Sign out
            </span>

            <span className="mt-0.5 block text-[11px] text-neutral-500">
              End this session on this device
            </span>
          </span>
        </span>

        <span className="text-neutral-500">
          ›
        </span>
      </button>
    </div>
  );
};