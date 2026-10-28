import type { Express, Request, Response } from "express";

import { authenticateRequest } from "./auth";

import { createHash, randomUUID } from "node:crypto";

import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";

import path from "node:path";

/*
 * Martins AI Cloud Storage
 *
 * Appwrite handles authentication.
 * This backend handles data storage.
 *
 * Each authenticated Appwrite account receives
 * its own JSON file on the server.
 */

interface CloudSnapshot {
  version: 1;
  updatedAt: number;
  data: Record<string, unknown>;
}

function getStorageDirectory(): string {
  return path.resolve(
    process.env.MARTINEZAI_DATA_DIR ||
      path.join(process.cwd(), "data", "users"),
  );
}

function getUserFilePath(userId: string): string {
  /*
   * Derive the filename from the verified Appwrite ID.
   *
   * Never use a user-supplied ID as the storage path.
   */
  const safeId = createHash("sha256").update(userId).digest("hex");

  return path.join(getStorageDirectory(), `${safeId}.json`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function registerCloudStorageRoutes(app: Express): void {
  /*
   * GET /api/storage
   *
   * Load the signed-in user's cloud snapshot.
   */
  app.get("/api/storage", async (req: Request, res: Response) => {
    const userId = await authenticateRequest(req, res);

    if (!userId) {
      return;
    }

    try {
      const filePath = getUserFilePath(userId);

      const contents = await readFile(filePath, "utf8");

      const snapshot: unknown = JSON.parse(contents);

      if (!isRecord(snapshot) || !isRecord(snapshot.data)) {
        throw new Error("The saved storage record is invalid.");
      }

      res.json({
        data: snapshot.data,
        updatedAt: snapshot.updatedAt ?? null,
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        /*
         * First login on this backend:
         * there is no cloud snapshot yet.
         */
        res.json({
          data: null,
          updatedAt: null,
        });

        return;
      }

      console.error("Cloud storage read failed:", error);

      res.status(500).json({
        error: "Could not load cloud storage.",
      });
    }
  });

  /*
   * PUT /api/storage
   *
   * Save the signed-in user's cloud snapshot.
   *
   * Expected request:
   * {
   *   "data": {
   *     "conversations": [],
   *     "settings": {},
   *     "memories": [],
   *     "artifacts": []
   *   }
   * }
   *
   * The data fields can be extended as the app grows.
   */
  app.put("/api/storage", async (req: Request, res: Response) => {
    const userId = await authenticateRequest(req, res);

    if (!userId) {
      return;
    }

    const data: unknown = req.body?.data;

    if (!isRecord(data)) {
      res.status(400).json({
        error: 'Invalid storage data. An object named "data" is required.',
      });

      return;
    }

    let serializedData: string;

    try {
      serializedData = JSON.stringify(data);
    } catch {
      res.status(400).json({
        error: "The storage data could not be encoded.",
      });

      return;
    }

    /*
     * Initial safety limit for one complete snapshot.
     * Binary files can be handled separately in a later stage.
     */
    const sizeBytes = Buffer.byteLength(serializedData, "utf8");

    const maxBytes = 24 * 1024 * 1024;

    if (sizeBytes > maxBytes) {
      res.status(413).json({
        error:
          "This storage snapshot is too large. We will add separate file storage for larger uploads.",
      });

      return;
    }

    const updatedAt = Date.now();

    const snapshot: CloudSnapshot = {
      version: 1,
      updatedAt,
      data,
    };

    const filePath = getUserFilePath(userId);

    const temporaryPath = `${filePath}.${randomUUID()}.tmp`;

    try {
      await mkdir(getStorageDirectory(), { recursive: true, mode: 0o700 });

      /*
       * Write the complete snapshot to a temporary file
       * before replacing the previous version.
       */
      await writeFile(
        temporaryPath,
        JSON.stringify(snapshot),

        {
          encoding: "utf8",
          mode: 0o600,
          flag: "wx",
        },
      );

      await rename(temporaryPath, filePath);

      res.json({
        saved: true,
        updatedAt,
      });
    } catch (error) {
      console.error("Cloud storage save failed:", error);

      try {
        await unlink(temporaryPath);
      } catch {
        // The temporary file may not exist.
      }

      res.status(500).json({
        error: "Could not save cloud storage.",
      });
    }
  });

  /*
   * DELETE /api/storage
   *
   * Delete the signed-in user's cloud snapshot.
   */
  app.delete("/api/storage", async (req: Request, res: Response) => {
    const userId = await authenticateRequest(req, res);

    if (!userId) {
      return;
    }

    try {
      await unlink(getUserFilePath(userId));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        console.error("Cloud storage deletion failed:", error);

        res.status(500).json({
          error: "Could not delete cloud storage.",
        });

        return;
      }
    }

    res.json({
      deleted: true,
    });
  });

  console.log("[Martins AI] Cloud storage routes registered.");
}
