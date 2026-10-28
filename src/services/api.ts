import {
  Message,
  AssistantMode,
  GroundingSource,
  Attachment,
  UserMemory,
  MemorySuggestion,
  SavedLibraryImage,
  UnsplashSearchResponse,
  UnsplashPhoto,
  PluginInvocation,
} from "../types";
import { formatHttpErrorFallback } from "./httpErrors";


export interface PluginRunResult {
  pluginId: string;

  provider:
    | "local"
    | "gemini"
    | "gemini-google-search";

  output: string;

  sources: GroundingSource[];
}

export interface StreamChatOptions {
  messages: Message[];
  message: string;
  attachments?: Attachment[];
  mode: AssistantMode;
  customInstructions?: string;
  enableSearch?: boolean;
  thinkHarder?: boolean;
  activePlugins?: string[];
  onChunk: (chunk: string) => void;
  onGrounding?: (sources: GroundingSource[]) => void;
  onPluginInvocation?: (invocation: PluginInvocation) => void;
  signal?: AbortSignal;
  responseLength?: "balanced" | "concise" | "detailed";
}

async function getLibraryAuthHeaders(): Promise<Record<string, string>> {
  return {};
}

async function getErrorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  const result = await response.json().catch(() => null);

  if (typeof result?.error === "string" && result.error.trim()) {
    return result.error;
  }

  return formatHttpErrorFallback(fallback, response.status);
}

/**

* Converts a photo Blob into a data URL for the existing image-library API.
  */
async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error("Could not prepare the photo for saving."));
    };

    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Could not prepare the photo for saving."));
        return;
      }

      resolve(reader.result);
    };

    reader.readAsDataURL(blob);
  });
}

export const ApiService = {
  /**

* Public backend health check. Do not expose secrets in its response.
  */
  async checkHealth(): Promise<{
    configured: boolean;
    model: string;
    appName: string;
  }> {
    try {
      const response = await fetch("/api/health");

      if (!response.ok) {
        throw new Error("Health check returned a non-success response.");
      }

      return await response.json();
    } catch (error) {
      console.warn("Backend health check error:", error);

      return {
        configured: false,
        model: "gemini-3.8-flash",
        appName: "Martins AI",
      };
    }
  },

  /**

* Stream an AI chat response.
  */
  async streamChat({
    messages,
    message,
    attachments = [],
    mode,
    customInstructions = "",
    enableSearch = false,
    thinkHarder = false,
    activePlugins = [],
    responseLength = "balanced",
    onChunk,
    onGrounding,
    onPluginInvocation,
    signal,
  }: StreamChatOptions): Promise<string> {
    const authHeaders = await getLibraryAuthHeaders();

    const response = await fetch("/api/chat/stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
      body: JSON.stringify({
        messages,
        message,
        attachments,
        mode,
        customInstructions,
        enableSearch,
        thinkHarder,
        activePlugins,
        responseLength,
      }),
      signal,
    });

    if (!response.ok) {
      throw new Error(await getErrorMessage(response, "Chat request failed"));
    }

    if (!response.body) {
      throw new Error(
        "Streaming is not supported by this browser or connection.",
      );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");

    let buffer = "";
    let accumulatedText = "";

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();

          if (!trimmed.startsWith("data: ")) {
            continue;
          }

          const payload = trimmed.slice(6);

          let data: {
            type?: string;
            text?: string;
            fullText?: string;
            error?: string;
            sources?: GroundingSource[];
            invocation?: PluginInvocation;
            callId?: string;
            pluginId?: string;
            pluginName?: string;
            action?: string;
            request?: Record<string, unknown>;
            response?: Record<string, unknown>;
            status?: "running" | "completed" | "error";
          };

          try {
            data = JSON.parse(payload);
          } catch {
            console.debug("Ignoring malformed SSE payload.");
            continue;
          }

          if (data.type === "chunk" && typeof data.text === "string") {
            accumulatedText += data.text;
            onChunk(data.text);
          } else if (
            data.type === "plugin_call" ||
            data.type === "plugin_result" ||
            data.type === "plugin_invocation"
          ) {
            const invocation: PluginInvocation = data.invocation || {
              callId: data.callId || `call_${Date.now()}`,
              pluginId: data.pluginId || "plugin",
              pluginName: data.pluginName || "Plugin",
              action: data.action || "run",
              request: data.request || {},
              response: data.response,
              status:
                data.status ||
                (data.type === "plugin_call" ? "running" : "completed"),
              error: data.error,
            };
            onPluginInvocation?.(invocation);
          } else if (data.type === "grounding" && Array.isArray(data.sources)) {
            onGrounding?.(data.sources);
          } else if (data.type === "done") {
            if (
              typeof data.fullText === "string" &&
              accumulatedText.length === 0
            ) {
              accumulatedText = data.fullText;
              onChunk(data.fullText);
            }
          } else if (data.type === "error") {
            throw new Error(data.error || "AI response generation failed.");
          }
        }
      }
    } catch (error) {
      try {
        await reader.cancel();
      } catch {
        // The stream may already be closed.
      }

      throw error;
    } finally {
      reader.releaseLock();
    }

    return accumulatedText;
  },

  /**
   * Generate a new image or edit an uploaded image.
   * The NVIDIA API key remains on the server.
   */
  async generateImage(input: {
    prompt: string;
    aspectRatio?: string;
    imageDataUrl?: string;
  }): Promise<{
    imageUrl: string;
    provider: string;
    model: string;
    operation: "generate" | "edit";
    aspectRatio: string;
  }> {
    const prompt = input.prompt.trim();

    if (!prompt) {
      throw new Error("Enter a description for the image.");
    }

    const response = await fetch("/api/image/generate", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        aspectRatio: input.aspectRatio || "1:1",
        ...(input.imageDataUrl ? { imageDataUrl: input.imageDataUrl } : {}),
      }),
    });

    if (!response.ok) {
      throw new Error(
        await getErrorMessage(response, "Could not generate the image"),
      );
    }

    const payload: unknown = await response.json();

    if (typeof payload !== "object" || payload === null) {
      throw new Error("The image service returned an invalid response.");
    }

    const result = payload as Record<string, unknown>;
    const imageUrl = result.imageUrl;

    if (
      typeof imageUrl !== "string" ||
      !/^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/i.test(
        imageUrl,
      )
    ) {
      throw new Error("The image service did not return a valid image.");
    }

    return {
      imageUrl,
      provider:
        typeof result.provider === "string" ? result.provider : "nvidia",
      model:
        typeof result.model === "string"
          ? result.model
          : "black-forest-labs/flux.1-kontext-dev",
      operation: result.operation === "edit" ? "edit" : "generate",
      aspectRatio:
        typeof result.aspectRatio === "string" ? result.aspectRatio : "1:1",
    };
  },

  async searchUnsplashPhotos(
    query: string,
    page = 1,
  ): Promise<UnsplashSearchResponse> {
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      throw new Error("Enter a search phrase first.");
    }

    if (!Number.isInteger(page) || page < 1) {
      throw new Error("The photo search page is invalid.");
    }

    const params = new URLSearchParams({
      query: trimmedQuery,
      page: String(page),
    });

    const authHeaders = await getLibraryAuthHeaders();

    const response = await fetch(`/api/unsplash/search?${params.toString()}`, {
      headers: authHeaders,
    });

    if (!response.ok) {
      throw new Error(
        await getErrorMessage(response, "Could not search Unsplash photos"),
      );
    }

    return (await response.json()) as UnsplashSearchResponse;
  },

  /**

* Notify Unsplash when a user selects a photo for use.
* The backend validates the download endpoint and uses its own key.
  */
  async trackUnsplashDownload(downloadLocation: string): Promise<void> {
    if (!downloadLocation) {
      throw new Error("The Unsplash photo is missing its download reference.");
    }

    const authHeaders = await getLibraryAuthHeaders();

    const response = await fetch("/api/unsplash/track-download", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
      body: JSON.stringify({ downloadLocation }),
    });

    if (!response.ok) {
      throw new Error(
        await getErrorMessage(
          response,
          "Could not record Unsplash photo usage",
        ),
      );
    }
  },

  /**

* Download an Unsplash photograph and save it to the signed-in user's Library.
* The existing library endpoint determines ownership from the authenticated JWT.
  */
  async saveUnsplashPhotoToLibrary(
    photo: UnsplashPhoto,
    prompt: string,
  ): Promise<SavedLibraryImage> {
    if (!photo?.id || !photo.urls?.regular) {
      throw new Error("The selected Unsplash photo is invalid.");
    }

    // Obtain authentication before doing the download work.
    // This also prevents saving when there is no active account session.
    await getLibraryAuthHeaders();

    const imageResponse = await fetch(photo.urls.regular);

    if (!imageResponse.ok) {
      throw new Error("Could not download this Unsplash photo.");
    }

    const blob = await imageResponse.blob();

    if (!blob.type.startsWith("image/")) {
      throw new Error("Unsplash returned an invalid image.");
    }

    if (blob.size > 15 * 1024 * 1024) {
      throw new Error("This photo is too large to save to your Library.");
    }

    const imageDataUrl = await blobToDataUrl(blob);

    // Save through the existing authenticated, account-specific library API.
    const savedImage = await ApiService.saveGeneratedImageToLibrary({
      prompt: prompt.trim() || photo.altDescription || "Unsplash photo",
      imageUrl: imageDataUrl,
      model: "Unsplash",
    });

    // Track use after the photo has been saved successfully.
    // A tracking failure should not make a successfully saved image appear lost.
    void ApiService.trackUnsplashDownload(photo.downloadLocation).catch(
      (error: unknown) => {
        console.warn("Unsplash download tracking failed:", error);
      },
    );

    return savedImage;
  },

  /**

* Save an image to the current user's Library.
* Kept for compatibility with the existing library feature.
  */
  async saveGeneratedImageToLibrary(image: {
    prompt: string;
    imageUrl: string;
    model?: string;
  }): Promise<SavedLibraryImage> {
    const authHeaders = await getLibraryAuthHeaders();

    const response = await fetch("/api/library/images", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
      body: JSON.stringify({
        prompt: image.prompt,
        imageDataUrl: image.imageUrl,
        model: image.model,
      }),
    });

    if (!response.ok) {
      throw new Error(
        await getErrorMessage(
          response,
          "Could not save the image to your Library",
        ),
      );
    }

    const result = await response.json();

    if (!result?.image) {
      throw new Error("The server did not return the saved image.");
    }

    return result.image as SavedLibraryImage;
  },

  /**

* Retrieve images belonging to the signed-in user.
  */
  async getLibraryImages(): Promise<SavedLibraryImage[]> {
    const authHeaders = await getLibraryAuthHeaders();

    const response = await fetch("/api/library/images", {
      headers: authHeaders,
    });

    if (!response.ok) {
      throw new Error(
        await getErrorMessage(response, "Could not load your image Library"),
      );
    }

    const result = await response.json();

    return Array.isArray(result.images)
      ? (result.images as SavedLibraryImage[])
      : [];
  },

  /**

* Retrieve the contents of a Library image owned by the current user.
  */
  async getLibraryImageContent(id: string): Promise<Blob> {
    if (!id.trim()) {
      throw new Error("The image ID is required.");
    }

    const authHeaders = await getLibraryAuthHeaders();

    const response = await fetch(
      `/api/library/images/${encodeURIComponent(id)}/content`,
      {
        headers: authHeaders,
      },
    );

    if (!response.ok) {
      throw new Error(
        await getErrorMessage(response, "Could not load this image"),
      );
    }

    return response.blob();
  },

  /**

* Delete a Library image belonging to the signed-in user.
  */
  async deleteLibraryImage(id: string): Promise<void> {
    if (!id.trim()) {
      throw new Error("The image ID is required.");
    }

    const authHeaders = await getLibraryAuthHeaders();

    const response = await fetch(
      `/api/library/images/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
        headers: authHeaders,
      },
    );

    if (!response.ok) {
      throw new Error(
        await getErrorMessage(response, "Could not delete this image"),
      );
    }
  },

  /**

* Generate a conversation title.
  */
  async generateTitle(message: string): Promise<string> {
    try {
      const authHeaders = await getLibraryAuthHeaders();

      const response = await fetch("/api/title", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({ message }),
      });

      if (!response.ok) {
        throw new Error(
          await getErrorMessage(response, "Title generation failed"),
        );
      }

      const data = await response.json();

      return typeof data.title === "string" && data.title.trim()
        ? data.title.trim()
        : "New Conversation";
    } catch (error) {
      console.warn("Title generation failed; using a local fallback.", error);

      return message.slice(0, 30).trim() || "New Conversation";
    }
  },

  /**

* Generate speech for the signed-in user.
  */
  async generateTTS(text: string, voice = "Kore"): Promise<string> {
    const authHeaders = await getLibraryAuthHeaders();

    const response = await fetch("/api/speech/tts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
      body: JSON.stringify({ text, voice }),
    });

    if (!response.ok) {
      throw new Error(
        await getErrorMessage(response, "Speech synthesis failed"),
      );
    }

    const data = await response.json();

    if (typeof data.audioUrl !== "string" || !data.audioUrl) {
      throw new Error("The server did not return an audio URL.");
    }

    return data.audioUrl;
  },

  /**

* Extract memory suggestions for the signed-in user.
  */
  async extractMemories(
    message: string,
    existingMemories: UserMemory[] = [],
  ): Promise<MemorySuggestion[]> {
    const authHeaders = await getLibraryAuthHeaders();

    const response = await fetch("/api/memory/extract", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
      body: JSON.stringify({
        message,
        existingMemories: existingMemories.slice(0, 40).map((memory) => ({
          id: memory.id,
          text: memory.text,
          category: memory.category || "other",
        })),
      }),
    });

    if (!response.ok) {
      throw new Error(
        await getErrorMessage(response, "Automatic memory detection failed"),
      );
    }

    const result = await response.json();

    return Array.isArray(result.memories)
      ? (result.memories as MemorySuggestion[])
      : [];
  },

  async runPlugin(input: {
    pluginId: string;
    input: string;
  }): Promise<PluginRunResult> {
    const response = await fetch(
      "/api/plugins/run",
      {
        method: "POST",

        credentials: "same-origin",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify(input),
      }
    );

    if (!response.ok) {
      throw new Error(
        await getErrorMessage(
          response,
          "Plugin execution failed"
        )
      );
    }

    const result =
      (await response.json()) as PluginRunResult;

    if (
      !result ||
      typeof result.output !== "string"
    ) {
      throw new Error(
        "The plugin returned an invalid result."
      );
    }

    return {
      pluginId: result.pluginId,

      provider: result.provider,

      output: result.output,

      sources: Array.isArray(result.sources)
        ? result.sources
        : [],
    };
  },
};
