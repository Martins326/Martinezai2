import React, { useRef, useState } from "react";
import {
  ArrowLeft,
  AlertCircle,
  Check,
  ExternalLink,
  Images,
  Library,
  Loader2,
  Plus,
  Search,
  Sparkles,
  X,
} from "lucide-react";

import { ApiService } from "../services/api";
import type { Attachment, UnsplashPhoto } from "../types";

interface ImageGenModalProps {
  onSaveGeneratedImage: (image: {
    prompt: string;
    imageUrl: string;
    model?: string;
  }) => Promise<void>;
  isOpen: boolean;
  onSaveUnsplashPhoto: (photo: UnsplashPhoto, prompt: string) => Promise<void>;
  onClose: () => void;
  onAttachImageToChat?: (attachment: Attachment) => void;
}

const SEARCH_IDEAS = [
  {
    title: "Nature",
    query: "nature landscape photography",
    emoji: "🌿",
    background: "bg-emerald-950",
  },
  {
    title: "Architecture",
    query: "modern architecture photography",
    emoji: "🏙️",
    background: "bg-sky-950",
  },
  {
    title: "Study spaces",
    query: "cozy study desk photography",
    emoji: "📚",
    background: "bg-amber-950",
  },
  {
    title: "Animals",
    query: "wildlife animal photography",
    emoji: "🦊",
    background: "bg-orange-950",
  },
];

const MAX_EDIT_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_ATTACH_IMAGE_BYTES = 20 * 1024 * 1024;

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () =>
      reject(new Error("Could not read the selected photo."));

    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const separator = result.indexOf(",");

      if (separator < 0) {
        reject(new Error("The selected photo could not be prepared for chat."));
        return;
      }

      resolve(result.slice(separator + 1));
    };

    reader.readAsDataURL(blob);
  });
}

function getImageExtension(mimeType: string): string {
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("webp")) return "webp";
  return "jpg";
}

function estimateBase64Size(base64: string): number {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;

  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

export const ImageGenModal: React.FC<ImageGenModalProps> = ({
  isOpen,
  onClose,
  onAttachImageToChat,
  onSaveUnsplashPhoto,
  onSaveGeneratedImage,
}) => {
  const [activeTab, setActiveTab] = useState<"generate" | "search">("generate");

  // AI image creation
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [editImageDataUrl, setEditImageDataUrl] = useState<string | null>(null);
  const [editImageName, setEditImageName] = useState("");
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(
    null,
  );
  const [generatedModel, setGeneratedModel] = useState("NVIDIA FLUX.1 Kontext");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratedImageSaved, setIsGeneratedImageSaved] = useState(false);
  const [isGeneratedImageAttached, setIsGeneratedImageAttached] =
    useState(false);

  const editImageInputRef = useRef<HTMLInputElement>(null);

  // Unsplash search
  const [searchQuery, setSearchQuery] = useState("");
  const [currentQuery, setCurrentQuery] = useState("");
  const [results, setResults] = useState<UnsplashPhoto[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalResults, setTotalResults] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [savingPhotoId, setSavingPhotoId] = useState<string | null>(null);
  const [attachingPhotoId, setAttachingPhotoId] = useState<string | null>(null);
  const [savedPhotoIds, setSavedPhotoIds] = useState<string[]>([]);
  const [attachedPhotoId, setAttachedPhotoId] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);

  const searchPhotos = async (
    rawQuery: string,
    nextPage = 1,
    append = false,
  ) => {
    const query = rawQuery.trim();

    if (!query || isLoading) return;

    setError(null);

    if (!append) {
      setResults([]);
      setHasSearched(false);
      setCurrentQuery(query);
      setPage(1);
    }

    setIsLoading(true);

    try {
      const data = await ApiService.searchUnsplashPhotos(query, nextPage);

      setResults((existing) =>
        append ? [...existing, ...data.results] : data.results,
      );

      setCurrentQuery(query);
      setPage(nextPage);
      setTotalPages(data.totalPages);
      setTotalResults(data.total);
      setHasSearched(true);
    } catch (searchError: unknown) {
      setError(
        searchError instanceof Error
          ? searchError.message
          : "Photo search failed. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (event?: React.FormEvent) => {
    event?.preventDefault();
    void searchPhotos(searchQuery, 1, false);
  };

  const handleSavePhoto = async (photo: UnsplashPhoto) => {
    if (savingPhotoId) return;

    setError(null);
    setSavingPhotoId(photo.id);

    try {
      await onSaveUnsplashPhoto(photo, currentQuery);

      setSavedPhotoIds((current) =>
        current.includes(photo.id) ? current : [...current, photo.id],
      );
    } catch (saveError: unknown) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save this photo to your Library.",
      );
    } finally {
      setSavingPhotoId(null);
    }
  };

  const handleEditImageSelected = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";

    if (!file) return;

    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("Choose a PNG, JPEG, or WebP image to edit.");
      return;
    }

    if (file.size > MAX_EDIT_IMAGE_BYTES) {
      setError("The image to edit must be 8 MB or smaller.");
      return;
    }

    const reader = new FileReader();

    reader.onerror = () => setError("Could not read the selected image.");

    reader.onload = () => {
      if (typeof reader.result !== "string") {
        setError("Could not prepare the selected image.");
        return;
      }

      setEditImageDataUrl(reader.result);
      setEditImageName(file.name);
      setGeneratedImageUrl(null);
      setIsGeneratedImageSaved(false);
      setIsGeneratedImageAttached(false);
      setError(null);
    };

    reader.readAsDataURL(file);
  };

  const handleGenerateImage = async (event: React.FormEvent) => {
    event.preventDefault();

    const cleanPrompt = prompt.trim();

    if (!cleanPrompt || isGenerating) return;

    setError(null);
    setIsGenerating(true);
    setGeneratedImageUrl(null);
    setIsGeneratedImageSaved(false);
    setIsGeneratedImageAttached(false);

    try {
      const result = await ApiService.generateImage({
        prompt: cleanPrompt,
        aspectRatio,
        ...(editImageDataUrl ? { imageDataUrl: editImageDataUrl } : {}),
      });

      setGeneratedImageUrl(result.imageUrl);
      setGeneratedModel(result.model);
    } catch (generationError: unknown) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : "Image generation failed. Please try again.",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveGeneratedImage = async () => {
    if (!generatedImageUrl || isGeneratedImageSaved) return;

    setError(null);

    try {
      await onSaveGeneratedImage({
        prompt: prompt.trim(),
        imageUrl: generatedImageUrl,
        model: generatedModel,
      });

      setIsGeneratedImageSaved(true);
    } catch (saveError: unknown) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save this image.",
      );
    }
  };

  const handleAttachGeneratedImage = () => {
    if (
      !generatedImageUrl ||
      !onAttachImageToChat ||
      isGeneratedImageAttached
    ) {
      return;
    }

    const match =
      /^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=]+)$/i.exec(
        generatedImageUrl,
      );

    if (!match) {
      setError("The generated image could not be prepared for chat.");
      return;
    }

    const mimeType = match[1].toLowerCase();
    const base64 = match[2];
    const extension = getImageExtension(mimeType);

    onAttachImageToChat({
      id: `att_generated_${Date.now()}`,
      name: `martins-ai-generated.${extension}`,
      mimeType,
      size: estimateBase64Size(base64),
      data: base64,
      previewUrl: generatedImageUrl,
    });

    setIsGeneratedImageAttached(true);
    window.setTimeout(onClose, 650);
  };

  const handleAttachPhoto = async (photo: UnsplashPhoto) => {
    if (!onAttachImageToChat || attachingPhotoId) return;

    setError(null);
    setAttachingPhotoId(photo.id);

    try {
      // Unsplash requires download tracking when a photo is used.
      void ApiService.trackUnsplashDownload(photo.downloadLocation).catch(
        (trackError) => {
          console.warn("Unsplash use tracking failed:", trackError);
        },
      );

      const response = await fetch(photo.urls.regular);

      if (!response.ok) {
        throw new Error("Could not download the selected photo for chat.");
      }

      const blob = await response.blob();

      if (!blob.type.startsWith("image/")) {
        throw new Error("Unsplash returned an unsupported image format.");
      }

      if (blob.size > MAX_ATTACH_IMAGE_BYTES) {
        throw new Error(
          "This photo is too large to attach. Try another result.",
        );
      }

      const mimeType = blob.type.toLowerCase();
      const extension = getImageExtension(mimeType);

      const attachment: Attachment = {
        id: `att_unsplash_${photo.id}_${Date.now()}`,
        name: `unsplash_${photo.id}.${extension}`,
        mimeType,
        size: blob.size,
        data: await blobToBase64(blob),
        previewUrl: photo.urls.regular,
      };

      onAttachImageToChat(attachment);
      setAttachedPhotoId(photo.id);
      window.setTimeout(onClose, 650);
    } catch (attachError: unknown) {
      setError(
        attachError instanceof Error
          ? attachError.message
          : "Could not attach this photo to chat.",
      );
    } finally {
      setAttachingPhotoId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col bg-black text-white"
      role="dialog"
      aria-modal="true"
      aria-labelledby="image-studio-title"
    >
      {/* Header */}
      <header className="relative flex h-[76px] shrink-0 items-center justify-center px-5">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close Image Studio"
          className="absolute left-5 flex h-[52px] w-[52px] items-center justify-center rounded-full border border-neutral-800 bg-neutral-900 hover:bg-neutral-800"
        >
          <ArrowLeft size={27} />
        </button>

        <h1
          id="image-studio-title"
          className="text-[25px] font-semibold tracking-tight"
        >
          Image Studio
        </h1>
      </header>

      {/* Tab navigation: buttons only */}
      <div className="mx-auto mt-2 flex w-fit shrink-0 gap-1 rounded-full border border-neutral-800 bg-neutral-900 p-1">
        <button
          type="button"
          onClick={() => {
            setActiveTab("generate");
            setError(null);
          }}
          aria-pressed={activeTab === "generate"}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
            activeTab === "generate"
              ? "bg-white text-black"
              : "text-neutral-300 hover:bg-neutral-800"
          }`}
        >
          <span className="inline-flex items-center gap-2">
            <Sparkles size={15} />
            Create with AI
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("search");
            setError(null);
          }}
          aria-pressed={activeTab === "search"}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
            activeTab === "search"
              ? "bg-white text-black"
              : "text-neutral-300 hover:bg-neutral-800"
          }`}
        >
          <span className="inline-flex items-center gap-2">
            <Search size={15} />
            Search photos
          </span>
        </button>
      </div>

      <main className="flex-1 overflow-y-auto px-4 pb-8 sm:px-5">
        {/* AI image generation tab */}
        {activeTab === "generate" && (
          <div className="mx-auto w-full max-w-4xl">
            <section className="mt-5 rounded-[28px] border border-neutral-800 bg-neutral-900 p-5 sm:p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-300">
                  <Sparkles size={25} />
                </div>

                <div>
                  <h2 className="text-lg font-bold">
                    Create an image with Martins AI
                  </h2>
                  <p className="text-sm text-neutral-400">
                    Describe the image, or upload one to edit it.
                  </p>
                </div>
              </div>

              <form onSubmit={handleGenerateImage} className="space-y-4">
                <label
                  htmlFor="ai-image-prompt"
                  className="block text-sm font-medium text-neutral-200"
                >
                  Image prompt
                </label>

                <textarea
                  id="ai-image-prompt"
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  maxLength={10000}
                  rows={4}
                  placeholder="Describe the image you want..."
                  className="w-full resize-y rounded-2xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-500 focus:border-violet-500"
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="ai-image-ratio"
                      className="mb-2 block text-sm font-medium text-neutral-200"
                    >
                      Aspect ratio
                    </label>

                    <select
                      id="ai-image-ratio"
                      value={aspectRatio}
                      onChange={(event) => setAspectRatio(event.target.value)}
                      disabled={Boolean(editImageDataUrl) || isGenerating}
                      className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-3 text-sm text-white disabled:opacity-60"
                    >
                      <option value="1:1">Square (1:1)</option>
                      <option value="3:2">Landscape (3:2)</option>
                      <option value="2:3">Portrait (2:3)</option>
                      <option value="4:3">Landscape (4:3)</option>
                      <option value="3:4">Portrait (3:4)</option>
                      <option value="16:9">Widescreen (16:9)</option>
                      <option value="9:16">Vertical (9:16)</option>
                      <option value="21:9">Ultrawide (21:9)</option>
                    </select>
                  </div>

                  <div className="flex flex-col justify-end gap-2">
                    <input
                      ref={editImageInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleEditImageSelected}
                      className="hidden"
                    />

                    <button
                      type="button"
                      onClick={() => editImageInputRef.current?.click()}
                      disabled={isGenerating}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-700 px-3 py-3 text-sm font-semibold hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Images size={17} />
                      {editImageDataUrl
                        ? "Change image to edit"
                        : "Upload image to edit"}
                    </button>

                    {editImageDataUrl && (
                      <div className="flex items-center justify-between gap-3 rounded-lg bg-neutral-950 px-3 py-2 text-xs text-neutral-300">
                        <span className="truncate">
                          Editing: {editImageName}
                        </span>

                        <button
                          type="button"
                          aria-label="Remove image to edit"
                          disabled={isGenerating}
                          onClick={() => {
                            setEditImageDataUrl(null);
                            setEditImageName("");
                          }}
                          className="rounded p-1 hover:bg-neutral-800 disabled:opacity-50"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {editImageDataUrl && (
                  <img
                    src={editImageDataUrl}
                    alt="Image selected for editing"
                    className="max-h-64 rounded-2xl border border-neutral-800 object-contain"
                  />
                )}

                <button
                  type="submit"
                  disabled={isGenerating || !prompt.trim()}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-violet-500 px-5 font-semibold text-white hover:bg-violet-400 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400"
                >
                  {isGenerating ? (
                    <Loader2 size={19} className="animate-spin" />
                  ) : (
                    <Sparkles size={18} />
                  )}

                  {isGenerating
                    ? editImageDataUrl
                      ? "Editing image…"
                      : "Creating image…"
                    : editImageDataUrl
                      ? "Edit image"
                      : "Generate image"}
                </button>

                <p className="text-xs leading-relaxed text-neutral-500">
                  Image generation requires a signed-in account, server-side
                  provider configuration, and available provider quota. Uploaded
                  edit images are limited to 8 MB.
                </p>
              </form>
            </section>

            {/* Generated image preview and actions */}
            {generatedImageUrl && (
              <section className="mt-5 space-y-3 rounded-2xl border border-neutral-800 bg-neutral-950 p-3 sm:p-4">
                <img
                  src={generatedImageUrl}
                  alt={`Generated image: ${prompt}`}
                  className="mx-auto max-h-[60vh] w-full rounded-xl object-contain"
                />

                <p className="text-xs text-neutral-500">
                  Generated with {generatedModel}
                </p>

                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => void handleSaveGeneratedImage()}
                    disabled={isGeneratedImageSaved}
                    className="flex items-center justify-center gap-2 rounded-xl border border-neutral-700 px-3 py-3 text-sm font-semibold hover:bg-neutral-800 disabled:opacity-60"
                  >
                    {isGeneratedImageSaved ? (
                      <Check size={16} />
                    ) : (
                      <Library size={16} />
                    )}

                    {isGeneratedImageSaved
                      ? "Saved to Library"
                      : "Save to Library"}
                  </button>

                  {onAttachImageToChat && (
                    <button
                      type="button"
                      onClick={handleAttachGeneratedImage}
                      disabled={isGeneratedImageAttached}
                      className="flex items-center justify-center gap-2 rounded-xl bg-white px-3 py-3 text-sm font-semibold text-black hover:bg-neutral-200 disabled:opacity-60"
                    >
                      {isGeneratedImageAttached ? (
                        <Check size={16} />
                      ) : (
                        <Plus size={16} />
                      )}

                      {isGeneratedImageAttached
                        ? "Added to chat"
                        : "Add to chat"}
                    </button>
                  )}
                </div>
              </section>
            )}
          </div>
        )}

        {/* Unsplash photo search tab */}
        {activeTab === "search" && (
          <div className="mx-auto w-full max-w-6xl">
            <section className="mt-5 rounded-[28px] border border-neutral-800 bg-neutral-900 p-5 sm:p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-800">
                  <Images size={25} />
                </div>

                <div>
                  <h2 className="text-lg font-bold">
                    Find photos for your ideas
                  </h2>
                  <p className="text-sm text-neutral-400">
                    Search real photographs from Unsplash.
                  </p>
                </div>
              </div>

              <p className="text-sm leading-relaxed text-neutral-300">
                Search for a subject, preview the results, save a photo to your
                account Library, or attach it to a chat. Photographer credits
                are included.
              </p>
            </section>

            {!hasSearched && results.length === 0 && (
              <section className="mt-7">
                <h2 className="mb-4 text-xl font-semibold">Explore ideas</h2>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
                  {SEARCH_IDEAS.map((idea) => (
                    <button
                      key={idea.title}
                      type="button"
                      onClick={() => {
                        setSearchQuery(idea.query);
                        void searchPhotos(idea.query, 1, false);
                      }}
                      className={`flex min-h-36 flex-col justify-between rounded-3xl ${idea.background} p-4 text-left hover:scale-[1.02] sm:min-h-44`}
                    >
                      <span className="text-4xl">{idea.emoji}</span>
                      <span className="font-semibold">{idea.title}</span>
                      <span className="text-xs text-white/70">
                        Search photos
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {hasSearched && (
              <section className="mt-7">
                <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <h2 className="text-xl font-semibold">
                      Results for “{currentQuery}”
                    </h2>
                    <p className="mt-1 text-sm text-neutral-400">
                      {totalResults.toLocaleString()} photos found
                    </p>
                  </div>

                  <a
                    href="https://unsplash.com/?utm_source=martins_ai&utm_medium=referral"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-neutral-300 underline underline-offset-4 hover:text-white"
                  >
                    Powered by Unsplash
                    <ExternalLink size={14} />
                  </a>
                </div>

                {results.length === 0 && !isLoading ? (
                  <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6 text-sm text-neutral-300">
                    No photos matched that search. Try a different phrase.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {results.map((photo) => (
                      <article
                        key={photo.id}
                        className="overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-900"
                      >
                        <a
                          href={photo.photoPageUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="block bg-neutral-950"
                        >
                          <img
                            src={photo.urls.regular}
                            alt={photo.altDescription || currentQuery}
                            loading="lazy"
                            className="h-56 w-full object-cover hover:opacity-90 sm:h-64"
                          />
                        </a>

                        <div className="space-y-3 p-4">
                          <p
                            className="line-clamp-2 min-h-10 text-sm text-neutral-200"
                            title={photo.altDescription || currentQuery}
                          >
                            {photo.altDescription || currentQuery}
                          </p>

                          <p className="text-xs text-neutral-400">
                            Photo by{" "}
                            <a
                              href={photo.photographerUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="underline underline-offset-2"
                            >
                              {photo.photographerName}
                            </a>{" "}
                            on{" "}
                            <a
                              href={photo.photoPageUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="underline underline-offset-2"
                            >
                              Unsplash
                            </a>
                          </p>

                          <button
                            type="button"
                            onClick={() => void handleSavePhoto(photo)}
                            disabled={
                              savingPhotoId === photo.id ||
                              savedPhotoIds.includes(photo.id)
                            }
                            className="flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-700 px-3 py-2.5 text-sm font-semibold hover:bg-neutral-800 disabled:opacity-60"
                          >
                            {savingPhotoId === photo.id ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : savedPhotoIds.includes(photo.id) ? (
                              <Check size={16} />
                            ) : (
                              <Library size={16} />
                            )}

                            {savedPhotoIds.includes(photo.id)
                              ? "Saved to Library"
                              : "Save to Library"}
                          </button>

                          {onAttachImageToChat && (
                            <button
                              type="button"
                              onClick={() => void handleAttachPhoto(photo)}
                              disabled={
                                attachingPhotoId === photo.id ||
                                attachedPhotoId === photo.id
                              }
                              className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-3 py-2.5 text-sm font-semibold text-black hover:bg-neutral-200 disabled:opacity-60"
                            >
                              {attachingPhotoId === photo.id ? (
                                <Loader2 size={16} className="animate-spin" />
                              ) : attachedPhotoId === photo.id ? (
                                <Check size={16} />
                              ) : (
                                <Plus size={16} />
                              )}

                              {attachedPhotoId === photo.id
                                ? "Added to chat"
                                : "Add to chat"}
                            </button>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                )}

                {page < totalPages && results.length > 0 && (
                  <div className="mt-6 flex justify-center">
                    <button
                      type="button"
                      onClick={() =>
                        void searchPhotos(currentQuery, page + 1, true)
                      }
                      disabled={isLoading}
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-neutral-700 px-5 py-3 text-sm font-semibold hover:bg-neutral-900 disabled:opacity-60"
                    >
                      {isLoading && (
                        <Loader2 size={16} className="animate-spin" />
                      )}
                      Load more photos
                    </button>
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </main>

      {/* Search bar only appears on the Search photos tab */}
      {activeTab === "search" && (
        <footer className="shrink-0 bg-gradient-to-t from-black via-black to-transparent px-4 pb-5 pt-4">
          <form
            onSubmit={handleSearch}
            className="mx-auto max-w-3xl rounded-[30px] border border-neutral-700 bg-neutral-900 p-3 shadow-2xl sm:p-4"
          >
            <label htmlFor="unsplash-search" className="sr-only">
              Search Unsplash photos
            </label>

            <input
              id="unsplash-search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search photos, e.g. sunset over the ocean"
              className="w-full bg-transparent px-2 py-3 text-base text-white outline-none placeholder:text-neutral-400"
            />

            <div className="mt-2 flex justify-end">
              <button
                type="submit"
                disabled={isLoading || !searchQuery.trim()}
                className="flex h-12 items-center justify-center gap-2 rounded-full bg-white px-5 font-semibold text-black hover:bg-neutral-200 disabled:bg-neutral-700 disabled:text-neutral-500"
              >
                {isLoading ? (
                  <Loader2 size={19} className="animate-spin" />
                ) : (
                  <Search size={19} />
                )}
                Search photos
              </button>
            </div>
          </form>
        </footer>
      )}

      {/* Shared error display */}
      {error && (
        <div className="pointer-events-none absolute inset-x-4 bottom-4 z-10 mx-auto max-w-3xl">
          <div
            role="alert"
            className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-red-900 bg-red-950/95 p-4 text-sm text-red-200 shadow-xl"
          >
            <AlertCircle size={20} className="mt-0.5 shrink-0" />
            <p className="flex-1">{error}</p>
            <button
              type="button"
              onClick={() => setError(null)}
              aria-label="Dismiss error"
              className="rounded p-1 hover:bg-red-900/60"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
