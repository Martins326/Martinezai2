
import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Download,
  ImagePlus,
  Images,
  Loader2,
  RefreshCw,
  Trash2,
} from "lucide-react";

import type { SavedLibraryImage } from "../types";
import { ApiService } from "../services/api";

interface LibraryScreenProps {
  images: SavedLibraryImage[];
  isLoading: boolean;
  error: string | null;
  isLight?: boolean;
  onRefresh: () => void;
  onOpenImages: () => void;
  onBackToChat: () => void;
  onDeleteImage: (image: SavedLibraryImage) => void;
}

function fileExtension(mimeType: string): string {
  if (mimeType === "image/jpeg" || mimeType === "image/jpg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  return "png";
}

function safeFileBase(prompt: string): string {
  const slug = prompt
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return slug || "martinezai-image";
}

const LibraryImageCard: React.FC<{
  image: SavedLibraryImage;
  isLight: boolean;
  onDelete: () => void;
}> = ({ image, isLight, onDelete }) => {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [isImageLoading, setIsImageLoading] = useState(true);
  const [imageError, setImageError] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;
    let createdUrl: string | null = null;

    setIsImageLoading(true);
    setImageError(null);
    setObjectUrl(null);

    ApiService.getLibraryImageContent(image.id)
      .then((blob) => {
        if (!isCurrent) return;

        createdUrl = URL.createObjectURL(blob);
        setObjectUrl(createdUrl);
      })
      .catch((error: unknown) => {
        if (!isCurrent) return;

        setImageError(
          error instanceof Error
            ? error.message
            : "This image could not be loaded.",
        );
      })
      .finally(() => {
        if (isCurrent) setIsImageLoading(false);
      });

    return () => {
      isCurrent = false;

      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [image.id]);

  const downloadImage = () => {
    if (!objectUrl) return;

    const anchor = document.createElement("a");

    anchor.href = objectUrl;
    anchor.download =
      `${safeFileBase(image.prompt)}.${fileExtension(image.mimeType)}`;

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  const cardClass = isLight
    ? "border-neutral-200 bg-white text-neutral-900 shadow-sm"
    : "border-neutral-800 bg-neutral-900/80 text-neutral-100";

  const mutedTextClass = isLight
    ? "text-neutral-500"
    : "text-neutral-400";

  return (
    <article className={`overflow-hidden rounded-2xl border ${cardClass}`}>
      <div
        className={`relative flex aspect-square items-center justify-center overflow-hidden ${
          isLight ? "bg-neutral-100" : "bg-neutral-950"
        }`}
      >
        {objectUrl && (
          <img
            src={objectUrl}
            alt={image.prompt}
            className="h-full w-full object-contain"
            loading="lazy"
          />
        )}

        {isImageLoading && (
          <div
            className={`absolute inset-0 flex flex-col items-center justify-center gap-2 ${
              isLight ? "bg-neutral-100" : "bg-neutral-950"
            }`}
          >
            <Loader2
              size={25}
              className="animate-spin text-indigo-400"
            />
            <span className={`text-xs ${mutedTextClass}`}>
              Loading image…
            </span>
          </div>
        )}

        {imageError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-5 text-center">
            <AlertCircle size={24} className="text-rose-400" />
            <p className={`text-xs ${mutedTextClass}`}>
              {imageError}
            </p>
          </div>
        )}
      </div>

      <div className="space-y-3 p-3 sm:p-4">
        <p
          className="line-clamp-3 min-h-[3.75rem] text-sm leading-5"
          title={image.prompt}
        >
          {image.prompt}
        </p>

        <div className={`text-xs ${mutedTextClass}`}>
          {new Date(image.createdAt).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={downloadImage}
            disabled={!objectUrl || Boolean(imageError)}
            className="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-500 px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Download size={16} />
            Download
          </button>

          <button
            type="button"
            onClick={onDelete}
            aria-label="Delete image from library"
            title="Delete image"
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors ${
              isLight
                ? "border-neutral-200 text-neutral-500 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                : "border-neutral-700 text-neutral-400 hover:border-rose-900/70 hover:bg-rose-950/40 hover:text-rose-300"
            }`}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </article>
  );
};

export const LibraryScreen: React.FC<LibraryScreenProps> = ({
  images,
  isLoading,
  error,
  isLight = false,
  onRefresh,
  onOpenImages,
  onBackToChat,
  onDeleteImage,
}) => {
  const sortedImages = useMemo(
    () => [...images].sort((a, b) => b.createdAt - a.createdAt),
    [images],
  );

  const shellClass = isLight
    ? "bg-neutral-50 text-neutral-900"
    : "bg-neutral-950 text-neutral-100";

  const mutedClass = isLight
    ? "text-neutral-500"
    : "text-neutral-400";

  const borderClass = isLight
    ? "border-neutral-200"
    : "border-neutral-800";

  return (
    <main
    className={`martinez-library-screen flex min-h-0 flex-1 flex-col overflow-y-auto ${shellClass}`}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-10 pt-5 sm:px-6 lg:px-8">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBackToChat}
            className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors ${
              isLight
                ? "text-neutral-600 hover:bg-neutral-200"
                : "text-neutral-300 hover:bg-neutral-800"
            }`}
          >
            <ArrowLeft size={17} />
            Back to chat
          </button>

          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors disabled:opacity-50 ${borderClass} ${
              isLight ? "hover:bg-neutral-100" : "hover:bg-neutral-900"
            }`}
          >
            <RefreshCw
              size={15}
              className={isLoading ? "animate-spin" : ""}
            />
            Refresh
          </button>
        </div>

        <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <div
              className={`mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl ${
                isLight
                  ? "bg-indigo-100 text-indigo-700"
                  : "bg-indigo-500/15 text-indigo-300"
              }`}
            >
              <Images size={23} />
            </div>

            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Your Library
            </h1>

            <p className={`mt-2 max-w-xl text-sm sm:text-base ${mutedClass}`}>
              Images you create are saved to your account and stay here for
              you to revisit or download.
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenImages}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-neutral-950 transition-colors hover:bg-neutral-200"
          >
            <ImagePlus size={18} />
            Create an image
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className={`mb-5 flex items-start gap-3 rounded-2xl border p-4 text-sm ${
              isLight
                ? "border-rose-200 bg-rose-50 text-rose-800"
                : "border-rose-900/70 bg-rose-950/30 text-rose-200"
            }`}
          >
            <AlertCircle size={19} className="mt-0.5 shrink-0" />

            <div className="min-w-0 flex-1">
              <p>{error}</p>

              <button
                type="button"
                onClick={onRefresh}
                className="mt-2 font-semibold underline underline-offset-2"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {isLoading && images.length === 0 ? (
          <div
            className={`flex min-h-64 flex-1 flex-col items-center justify-center gap-3 rounded-3xl border ${borderClass}`}
          >
            <Loader2
              size={30}
              className="animate-spin text-indigo-400"
            />
            <p className={`text-sm ${mutedClass}`}>
              Loading your library…
            </p>
          </div>
        ) : sortedImages.length ? (
          <>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Saved images</h2>

              <span className={`text-sm ${mutedClass}`}>
                {sortedImages.length}{" "}
                {sortedImages.length === 1 ? "image" : "images"}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 min-[430px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {sortedImages.map((image) => (
                <LibraryImageCard
                  key={image.id}
                  image={image}
                  isLight={isLight}
                  onDelete={() => onDeleteImage(image)}
                />
              ))}
            </div>
          </>
        ) : !isLoading && !error ? (
          <div
            className={`flex min-h-72 flex-col items-center justify-center rounded-3xl border border-dashed px-6 py-12 text-center ${borderClass}`}
          >
            <div
              className={`mb-4 flex h-16 w-16 items-center justify-center rounded-2xl ${
                isLight
                  ? "bg-neutral-100 text-indigo-600"
                  : "bg-neutral-900 text-indigo-300"
              }`}
            >
              <Images size={30} />
            </div>

            <h2 className="text-xl font-semibold">
              Your library is empty
            </h2>

            <p className={`mt-2 max-w-md text-sm leading-6 ${mutedClass}`}>
              When you generate an image, it will automatically be saved
              here under your signed-in account.
            </p>

            <button
              type="button"
              onClick={onOpenImages}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-indigo-500 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-400"
            >
              <ImagePlus size={17} />
              Create your first image
            </button>
          </div>
        ) : null}
      </div>
    </main>
  );
};
