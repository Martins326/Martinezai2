import {
  Conversation,
  UserMemory,
  UserSettings,
  Artifact,
  GeneratedImage,
  Project,
  ScheduledTask,
} from "../types";

const CONVERSATIONS_KEY = "martins_ai_conversations_v1";
const PROJECTS_KEY = "martins_ai_projects_v1";
const SETTINGS_KEY = "martins_ai_settings_v1";
const MEMORIES_KEY = "martins_ai_memories_v1";
const ARTIFACTS_KEY = "martins_ai_artifacts_v1";
const GENERATED_IMAGES_KEY = "martins_ai_generated_images_v1";
const SCHEDULED_TASKS_KEY = "martinezai_scheduled_tasks_v1";

const DB_NAME = "martinezai-account-storage";
const DB_VERSION = 1;
const STORE_NAME = "records";

const ACCOUNT_DATA_KEYS = [
  CONVERSATIONS_KEY,
  SETTINGS_KEY,
  MEMORIES_KEY,
  PROJECTS_KEY,
  ARTIFACTS_KEY,
  GENERATED_IMAGES_KEY,
  SCHEDULED_TASKS_KEY,
] as const;

type StoredRecord = {
  key: string;
  value: unknown;
};

let activeUserId: string | null = null;
let accountGeneration = 0;
let dbPromise: Promise<IDBDatabase> | null = null;
let writeQueue: Promise<void> = Promise.resolve();

const accountCache = new Map<string, unknown>();

let cloudReady = false;
let cloudTimer: ReturnType<typeof setTimeout> | null = null;
let cloudSyncQueue: Promise<void> = Promise.resolve();

const CLOUD_KEYS = {
  conversations: CONVERSATIONS_KEY,
  projects: PROJECTS_KEY,
  settings: SETTINGS_KEY,
  memories: MEMORIES_KEY,
  artifacts: ARTIFACTS_KEY,
  generatedImages: GENERATED_IMAGES_KEY,
  scheduledTasks: SCHEDULED_TASKS_KEY,
} as const;

async function requestCloudStorage(
  method: "GET" | "PUT",
  data?: Record<string, unknown>,
): Promise<{
  data: Record<string, unknown> | null;
  updatedAt: number | null;
}> {
  const response = await fetch("/api/storage", {
    method,
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      "Cache-Control": "no-store",
      ...(method === "PUT" ? { "Content-Type": "application/json" } : {}),
    },
    ...(method === "PUT" ? { body: JSON.stringify({ data }) } : {}),
  });

  if (!response.ok) {
    const result = await response.json().catch(() => null);

    throw new Error(
      result?.error || `Cloud storage request failed (${response.status}).`,
    );
  }

  const payload: unknown = await response.json().catch(() => null);

  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    throw new Error("Cloud storage returned an invalid response.");
  }

  const result = payload as { data?: unknown; updatedAt?: unknown };
  const cloudData = result.data;

  return {
    data:
      typeof cloudData === "object" && cloudData !== null && !Array.isArray(cloudData)
        ? (cloudData as Record<string, unknown>)
        : null,
    updatedAt: typeof result.updatedAt === "number" ? result.updatedAt : null,
  };
}

function buildCloudSnapshot(): Record<string, unknown> {
  const snapshot: Record<string, unknown> = {};

  for (const [name, key] of Object.entries(CLOUD_KEYS)) {
    snapshot[name] = readJSON<unknown>(key, undefined);
  }

  return snapshot;
}

async function saveCloudSnapshot(): Promise<void> {
  if (!activeUserId || !cloudReady) {
    return;
  }

  const userId = activeUserId;
  const snapshot = buildCloudSnapshot();

  const operation = cloudSyncQueue.then(async () => {
    // Never upload one account's data after switching accounts.
    if (!activeUserId || activeUserId !== userId || !cloudReady) {
      return;
    }

    await requestCloudStorage("PUT", snapshot);
  });

  cloudSyncQueue = operation.catch((error) => {
    console.error("MartinezAI cloud save failed:", error);
  });

  await operation;
}

function scheduleCloudSave(): void {
  if (!activeUserId || !cloudReady) {
    return;
  }

  if (cloudTimer) {
    clearTimeout(cloudTimer);
  }

  cloudTimer = setTimeout(() => {
    cloudTimer = null;

    void saveCloudSnapshot().catch((error) => {
      console.error("MartinezAI cloud sync failed:", error);
    });
  }, 700);
}

function accountRecordKey(userId: string, key: string): string {
  return `${encodeURIComponent(userId)}::${key}`;
}

function defaultValueForKey(key: string): unknown {
  if (key === SETTINGS_KEY) return {};
  return [];
}

function activeKey(key: string): string {
  if (!activeUserId) {
    throw new Error("No authenticated MartinezAI account is active.");
  }

  return accountRecordKey(activeUserId, key);
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(
      new Error("IndexedDB is not supported in this browser."),
    );
  }

  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "key" });
        }
      };

      request.onsuccess = () => {
        const db = request.result;

        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };

        resolve(db);
      };

      request.onerror = () => {
        dbPromise = null;
        reject(request.error || new Error("Database could not be opened."));
      };
    });
  }

  return dbPromise;
}

async function getRecord(key: string): Promise<unknown | undefined> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).get(key);

    request.onsuccess = () => {
      const record = request.result as StoredRecord | undefined;
      resolve(record?.value);
    };

    request.onerror = () => {
      reject(request.error || new Error("Could not read saved data."));
    };
  });
}

function putRecord(key: string, value: unknown): Promise<void> {
  const operation = writeQueue.then(async () => {
    const db = await openDatabase();

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");

      tx.objectStore(STORE_NAME).put({ key, value });

      tx.oncomplete = () => resolve();

      tx.onerror = () => {
        reject(tx.error || new Error("Could not save data."));
      };

      tx.onabort = () => {
        reject(tx.error || new Error("Saving was cancelled."));
      };
    });
  });

  writeQueue = operation.catch((error) => {
    console.error("MartinezAI storage write failed:", error);
  });

  return operation;
}

function deleteRecord(key: string): Promise<void> {
  const operation = writeQueue.then(async () => {
    const db = await openDatabase();

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");

      tx.objectStore(STORE_NAME).delete(key);

      tx.oncomplete = () => resolve();

      tx.onerror = () => {
        reject(tx.error || new Error("Could not delete saved data."));
      };

      tx.onabort = () => {
        reject(tx.error || new Error("Deletion was cancelled."));
      };
    });
  });

  writeQueue = operation.catch((error) => {
    console.error("MartinezAI storage deletion failed:", error);
  });

  return operation;
}

function readJSON<T>(key: string, fallback: T): T {
  const recordKey = activeKey(key);

  const value = accountCache.get(recordKey);

  return value === undefined ? fallback : (value as T);
}

function writeJSON<T>(key: string, value: T): void {
  const recordKey = activeKey(key);

  accountCache.set(recordKey, value);

  void putRecord(recordKey, value).catch((error) => {
    console.error(`Could not save ${key}:`, error);
  });

  scheduleCloudSave();
}

function removeAccountItem(key: string): void {
  const recordKey = activeKey(key);
  accountCache.delete(recordKey);

  void deleteRecord(recordKey).catch((error) => {
    console.error(`Could not delete ${key}:`, error);
  });

  scheduleCloudSave();
}

export const DEFAULT_SETTINGS: UserSettings = {
  theme: "dark",
  defaultMode: "general",
  responseLength: "balanced",
  customInstructions: "",
  enableMemory: true,
  enableSearchGrounding: false,
  ttsVoice: "default",
  fontSize: "md",
  enableAutomaticMemory: true,
  enabledPlugins: ["weather", "calculator", "market", "world-clock"],
  downloadedPlugins: ["weather", "calculator", "market", "world-clock", "web-grounding"],
  profilePictureSummary: ""
};

export const StorageService = {
  async setUserId(userId: string): Promise<void> {
    if (typeof userId !== "string" || !userId.trim()) {
      throw new Error("A valid MartinezAI user ID is required.");
    }

    const normalizedUserId = userId.trim();

    if (
      activeUserId === normalizedUserId &&
      cloudReady &&
      ACCOUNT_DATA_KEYS.every((key) =>
        accountCache.has(accountRecordKey(normalizedUserId, key)),
      )
    ) {
      return;
    }

    // Each account switch invalidates unfinished initialization work.
    const generation = ++accountGeneration;

    // Stop pending cloud saves before switching accounts.
    if (cloudTimer) {
      clearTimeout(cloudTimer);
      cloudTimer = null;
    }

    cloudReady = false;
    accountCache.clear();
    activeUserId = normalizedUserId;

    const isCurrentAccount = () =>
      generation === accountGeneration && activeUserId === normalizedUserId;

    try {
      // STEP 1: Load this account's local records and migrate older records.
      for (const key of ACCOUNT_DATA_KEYS) {
        const recordKey = accountRecordKey(normalizedUserId, key);
        const saved = await getRecord(recordKey);

        if (!isCurrentAccount()) return;

        if (saved !== undefined) {
          accountCache.set(recordKey, saved);
          continue;
        }

        // Migrate account-scoped localStorage from older MartinezAI versions.
        const oldKey =
          `martins_ai_user_${encodeURIComponent(normalizedUserId)}__${key}`;
        const oldValue =
          typeof localStorage !== "undefined" ? localStorage.getItem(oldKey) : null;

        if (oldValue !== null) {
          const parsed = JSON.parse(oldValue) as unknown;

          if (!isCurrentAccount()) return;

          await putRecord(recordKey, parsed);

          if (!isCurrentAccount()) return;

          accountCache.set(recordKey, parsed);
          localStorage.removeItem(oldKey);
        } else {
          // Populate all known keys so repeated initialization is idempotent.
          accountCache.set(recordKey, defaultValueForKey(key));
        }
      }

      if (!isCurrentAccount()) return;

      // STEP 2: Fetch this authenticated user's cloud snapshot.
      let cloudResult: {
        data: Record<string, unknown> | null;
        updatedAt: number | null;
      };

      try {
        cloudResult = await requestCloudStorage("GET");
      } catch (error) {
        // Do not let a stale request alter the newly selected account's state.
        if (!isCurrentAccount()) return;

        console.error("MartinezAI could not load cloud data:", error);
        cloudReady = false;
        return;
      }

      if (!isCurrentAccount()) return;

      // STEP 3: Restore this account's cloud records if a snapshot exists.
      if (cloudResult.data) {
        for (const [name, key] of Object.entries(CLOUD_KEYS)) {
          if (!isCurrentAccount()) return;

          const recordKey = accountRecordKey(normalizedUserId, key);

          if (
            Object.prototype.hasOwnProperty.call(cloudResult.data, name) &&
            cloudResult.data[name] !== undefined
          ) {
            const value = cloudResult.data[name];

            accountCache.set(recordKey, value);
            await putRecord(recordKey, value);

            if (!isCurrentAccount()) return;
          }
        }
      }

      if (!isCurrentAccount()) return;

      cloudReady = true;

      if (!cloudResult.data) {
        // Initial cloud seeding is best-effort. A transient PUT failure must
        // not prevent a verified user from opening their locally saved app data.
        await saveCloudSnapshot().catch((error) => {
          if (isCurrentAccount()) {
            console.error("MartinezAI initial cloud save failed:", error);
          }
        });
      }
    } catch (error) {
      // An old initialization may fail after a different account has started.
      // It must not clear the new account's cache or report its failure upward.
      if (!isCurrentAccount()) return;

      cloudReady = false;
      activeUserId = null;
      accountCache.clear();

      console.error("MartinezAI storage initialization failed:", error);
      throw error;
    }
  },

  clearActiveUser(): void {
    accountGeneration++;

    if (cloudTimer) {
      clearTimeout(cloudTimer);
      cloudTimer = null;
    }

    cloudReady = false;
    activeUserId = null;
    accountCache.clear();
  },

  getSettings(): UserSettings {
    return {
      ...DEFAULT_SETTINGS,
      ...readJSON<Partial<UserSettings>>(SETTINGS_KEY, {}),
    };
  },

  getScheduledTasks(): ScheduledTask[] {
  const tasks = readJSON<ScheduledTask[]>(
    SCHEDULED_TASKS_KEY,
    [],
  );

  return Array.isArray(tasks)
    ? [...tasks].sort((a, b) => a.dueAt - b.dueAt)
    : [];
},

saveScheduledTasks(tasks: ScheduledTask[]): void {
  writeJSON(SCHEDULED_TASKS_KEY, tasks);
},
  
  saveSettings(settings: UserSettings): void {
    writeJSON(SETTINGS_KEY, settings);
  },

  getDownloadedPlugins(): string[] {
    const settings = this.getSettings();
    if (Array.isArray(settings.downloadedPlugins) && settings.downloadedPlugins.length > 0) {
      return settings.downloadedPlugins;
    }
    return DEFAULT_SETTINGS.downloadedPlugins || [];
  },

  saveDownloadedPlugins(plugins: string[]): void {
    const settings = this.getSettings();
    this.saveSettings({
      ...settings,
      downloadedPlugins: plugins,
    });
  },

  getProjects(): Project[] {
    const projects = readJSON<Project[]>(PROJECTS_KEY, []);

    return Array.isArray(projects)
      ? [...projects].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      : [];
  },

  saveProjects(projects: Project[]): void {
    writeJSON(PROJECTS_KEY, projects);
  },

  getProject(id: string): Project | null {
    return this.getProjects().find((project) => project.id === id) || null;
  },

  saveProject(project: Project): void {
    const projects = this.getProjects();
    const index = projects.findIndex((item) => item.id === project.id);

    const updatedProject: Project = {
      ...project,
      name: project.name.trim() || "Untitled Project",
      updatedAt: Date.now(),
    };

    if (index >= 0) {
      projects[index] = updatedProject;
    } else {
      projects.unshift(updatedProject);
    }

    this.saveProjects(projects);
  },

  deleteProject(id: string): void {
    this.saveProjects(
      this.getProjects().filter((project) => project.id !== id),
    );

    // Keep conversations, but remove their link to the deleted project.
    this.saveConversations(
      this.getConversations().map((conversation) =>
        conversation.projectId === id
          ? { ...conversation, projectId: undefined }
          : conversation,
      ),
    );

    // Keep artifacts, but remove their link to the deleted project.
    writeJSON(
      ARTIFACTS_KEY,
      this.getArtifacts().map((artifact) =>
        artifact.projectId === id
          ? { ...artifact, projectId: undefined }
          : artifact,
      ),
    );
  },

  getConversations(): Conversation[] {
    const conversations = readJSON<Conversation[]>(CONVERSATIONS_KEY, []);

    return Array.isArray(conversations)
      ? [...conversations].sort(
          (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0),
        )
      : [];
  },

  saveConversations(conversations: Conversation[]): void {
    writeJSON(CONVERSATIONS_KEY, conversations);
  },

  getConversation(id: string): Conversation | null {
    return (
      this.getConversations().find((conversation) => conversation.id === id) ||
      null
    );
  },

  saveConversation(conv: Conversation): void {
    const conversations = this.getConversations();
    const index = conversations.findIndex((item) => item.id === conv.id);

    const updated = {
      ...conv,
      updatedAt: Date.now(),
    };

    if (index >= 0) {
      conversations[index] = updated;
    } else {
      conversations.unshift(updated);
    }

    this.saveConversations(conversations);
  },

  deleteConversation(id: string): void {
    this.saveConversations(
      this.getConversations().filter((item) => item.id !== id),
    );
  },

  setConversationProject(
    conversationId: string,
    projectId: string | null,
  ): void {
    const conversations = this.getConversations();
    const index = conversations.findIndex(
      (conversation) => conversation.id === conversationId,
    );

    if (index === -1) {
      return;
    }

    conversations[index] = {
      ...conversations[index],
      projectId: projectId || undefined,
      updatedAt: Date.now(),
    };

    this.saveConversations(conversations);
  },

  deleteAllConversations(): void {
    removeAccountItem(CONVERSATIONS_KEY);
  },

  togglePin(id: string): void {
    const conversations = this.getConversations();
    const target = conversations.find((item) => item.id === id);

    if (target) {
      target.isPinned = !target.isPinned;
      this.saveConversations(conversations);
    }
  },

  toggleArchive(id: string): void {
    const conversations = this.getConversations();
    const target = conversations.find((item) => item.id === id);

    if (target) {
      target.isArchived = !target.isArchived;
      this.saveConversations(conversations);
    }
  },

  renameConversation(id: string, title: string): void {
    const conversations = this.getConversations();
    const target = conversations.find((item) => item.id === id);

    if (target) {
      target.title = title.trim() || "Untitled Conversation";
      target.updatedAt = Date.now();

      this.saveConversations(conversations);
    }
  },

  getMemories(): UserMemory[] {
    const memories = readJSON<UserMemory[]>(MEMORIES_KEY, []);
    return Array.isArray(memories) ? memories : [];
  },

  saveMemories(memories: UserMemory[]): void {
    writeJSON(MEMORIES_KEY, memories);
  },

  addMemory(text: string): UserMemory {
    const memory: UserMemory = {
      id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      text: text.trim(),
      createdAt: Date.now(),
      category: "other",
      source: "manual",
    };

    if (memory.text) {
      this.saveMemories([memory, ...this.getMemories()]);
    }

    return memory;
  },

  deleteMemory(id: string): void {
    this.saveMemories(this.getMemories().filter((memory) => memory.id !== id));
  },

  clearAllMemories(): void {
    removeAccountItem(MEMORIES_KEY);
  },

  getArtifacts(): Artifact[] {
    const artifacts = readJSON<Artifact[]>(ARTIFACTS_KEY, []);
    return Array.isArray(artifacts) ? artifacts : [];
  },

  saveArtifact(artifact: Artifact): void {
    const artifacts = this.getArtifacts();
    const index = artifacts.findIndex((item) => item.id === artifact.id);

    const updated = {
      ...artifact,
      updatedAt: Date.now(),
    };

    if (index >= 0) {
      artifacts[index] = updated;
    } else {
      artifacts.unshift(updated);
    }

    writeJSON(ARTIFACTS_KEY, artifacts);
  },

  deleteArtifact(id: string): void {
    writeJSON(
      ARTIFACTS_KEY,
      this.getArtifacts().filter((item) => item.id !== id),
    );
  },

  clearAllArtifacts(): void {
    removeAccountItem(ARTIFACTS_KEY);
  },

  getGeneratedImages(): GeneratedImage[] {
    const images = readJSON<GeneratedImage[]>(GENERATED_IMAGES_KEY, []);
    return Array.isArray(images) ? images : [];
  },

  saveGeneratedImage(image: GeneratedImage): void {
    const images = this.getGeneratedImages();
    const index = images.findIndex((item) => item.id === image.id);

    if (index >= 0) {
      images[index] = image;
    } else {
      images.unshift(image);
    }

    writeJSON(GENERATED_IMAGES_KEY, images);
  },

  deleteGeneratedImage(id: string): void {
    writeJSON(
      GENERATED_IMAGES_KEY,
      this.getGeneratedImages().filter((item) => item.id !== id),
    );
  },

  clearGeneratedImages(): void {
    removeAccountItem(GENERATED_IMAGES_KEY);
  },

  exportConversationMarkdown(conv: Conversation): string {
    let markdown = `# ${conv.title}\n\n`;

    markdown +=
      `*Mode: ${conv.mode} | ` +
      `Date: ${new Date(conv.createdAt).toLocaleString()}*\n\n---\n\n`;

    for (const message of conv.messages) {
      const sender = message.role === "user" ? "**You**" : "**MartinezAI**";

      markdown +=
        `### ${sender} ` +
        `(${new Date(message.timestamp).toLocaleTimeString()})\n\n`;

      markdown += `${message.content}\n\n`;

      if (message.groundingSources?.length) {
        markdown += "*Sources:*\n";

        for (const source of message.groundingSources) {
          markdown += `- [${source.title}](${source.uri})\n`;
        }

        markdown += "\n";
      }
    }

    return markdown;
  },

  exportConversationJSON(conv: Conversation): string {
    return JSON.stringify(conv, null, 2);
  },
};
