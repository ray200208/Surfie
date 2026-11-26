import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Network, ExternalLink } from 'lucide-react';
import type { ExecutionLayer } from '../../shared/types';

interface ComparePanelProps {
  onLayerChange: (layer: ExecutionLayer) => void;
}

interface OpenTabItem {
  id: number;
  title: string;
  url: string;
  favIconUrl?: string;
}

export const ComparePanel: React.FC<ComparePanelProps> = ({ onLayerChange }) => {
  const [tabs, setTabs] = useState<OpenTabItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  const loadOpenTabs = useCallback(() => {
    onLayerChange('LAYER_A_STRUCTURED');
    if (typeof chrome === 'undefined' || !chrome.tabs?.query) return;

    setLoading(true);
    chrome.tabs.query({ currentWindow: true }, (found) => {
      const normalized: OpenTabItem[] = found
        .filter((t): t is chrome.tabs.Tab & { id: number } => typeof t.id === 'number')
        .map((t) => ({
          id: t.id,
          title: t.title || t.url || 'Untitled Tab',
          url: t.url || '',
          favIconUrl: t.favIconUrl,
        }));
      setTabs(normalized);
      setLoading(false);
    });
  }, [onLayerChange]);

  useEffect(() => {
    loadOpenTabs();
  }, [loadOpenTabs]);

  const toggleTab = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-3.5">
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-xs space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#331E6D]">
              Mode 2 • Teammate 2 (Visual Whiteboard)
            </span>
            <h2 className="text-sm font-bold text-[#1E1B4B] mt-0.5">
              Open Window Tabs ({tabs.length})
            </h2>
            <p className="text-[11px] text-[#475569] mt-0.5">
              Select tabs below to feed into the @xyflow/react Mind Map and deterministic True-Cost extractor.
            </p>
          </div>
          <button
            onClick={loadOpenTabs}
            title="Refresh Open Tabs"
            className="rounded-lg border border-[#E2E8F0] bg-[#F8F9FC] p-2 text-[#475569] hover:text-[#331E6D] cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
          {tabs.map((tab) => {
            const checked = selectedIds.includes(tab.id);
            return (
              <label
                key={tab.id}
                className={`flex items-center gap-2.5 rounded-xl border p-2.5 cursor-pointer transition-all ${
                  checked
                    ? 'border-[#331E6D] bg-[#F3F0FF]/60'
                    : 'border-[#E2E8F0] bg-[#F8F9FC] hover:bg-white'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleTab(tab.id)}
                  className="h-3.5 w-3.5 accent-[#331E6D] cursor-pointer shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-[#1E1B4B] truncate">{tab.title}</div>
                  <div className="font-mono text-[10px] text-[#64748B] truncate">{tab.url}</div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    chrome.tabs?.update(tab.id, { active: true });
                  }}
                  title="Switch to tab"
                  className="rounded-md p-1 text-[#64748B] hover:text-[#331E6D] cursor-pointer shrink-0"
                >
                  <ExternalLink className="h-3 w-3" />
                </button>
              </label>
            );
          })}
        </div>

        <div className="rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8F9FC] p-3 text-center space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#331E6D]">
            <Network className="h-3.5 w-3.5" />
            Ready for @xyflow/react Whiteboard ({selectedIds.length} selected)
          </div>
          <p className="text-[10px] text-[#64748B]">
            @xyflow/react is pre-installed. Teammate 2 can build the comparison canvas directly inside{' '}
            <code className="font-mono">src/features/compare/</code>.
          </p>
        </div>
      </div>
    </div>
  );
};
