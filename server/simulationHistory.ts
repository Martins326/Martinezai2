import type { Express, Request, Response } from "express";
import { createHash, randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { authenticateRequest } from "./auth";

type SimulationMode = "think" | "lab" | "agents" | "world";

interface SavedSimulation {
  id: string;
  title: string;
  mode: SimulationMode;
  prompt: string;
  result: Record<string, unknown>;
  createdAt: number;
}

interface HistoryFile {
  version: 1;
  updatedAt: number;
  items: SavedSimulation[];
}

const MAX_HISTORY_ITEMS = 50;
const MAX_HISTORY_BYTES = 2 * 1024 * 1024;

const VALID_MODES = new Set<SimulationMode>([
  "think",
  "lab",
  "agents",
  "world",
]);

const writeQueues = new Map<string, Promise<void>>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function getHistoryDirectory(): string {
  const configuredHistory =
    process.env.MARTINEZAI_SIMULATION_DIR;

  if (configuredHistory) {
    return path.resolve(configuredHistory);
  }

  const configuredUserData =
    process.env.MARTINEZAI_DATA_DIR;

  return configuredUserData
    ? path.resolve(
        configuredUserData,
        "..",
        "simulations",
      )
    : path.resolve(
        process.cwd(),
        "data",
        "simulations",
      );
}

function getHistoryFile(userId: string): string {
  // The user ID comes from the verified server-side session,
  // never from a user-supplied request field.
  const safeId = createHash("sha256")
    .update(userId)
    .digest("hex");

  return path.join(
    getHistoryDirectory(),
    `${safeId}.json`,
  );
}

function isMode(value: unknown): value is SimulationMode {
  return (
    typeof value === "string" &&
    VALID_MODES.has(value as SimulationMode)
  );
}

function validateSavedSimulation(
  value: unknown,
): SavedSimulation | null {
  if (!isRecord(value) || !isRecord(value.result)) {
    return null;
  }

  const {
    id,
    title,
    mode,
    prompt,
    result,
    createdAt,
  } = value;

  if (
    typeof id !== "string" ||
    !/^[a-zA-Z0-9_-]{1,100}$/.test(id) ||
    typeof title !== "string" ||
    title.trim().length === 0 ||
    title.length > 160 ||
    !isMode(mode) ||
    typeof prompt !== "string" ||
    prompt.trim().length === 0 ||
    prompt.length > 6000 ||
    typeof createdAt !== "number" ||
    !Number.isFinite(createdAt) ||
    createdAt < 0
  ) {
    return null;
  }

  return {
    id,
    title: title.trim(),
    mode,
    prompt: prompt.trim(),
    result,
    createdAt,
  };
}

async function readHistory(
  userId: string,
): Promise<SavedSimulation[]> {
  try {
    const raw = await readFile(
      getHistoryFile(userId),
      "utf8",
    );

    if (
      Buffer.byteLength(raw, "utf8") >
      MAX_HISTORY_BYTES
    ) {
      throw new Error(
        "Simulation history exceeds the allowed file size.",
      );
    }

    const parsed: unknown = JSON.parse(raw);

    if (
      !isRecord(parsed) ||
      !Array.isArray(parsed.items)
    ) {
      throw new Error(
        "Saved simulation history has an invalid format.",
      );
    }

    return parsed.items
      .map(validateSavedSimulation)
      .filter(
        (item): item is SavedSimulation =>
          item !== null,
      )
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, MAX_HISTORY_ITEMS);
  } catch (error) {
    if (
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return [];
    }

    throw error;
  }
}

async function writeHistory(
  userId: string,
  items: SavedSimulation[],
): Promise<void> {
  const directory = getHistoryDirectory();
  const filePath = getHistoryFile(userId);
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;

  const snapshot: HistoryFile = {
    version: 1,
    updatedAt: Date.now(),
    items: items
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, MAX_HISTORY_ITEMS),
  };

  const serialized = JSON.stringify(snapshot);

  if (
    Buffer.byteLength(serialized, "utf8") >
    MAX_HISTORY_BYTES
  ) {
    throw new Error(
      "Simulation history is too large to save.",
    );
  }

  await mkdir(directory, {
    recursive: true,
    mode: 0o700,
  });

  try {
    await writeFile(
      temporaryPath,
      serialized,
      {
        encoding: "utf8",
        mode: 0o600,
        flag: "wx",
      },
    );

    // Replace the saved history only after the complete
    // new file has been written.
    await rename(temporaryPath, filePath);
  } catch (error) {
    await unlink(temporaryPath).catch(
      () => undefined,
    );

    throw error;
  }
}

async function withUserWriteLock<T>(
  userId: string,
  operation: () => Promise<T>,
): Promise<T> {
  const previous =
    writeQueues.get(userId) ?? Promise.resolve();

  let release = () => {};

  const barrier = new Promise<void>((resolve) => {
    release = resolve;
  });

  const queued = previous
    .catch(() => undefined)
    .then(() => barrier);

  writeQueues.set(userId, queued);

  await previous.catch(() => undefined);

  try {
    return await operation();
  } finally {
    release();

    if (writeQueues.get(userId) === queued) {
      writeQueues.delete(userId);
    }
  }
}

export function registerSimulationHistoryRoutes(
  app: Express,
): void {
  // GET /api/simulation/history
  app.get(
    "/api/simulation/history",
    async (req: Request, res: Response) => {
      const userId = await authenticateRequest(req, res);

      if (!userId) return;

      try {
        const items = await readHistory(userId);

        res.setHeader("Cache-Control", "no-store");
        res.json({ items });
      } catch (error) {
        console.error(
          "Simulation history load failed:",
          error,
        );

        res.status(500).json({
          error: "Could not load simulation history.",
        });
      }
    },
  );

  // POST /api/simulation/history
  app.post(
    "/api/simulation/history",
    async (req: Request, res: Response) => {
      const userId = await authenticateRequest(req, res);

      if (!userId) return;

      const item = validateSavedSimulation(
        req.body?.item,
      );

      if (!item) {
        res.status(400).json({
          error: "The saved simulation is invalid.",
        });

        return;
      }

      try {
        await withUserWriteLock(userId, async () => {
          const current = await readHistory(userId);

          const next = [
            item,
            ...current.filter(
              (saved) => saved.id !== item.id,
            ),
          ];

          await writeHistory(userId, next);
        });

        res.status(201).json({
          saved: true,
          id: item.id,
        });
      } catch (error) {
        console.error(
          "Simulation history save failed:",
          error,
        );

        res.status(500).json({
          error: "Could not save this simulation.",
        });
      }
    },
  );

  // DELETE /api/simulation/history/:id
  app.delete(
    "/api/simulation/history/:id",
    async (req: Request, res: Response) => {
      const userId = await authenticateRequest(req, res);

      if (!userId) return;

      const id = req.params.id;

      if (
        typeof id !== "string" ||
        !/^[a-zA-Z0-9_-]{1,100}$/.test(id)
      ) {
        res.status(400).json({
          error: "The simulation ID is invalid.",
        });

        return;
      }

      try {
        await withUserWriteLock(userId, async () => {
          const current = await readHistory(userId);

          await writeHistory(
            userId,
            current.filter(
              (item) => item.id !== id,
            ),
          );
        });

        res.json({
          deleted: true,
          id,
        });
      } catch (error) {
        console.error(
          "Simulation history deletion failed:",
          error,
        );

        res.status(500).json({
          error: "Could not delete this simulation.",
        });
      }
    },
  );
}