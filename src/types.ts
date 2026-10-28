export type AssistantMode = 'general' | 'study' | 'coding' | 'writing' | 'research' | 'brainstorming';

export interface Attachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  data: string; // Base64
  previewUrl?: string;
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface PluginInvocation {
  callId: string;
  pluginId: string;
  pluginName: string;
  action: string;
  request: Record<string, unknown>;
  response?: Record<string, unknown>;
  status: "running" | "completed" | "error";
  error?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  chatType?: "text" | "voice";
  attachments?: Attachment[];
  groundingSources?: GroundingSource[];
  feedback?: 'like' | 'dislike' | null;
  error?: boolean;
  mode?: AssistantMode;
  thinkHarder?: boolean;
  pluginInvocations?: PluginInvocation[];
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  mode: AssistantMode;
  messages: Message[];
  projectId?: string;
  isPinned?: boolean;
  isArchived?: boolean;
  activePlugins?: string[];
}

export interface Project {
  id: string;
  name: string;
  description: string;
  instructions: string;
  summary: string;
  color: string;
  createdAt: number;
  updatedAt: number;
}

export type MemoryCategory =
  | "instruction"
  | "preference"
  | "project"
  | "goal"
  | "other";

export interface UserMemory {
  id: string;
  text: string;
  createdAt: number;
  updatedAt?: number;
  category?: MemoryCategory;
  source?: "manual" | "automatic";
}

export interface MemorySuggestion {
  action: "add" | "update";
  existingId?: string | null;
  text: string;
  category: MemoryCategory;
}

export type ScheduledRepeat = "none" | "daily" | "weekly";

/** A reminder checked by MartinezAI while the application is open. */
export interface ScheduledTask {
  id: string;
  title: string;
  prompt: string;
  dueAt: number;
  repeat: ScheduledRepeat;
  enabled: boolean;
  createdAt: number;
  /** The occurrence that was most recently delivered, stored as its dueAt. */
  lastNotifiedAt?: number;
}

export interface UserSettings {
  theme: 'dark' | 'light';
  defaultMode: AssistantMode;
  responseLength: 'balanced' | 'concise' | 'detailed';
  customInstructions: string;
  enableMemory: boolean;
  enableSearchGrounding: boolean;
  ttsVoice: string;
  fontSize: 'sm' | 'md' | 'lg';
  enabledPlugins: string[];
  downloadedPlugins?: string[];
  enableAutomaticMemory: boolean;
  profilePictureSummary?: string;
}

export interface Artifact {
  id: string;
  title: string;
  language: string;
  content: string;
  projectId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface SavedLibraryImage {
  id: string;
  prompt: string;
  createdAt: number;
  mimeType: string;
  model?: string;
  width?: number;
  height?: number;
}

export interface GeneratedImage {
  id: string;
  prompt: string;
  imageUrl: string;
  createdAt: number;
  updatedAt?: number;
  conversationId?: string;
  messageId?: string;
  model?: string;
  mimeType?: string;
  width?: number;
  height?: number;
  metadata?: Record<string, unknown>;
}

export interface UnsplashPhoto {
  id: string;
  altDescription: string;
  width: number;
  height: number;

  urls: {
    thumb: string;
    regular: string;
    full: string;
  };

  photographerName: string;
  photographerUrl: string;
  photoPageUrl: string;
  downloadLocation: string;
}

export interface UnsplashSearchResponse {
  total: number;
  totalPages: number;
  results: UnsplashPhoto[];
}