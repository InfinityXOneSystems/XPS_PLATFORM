"use client";

import { useEffect, useRef, useState } from "react";
import { Activity, AlertCircle, CheckCircle, Info } from "lucide-react";
import { getAgentActivity, type AgentActivityEntry } from "@/lib/runtimeClient";

interface AgentActivityFeedProps {
  /** Auto-refresh interval in ms. 0 = no refresh. */
  refreshIntervalMs?: number;
  /** Maximum entries to display. */
  maxEntries?: number;
  /** Filter to a specific agent name. */
  agentFilter?: string;
}

const LEVEL_ICONS: Record<string, React.ReactNode> = {
  info: <Info className="h-3 w-3 text-blue-400 shrink-0" />,
  warning: <AlertCircle className="h-3 w-3 text-yellow-400 shrink-0" />,
  error: <AlertCircle className="h-3 w-3 text-red-400 shrink-0" />,
  debug: <CheckCircle className="h-3 w-3 text-gray-300 shrink-0" />,
};

const LEVEL_COLOURS: Record<string, string> = {
  info: "text-gray-700",
  warning: "text-yellow-700",
  error: "text-red-700",
  debug: "text-gray-400",
};

function EntryRow({ entry }: { entry: AgentActivityEntry }) {
  const icon = LEVEL_ICONS[entry.level] ?? LEVEL_ICONS.info;
  const textColour = LEVEL_COLOURS[entry.level] ?? LEVEL_COLOURS.info;
  const time = new Date(entry.timestamp * 1000).toLocaleTimeString();

  return (
    <div className="flex items-start gap-2 border-b border-gray-50 py-1.5 last:border-0">
      <span className="mt-0.5">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-medium text-gray-500">{entry.agent}</span>
          {entry.task_id && (
            <span className="font-mono text-gray-300">
              {entry.task_id.slice(0, 8)}
            </span>
          )}
          <span className="ml-auto text-gray-300 tabular-nums">{time}</span>
        </div>
        <p className={`mt-0.5 text-xs ${textColour} break-words`}>
          {entry.message}
        </p>
      </div>
    </div>
  );
}

export default function AgentActivityFeed({
  refreshIntervalMs = 5000,
  maxEntries = 50,
  agentFilter,
}: AgentActivityFeedProps) {
  const [entries, setEntries] = useState<AgentActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);

  const fetchEntries = async () => {
    try {
      const data = await getAgentActivity(maxEntries);
      let items = data.entries;
      if (agentFilter) {
        items = items.filter((e) => e.agent === agentFilter);
      }
      setEntries(items);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load activity");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
    if (refreshIntervalMs <= 0) return;
    const timer = setInterval(fetchEntries, refreshIntervalMs);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshIntervalMs, maxEntries, agentFilter]);

  // Auto-scroll when new entries arrive
  useEffect(() => {
    if (entries.length > prevCountRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevCountRef.current = entries.length;
  }, [entries.length]);

  return (
    <div className="flex h-full flex-col rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-purple-500" />
          <h2 className="text-sm font-semibold text-gray-700">
            Agent Activity
          </h2>
        </div>
        {agentFilter && (
          <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700">
            {agentFilter}
          </span>
        )}
        <span className="ml-auto text-xs text-gray-400">
          {entries.length} entries
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {loading && entries.length === 0 && (
          <p className="text-center text-sm text-gray-400 py-8">
            Loading activity…
          </p>
        )}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-600">
            {error}
          </div>
        )}
        {!loading && !error && entries.length === 0 && (
          <p className="text-center text-sm text-gray-400 py-8">
            No agent activity yet. Submit a command to get started.
          </p>
        )}
        {entries.map((entry, i) => (
          <EntryRow key={`${entry.timestamp}-${i}`} entry={entry} />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
