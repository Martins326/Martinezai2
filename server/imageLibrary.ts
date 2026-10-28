import type { Express, Request, Response } from "express";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { authenticateRequest } from "./auth";

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const DATA_URL_PATTERN =
  /^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=\r\n]+)$/i;

type ImageExtension = "png" | "jpg" | "webp";

interface StoredLibraryImage {
  id: string;
  prompt: string;
  createdAt: number;
  mimeType: string;
  model?: string;
  width?: number;
  height?: number;
  fileName: string;
}

export interface LibraryImageResponse {
  id: string;
  prompt: string;
  createdAt: number;
  mimeType: string;
  model?: string;
  width?: number;
  height?: number;
}

const writeQueues = new Map<string, Promise<unknown>>();

function getLibraryRoot(): string {
  return path.resolve(
    process.env.MARTINEZAI_IMAGE_LIBRARY_DIR ||
      path.join(process.cwd(), "data", "image-library"),
  );
}

function userDirectory(userId: string): string {
  const safeId = createHash("sha256").update(userId).digest("hex");
  return path.join(getLibraryRoot(), safeId);
}

function indexPath(userId: string): string {
  return path.join(userDirectory(userId), "images.json");
}

function publicRecord(image: StoredLibraryImage): LibraryImageResponse {
  const { fileName: _fileName, ...metadata } = image;
  return metadata;
}

async function readIndex(userId: string): Promise<StoredLibraryImage[]> {
  try {
    const raw = await readFile(indexPath(userId), "utf8");
    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      throw new Error("The image library index is invalid.");
    }

    return parsed.filter((entry): entry is StoredLibraryImage =>
      Boolean(
        entry &&
        typeof entry === "object" &&
        typeof entry.id === "string" &&
        typeof entry.fileName === "string" &&
        typeof entry.prompt === "string" &&
        typeof entry.createdAt === "number" &&
        typeof entry.mimeType === "string",
      ),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function writeIndex(
  userId: string,
  images: StoredLibraryImage[],
): Promise<void> {
  const directory = userDirectory(userId);
  await mkdir(directory, {
    recursive: true,
    mode: 0o700,
  });

  const destination = indexPath(userId);
  const temporary = `${destination}.${randomUUID()}.tmp`;

  try {
    await writeFile(temporary, JSON.stringify(images), {
      encoding: "utf8",
      mode: 0o600,
    });
    await rename(temporary, destination);
  } catch (error) {
    await unlink(temporary).catch(() => undefined);
    throw error;
  }
}

async function withUserWriteLock<T>(
  userId: string,
  operation: () => Promise<T>,
): Promise<T> {
  const previous = writeQueues.get(userId) || Promise.resolve();
  const next = previous.catch(() => undefined).then(operation);
  writeQueues.set(userId, next);

  try {
    return await next;
  } finally {
    if (writeQueues.get(userId) === next) {
      writeQueues.delete(userId);
    }
  }
}

function extensionFor(mimeType: string): ImageExtension {
  if (mimeType === "image/jpeg" || mimeType === "image/jpg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  return "png";
}

function mimeTypeFor(extension: string): string {
  if (extension === "jpg") return "image/jpeg";
  if (extension === "webp") return "image/webp";
  return "image/png";
}

export function registerImageLibraryRoutes(app: Express): void {
  // Return metadata for the signed-in user's images.
  app.get("/api/library/images", async (req: Request, res: Response) => {
    const userId = await authenticateRequest(req, res);
    if (!userId) return;

    try {
      const images = await readIndex(userId);
      res.setHeader("Cache-Control", "private, no-store");
      res.json({ images: images.map(publicRecord) });
    } catch (error) {
      console.error("Image library read failed:", error);
      res.status(500).json({
        error: "Could not load your image library.",
      });
    }
  });

  // Save a generated image to that user's private directory.
  app.post("/api/library/images", async (req: Request, res: Response) => {
    const userId = await authenticateRequest(req, res);
    if (!userId) return;

    const prompt =
      typeof req.body?.prompt === "string"
        ? req.body.prompt.trim().slice(0, 10_000)
        : "";

    const dataUrl = req.body?.imageDataUrl;

    const model =
      typeof req.body?.model === "string"
        ? req.body.model.slice(0, 200)
        : undefined;

    if (!prompt || typeof dataUrl !== "string") {
      res.status(400).json({
        error: "A prompt and image are required.",
      });
      return;
    }

    const match = DATA_URL_PATTERN.exec(dataUrl);

    if (!match) {
      res.status(400).json({
        error: "The generated image format is not supported.",
      });
      return;
    }

    const extension = extensionFor(match[1].toLowerCase());
    const buffer = Buffer.from(match[2].replace(/\s/g, ""), "base64");

    if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) {
      res.status(413).json({
        error: "The image is too large to save in your library.",
      });
      return;
    }

    const id = randomUUID();
    const mimeType = mimeTypeFor(extension);

    const image: StoredLibraryImage = {
      id,
      prompt,
      createdAt: Date.now(),
      mimeType,
      model,
      fileName: `${id}.${extension}`,
    };

    try {
      await withUserWriteLock(userId, async () => {
        const directory = userDirectory(userId);

        await mkdir(directory, {
          recursive: true,
          mode: 0o700,
        });

        await writeFile(path.join(directory, image.fileName), buffer, {
          flag: "wx",
          mode: 0o600,
        });

        const current = await readIndex(userId);
        await writeIndex(userId, [image, ...current]);
      });

      res.status(201).json({ image: publicRecord(image) });
    } catch (error) {
      console.error("Image library save failed:", error);

      await unlink(path.join(userDirectory(userId), image.fileName)).catch(
        () => undefined,
      );

      res.status(500).json({
        error: "Could not save the image to your library.",
      });
    }
  });

  // Load the actual image file. The browser uses this for its preview.
  app.get(
    "/api/library/images/:id/content",
    async (req: Request, res: Response) => {
      const userId = await authenticateRequest(req, res);
      if (!userId) return;

      const id = req.params.id;

      try {
        const images = await readIndex(userId);
        const image = images.find((entry) => entry.id === id);

        if (!image) {
          res.status(404).json({
            error: "That image was not found in your library.",
          });
          return;
        }

        const content = await readFile(
          path.join(userDirectory(userId), image.fileName),
        );

        res.setHeader(
          "Content-Type",
          image.mimeType || mimeTypeFor(path.extname(image.fileName).slice(1)),
        );
        res.setHeader("Content-Length", String(content.length));
        res.setHeader("Cache-Control", "private, no-store");
        res.setHeader("X-Content-Type-Options", "nosniff");

        res.send(content);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          res.status(404).json({
            error: "The image file is no longer available.",
          });
          return;
        }

        console.error("Image library content read failed:", error);

        res.status(500).json({
          error: "Could not load this image.",
        });
      }
    },
  );

  // Delete an image from the signed-in user's Library.
  app.delete("/api/library/images/:id", async (req: Request, res: Response) => {
    const userId = await authenticateRequest(req, res);
    if (!userId) return;

    try {
      const deleted = await withUserWriteLock(userId, async () => {
        const images = await readIndex(userId);

        const image = images.find((entry) => entry.id === req.params.id);

        if (!image) return false;

        await writeIndex(
          userId,
          images.filter((entry) => entry.id !== image.id),
        );

        await unlink(path.join(userDirectory(userId), image.fileName)).catch(
          (error) => {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
              throw error;
            }
          },
        );

        return true;
      });

      if (!deleted) {
        res.status(404).json({
          error: "That image was not found in your library.",
        });
        return;
      }

      res.json({ deleted: true });
    } catch (error) {
      console.error("Image library deletion failed:", error);

      res.status(500).json({
        error: "Could not delete that image.",
      });
    }
  });
}
