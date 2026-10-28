import React, { useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Trash2,
  ExternalLink,
  Globe2,
  LoaderCircle,
  Play,
  Search,
  Sparkles,
  TerminalSquare,
  Zap,
  Star,
  Check,
  Package,
} from "lucide-react";
import {
  ASSISTANT_PLUGINS,
  type AssistantPlugin,
} from "../plugins/registry";
import {
  ApiService,
  type PluginRunResult,
} from "../services/api";

interface PluginsScreenProps {
  downloadedPlugins?: string[];
  enabledPlugins?: string[];
  isLight: boolean;
  onDownloadChange?: (downloaded: string[]) => void;
  onChange?: (enabled: string[]) => void;
  onBack: () => void;
  onUseInChat: (message: string) => void;
}

type StoreCategory = "all" | "downloaded" | "realtime" | "finance" | "utility" | "developer";

export const PluginsScreen: React.FC<PluginsScreenProps> = ({
  downloadedPlugins = ["weather", "calculator", "market"],
  enabledPlugins = [],
  isLight,
  onDownloadChange,
  onChange,
  onBack,
  onUseInChat,
}) => {
  const [activeCategory, setActiveCategory] = useState<StoreCategory>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPlaygroundPlugin, setSelectedPlaygroundPlugin] = useState<AssistantPlugin | null>(null);
  const [playgroundInput, setPlaygroundInput] = useState("");
  const [playgroundRunning, setPlaygroundRunning] = useState(false);
  const [playgroundResult, setPlaygroundResult] = useState<PluginRunResult | null>(null);
  const [playgroundError, setPlaygroundError] = useState("");

  // Determine current downloaded set
  const currentDownloaded = useMemo(() => {
    return new Set(downloadedPlugins);
  }, [downloadedPlugins]);

  // Handle Download / Install
  const handleToggleDownload = (pluginId: string) => {
    let next: string[];
    if (currentDownloaded.has(pluginId)) {
      next = downloadedPlugins.filter((id) => id !== pluginId);
    } else {
      next = [...downloadedPlugins, pluginId];
    }
    if (onDownloadChange) {
      onDownloadChange(next);
    }
    if (onChange) {
      onChange(next);
    }
  };

  // Filter plugins
  const filteredPlugins = useMemo(() => {
    return ASSISTANT_PLUGINS.filter((plugin) => {
      // Category filter
      if (activeCategory === "downloaded" && !currentDownloaded.has(plugin.id)) {
        return false;
      }
      if (activeCategory === "realtime" && !plugin.isRealtime) {
        return false;
      }
      if (activeCategory === "finance" && plugin.category !== "finance") {
        return false;
      }
      if (activeCategory === "utility" && plugin.category !== "utility") {
        return false;
      }
      if (activeCategory === "developer" && plugin.category !== "developer") {
        return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesName = plugin.name.toLowerCase().includes(q);
        const matchesDesc = plugin.description.toLowerCase().includes(q);
        const matchesAuthor = plugin.author.toLowerCase().includes(q);
        const matchesFeatures = plugin.features.some((f) => f.toLowerCase().includes(q));
        return matchesName || matchesDesc || matchesAuthor || matchesFeatures;
      }

      return true;
    });
  }, [activeCategory, currentDownloaded, searchTerm]);

  // Run test in playground
  const handleRunPlayground = async () => {
    if (!selectedPlaygroundPlugin || !playgroundInput.trim()) return;

    setPlaygroundRunning(true);
    setPlaygroundError("");
    setPlaygroundResult(null);

    try {
      const res = await ApiService.runPlugin({
        pluginId: selectedPlaygroundPlugin.id,
        input: playgroundInput,
      });
      setPlaygroundResult(res);
    } catch (err: any) {
      setPlaygroundError(err?.message || "Failed to execute plugin preview");
    } finally {
      setPlaygroundRunning(false);
    }
  };

  return (
    <div
      className={`min-h-screen flex flex-col ${
        isLight ? "bg-slate-50 text-slate-900" : "bg-neutral-950 text-neutral-100"
      }`}
    >
      {/* Top Header */}
      <header
        className={`sticky top-0 z-20 border-b backdrop-blur-md px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 ${
          isLight
            ? "border-slate-200/80 bg-white/85 shadow-sm"
            : "border-neutral-800/80 bg-neutral-900/85"
        }`}
      >
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className={`p-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 text-sm font-medium ${
              isLight
                ? "bg-slate-100 hover:bg-slate-200 text-slate-700"
                : "bg-neutral-800 hover:bg-neutral-700 text-neutral-200"
            }`}
          >
            <ArrowLeft size={16} />
            <span>Back to chat</span>
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight">Plugin Store</h1>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                ChatGPT Model
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              Download plugins to your workspace. Activate them individually inside the chat composer.
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none"
          />
          <input
            type="text"
            placeholder="Search plugins and live tools..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full pl-9 pr-4 py-2 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/30 ${
              isLight
                ? "bg-slate-100/80 border-slate-200 focus:bg-white text-slate-900"
                : "bg-neutral-900 border-neutral-700 focus:border-neutral-600 text-neutral-100"
            }`}
          />
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-6 flex flex-col gap-6">
        {/* Banner with ChatGPT Plugin Mechanics */}
        <div
          className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
            isLight
              ? "bg-gradient-to-r from-emerald-50/80 to-teal-50/50 border-emerald-200 text-emerald-950"
              : "bg-gradient-to-r from-emerald-950/20 to-teal-950/10 border-emerald-800/40 text-emerald-200"
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-500 mt-0.5">
              <Zap size={18} />
            </div>
            <div>
              <h2 className="text-sm font-semibold">How ChatGPT Plugins Work</h2>
              <p className="text-xs opacity-90 mt-0.5">
                Download plugins in this store to make them available in your workspace. Once downloaded, open your chat composer and click the <strong>Plugins</strong> button to activate up to 3 plugins for your live conversation.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold shrink-0">
            <span className="px-3 py-1.5 rounded-xl bg-emerald-500 text-white shadow-sm flex items-center gap-1.5">
              <Package size={14} />
              {currentDownloaded.size} Installed
            </span>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {(
            [
              { id: "all", label: "All Plugins" },
              { id: "downloaded", label: `Downloaded (${currentDownloaded.size})` },
              { id: "realtime", label: "⚡ Real-Time Tools" },
              { id: "finance", label: "Finance & Crypto" },
              { id: "utility", label: "Utilities" },
              { id: "developer", label: "Developer" },
            ] as const
          ).map((tab) => {
            const isActive = activeCategory === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveCategory(tab.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? isLight
                      ? "bg-slate-900 text-white shadow-sm"
                      : "bg-neutral-100 text-neutral-900 font-semibold"
                    : isLight
                    ? "bg-slate-200/70 hover:bg-slate-200 text-slate-700"
                    : "bg-neutral-900 hover:bg-neutral-800 text-neutral-300"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Plugin Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredPlugins.map((plugin) => {
            const isDownloaded = currentDownloaded.has(plugin.id);

            return (
              <div
                key={plugin.id}
                className={`flex flex-col justify-between p-5 rounded-2xl border transition-all hover:shadow-lg ${
                  isLight
                    ? "bg-white border-slate-200/80 hover:border-slate-300 shadow-sm"
                    : "bg-neutral-900/90 border-neutral-800 hover:border-neutral-700"
                }`}
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                          plugin.isRealtime
                            ? "bg-emerald-500/15 text-emerald-500 border border-emerald-500/30"
                            : isLight
                            ? "bg-slate-100 text-slate-800 border border-slate-200"
                            : "bg-neutral-800 text-neutral-200 border border-neutral-700"
                        }`}
                      >
                        {plugin.icon}
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm leading-snug flex items-center gap-1.5">
                          {plugin.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-neutral-400">
                          <span>by {plugin.author}</span>
                          <span>•</span>
                          <span className="flex items-center gap-0.5 text-amber-500 font-medium">
                            <Star size={11} className="fill-amber-500" />
                            {plugin.rating}
                          </span>
                        </div>
                      </div>
                    </div>

                    {plugin.isRealtime && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 shrink-0">
                        Live API
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  <p className="text-xs text-neutral-400 leading-relaxed mb-4 line-clamp-3">
                    {plugin.description}
                  </p>

                  {/* Features Tag Pills */}
                  <div className="flex flex-wrap gap-1.5 mb-5">
                    {plugin.features.slice(0, 3).map((feat, i) => (
                      <span
                        key={i}
                        className={`text-[11px] px-2.5 py-1 rounded-lg ${
                          isLight
                            ? "bg-slate-100 text-slate-600"
                            : "bg-neutral-800/80 text-neutral-300"
                        }`}
                      >
                        {feat}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div
                  className={`pt-4 border-t flex items-center justify-between gap-2 ${
                    isLight ? "border-slate-100" : "border-neutral-800"
                  }`}
                >
                  <button
                    onClick={() => {
                      setSelectedPlaygroundPlugin(plugin);
                      setPlaygroundInput(plugin.sampleInput);
                      setPlaygroundResult(null);
                      setPlaygroundError("");
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                      isLight
                        ? "bg-slate-100 hover:bg-slate-200 text-slate-700"
                        : "bg-neutral-800 hover:bg-neutral-700 text-neutral-200"
                    }`}
                  >
                    <Play size={12} />
                    <span>Quick Test</span>
                  </button>

                  {isDownloaded ? (
                    <div className="flex items-center gap-1.5">
                      <span className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 flex items-center gap-1">
                        <Check size={13} />
                        Downloaded
                      </span>
                      <button
                        title="Uninstall plugin"
                        onClick={() => handleToggleDownload(plugin.id)}
                        className={`p-1.5 rounded-xl transition-all cursor-pointer ${
                          isLight
                            ? "hover:bg-rose-50 text-neutral-400 hover:text-rose-600"
                            : "hover:bg-rose-950/40 text-neutral-400 hover:text-rose-400"
                        }`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleToggleDownload(plugin.id)}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                    >
                      <Download size={13} />
                      <span>Download</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {filteredPlugins.length === 0 && (
          <div
            className={`py-16 text-center rounded-2xl border ${
              isLight ? "bg-white border-slate-200" : "bg-neutral-900 border-neutral-800"
            }`}
          >
            <Package size={36} className="mx-auto text-neutral-400 mb-3" />
            <h3 className="text-base font-semibold">No plugins found</h3>
            <p className="text-xs text-neutral-400 max-w-sm mx-auto mt-1">
              Try searching with another keyword or select the "All Plugins" category.
            </p>
          </div>
        )}

        {/* Playground Modal / Drawer */}
        {selectedPlaygroundPlugin && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div
              className={`w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col ${
                isLight ? "bg-white border-slate-200" : "bg-neutral-900 border-neutral-800"
              }`}
            >
              {/* Modal Header */}
              <div
                className={`px-6 py-4 border-b flex items-center justify-between ${
                  isLight ? "border-slate-200 bg-slate-50" : "border-neutral-800 bg-neutral-900"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-500">
                    {selectedPlaygroundPlugin.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">
                      {selectedPlaygroundPlugin.name} Playground
                    </h3>
                    <p className="text-xs text-neutral-400">
                      Test real-time execution directly with live payloads
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedPlaygroundPlugin(null)}
                  className="p-1 rounded-lg text-neutral-400 hover:text-neutral-200 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 flex flex-col gap-4">
                <div>
                  <label className="text-xs font-semibold mb-1 block">Input Request</label>
                  <textarea
                    rows={3}
                    value={playgroundInput}
                    onChange={(e) => setPlaygroundInput(e.target.value)}
                    placeholder={selectedPlaygroundPlugin.placeholder}
                    className={`w-full p-3 rounded-xl text-xs font-mono border transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/30 ${
                      isLight
                        ? "bg-slate-50 border-slate-300 text-slate-900"
                        : "bg-neutral-950 border-neutral-700 text-neutral-100"
                    }`}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-[11px] text-neutral-400">
                    Engine:{" "}
                    <span className="font-semibold">
                      {selectedPlaygroundPlugin.isRealtime ? "Live Service / AST" : "Gemini Server"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        onUseInChat(playgroundInput);
                        setSelectedPlaygroundPlugin(null);
                        onBack();
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                        isLight
                          ? "bg-slate-200 hover:bg-slate-300 text-slate-800"
                          : "bg-neutral-800 hover:bg-neutral-700 text-neutral-200"
                      }`}
                    >
                      Use in Chat
                    </button>
                    <button
                      onClick={handleRunPlayground}
                      disabled={playgroundRunning || !playgroundInput.trim()}
                      className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white shadow-sm flex items-center gap-1.5 cursor-pointer"
                    >
                      {playgroundRunning ? (
                        <>
                          <LoaderCircle size={13} className="animate-spin" />
                          <span>Running...</span>
                        </>
                      ) : (
                        <>
                          <Play size={13} />
                          <span>Execute Plugin</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Output payload */}
                {playgroundError && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono">
                    {playgroundError}
                  </div>
                )}

                {playgroundResult && (
                  <div>
                    <label className="text-xs font-semibold mb-1 block">Execution Response</label>
                    <div
                      className={`p-3.5 rounded-xl text-xs font-mono max-h-56 overflow-y-auto ${
                        isLight ? "bg-slate-100 text-slate-800" : "bg-neutral-950 text-emerald-400"
                      }`}
                    >
                      {playgroundResult.raw ? (
                        <pre className="whitespace-pre-wrap">
                          {JSON.stringify(playgroundResult.raw, null, 2)}
                        </pre>
                      ) : (
                        <p className="whitespace-pre-wrap">{playgroundResult.output}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};