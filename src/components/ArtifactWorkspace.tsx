import React, { useState, useEffect } from "react";
import { Artifact } from "../types";
import {
  Code2,
  Eye,
  Download,
  Copy,
  Check,
  Sparkles,
  X,
  FileCode,
  FileText,
} from "lucide-react";

import DOMPurify from "dompurify";

import { marked } from "marked";

interface ArtifactWorkspaceProps {
  artifact: Artifact | null;
  onUpdateArtifact: (artifact: Artifact) => void;
  onClose: () => void;
  onAskImprovement: (instruction: string) => void;
}

const EXTENSIONS_MAP: Record<string, string> = {
  javascript: "js",
  typescript: "ts",
  html: "html",
  css: "css",
  json: "json",
  markdown: "md",
  python: "py",
  sql: "sql",
  text: "txt",
};

export const ArtifactWorkspace: React.FC<ArtifactWorkspaceProps> = ({
  artifact,
  onUpdateArtifact,
  onClose,
  onAskImprovement,
}) => {
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [language, setLanguage] = useState("javascript");
  const [activeTab, setActiveTab] = useState<"editor" | "preview">("editor");
  const [isCopied, setIsCopied] = useState(false);
  const [improvePrompt, setImprovePrompt] = useState("");
  const [showImproveInput, setShowImproveInput] = useState(false);

  useEffect(() => {
    if (artifact) {
      setContent(artifact.content);
      setTitle(artifact.title);
      setLanguage(artifact.language.toLowerCase() || "javascript");
      if (
        artifact.language.toLowerCase() === "html" ||
        artifact.language.toLowerCase() === "markdown"
      ) {
        setActiveTab("preview");
      } else {
        setActiveTab("editor");
      }
    }
  }, [artifact]);

  if (!artifact) return null;

  const handleContentChange = (newVal: string) => {
    setContent(newVal);
    onUpdateArtifact({
      ...artifact,
      content: newVal,
      title,
      language,
      updatedAt: Date.now(),
    });
  };

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    onUpdateArtifact({
      ...artifact,
      content,
      title: newTitle,
      language,
      updatedAt: Date.now(),
    });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleDownload = () => {
    const ext = EXTENSIONS_MAP[language] || "txt";
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.toLowerCase().replace(/[^a-z0-9]/g, "_") || "artifact"}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleTriggerImprovement = () => {
    if (!improvePrompt.trim()) return;
    onAskImprovement(
      `Please revise and improve the following ${language} artifact "${title}":\n\nInstructions: ${improvePrompt}\n\n\`\`\`${language}\n${content}\n\`\`\``,
    );
    setImprovePrompt("");
    setShowImproveInput(false);
  };

  // Safe preview generation for HTML
  const isHtml = language === "html";
  const isMarkdown = language === "markdown" || language === "md";

  return (
    <div className="flex flex-col h-full bg-neutral-950 border-l border-neutral-900 w-full md:w-[480px] lg:w-[560px] xl:w-[620px] transition-all">
      {/* Top Header */}
      <div className="p-3 border-b border-neutral-900 flex items-center justify-between bg-neutral-900/60 backdrop-blur-md">
        <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
          <FileCode size={16} className="text-indigo-400 shrink-0" />
          <input
            type="text"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="bg-transparent text-sm font-semibold text-white focus:outline-none focus:bg-neutral-800/80 px-1.5 py-0.5 rounded truncate w-full"
            placeholder="Artifact Title"
          />
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Tab Switcher */}
          {(isHtml || isMarkdown) && (
            <div className="flex items-center p-0.5 rounded-lg bg-neutral-800 text-xs mr-2">
              <button
                type="button"
                onClick={() => setActiveTab("editor")}
                className={`px-2 py-1 rounded-md font-medium transition-colors ${
                  activeTab === "editor"
                    ? "bg-neutral-700 text-white shadow-xs"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                Code
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("preview")}
                className={`px-2 py-1 rounded-md font-medium transition-colors ${
                  activeTab === "preview"
                    ? "bg-neutral-700 text-white shadow-xs"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                Preview
              </button>
            </div>
          )}

          {/* Download */}
          <button
            type="button"
            onClick={handleDownload}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            title="Download artifact"
          >
            <Download size={15} />
          </button>

          {/* Copy */}
          <button
            type="button"
            onClick={handleCopy}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            title="Copy content"
          >
            {isCopied ? (
              <Check size={15} className="text-emerald-400" />
            ) : (
              <Copy size={15} />
            )}
          </button>

          {/* Close */}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            title="Close workspace"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Language & Actions Bar */}
      <div className="px-3 py-2 bg-neutral-900/30 border-b border-neutral-900 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-neutral-400">Language:</span>
          <select
            value={language}
            onChange={(e) => {
              setLanguage(e.target.value);
              onUpdateArtifact({ ...artifact, language: e.target.value });
            }}
            className="bg-neutral-800 text-neutral-200 rounded px-2 py-0.5 border border-neutral-700 text-xs focus:outline-none"
          >
            <option value="javascript">JavaScript</option>
            <option value="typescript">TypeScript</option>
            <option value="html">HTML</option>
            <option value="css">CSS</option>
            <option value="markdown">Markdown</option>
            <option value="json">JSON</option>
            <option value="python">Python</option>
            <option value="sql">SQL</option>
            <option value="text">Plain Text</option>
          </select>
        </div>

        <button
          type="button"
          onClick={() => setShowImproveInput(!showImproveInput)}
          className="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 font-medium"
        >
          <Sparkles size={13} />
          <span>Ask AI to refine</span>
        </button>
      </div>

      {/* AI Refinement Drawer */}
      {showImproveInput && (
        <div className="p-3 bg-neutral-900 border-b border-neutral-800 space-y-2">
          <input
            type="text"
            value={improvePrompt}
            onChange={(e) => setImprovePrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleTriggerImprovement();
            }}
            placeholder="e.g., Add error handling, convert to TypeScript, format as clean table..."
            className="w-full px-3 py-1.5 rounded-lg bg-neutral-950 border border-neutral-700 text-white text-xs focus:outline-none focus:border-indigo-500"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowImproveInput(false)}
              className="px-2.5 py-1 text-xs text-neutral-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleTriggerImprovement}
              className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium"
            >
              Send to Martins AI
            </button>
          </div>
        </div>
      )}

      {/* Workspace Editor Body */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab === "editor" || (!isHtml && !isMarkdown) ? (
          <textarea
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            className="w-full h-full p-4 bg-neutral-950 text-neutral-200 font-mono text-xs md:text-sm leading-relaxed resize-none focus:outline-none selection:bg-indigo-600/40"
            spellCheck={false}
          />
        ) : isHtml ? (
          /* Sandboxed HTML preview iframe */
          <iframe
            title="Safe Preview"
            srcDoc={content}
            sandbox="allow-scripts"
            className="w-full h-full bg-white border-0"
          />
        ) : (
          /* Markdown Live Preview */
          <div className="w-full h-full p-5 overflow-y-auto text-neutral-200 markdown-body bg-neutral-950">
            <div
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(
                  marked.parse(content || "") as string,
                  {
                    USE_PROFILES: { html: true },
                  },
                ),
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
