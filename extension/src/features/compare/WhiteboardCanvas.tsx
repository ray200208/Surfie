import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  MapPin,
  ShieldAlert,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  X,
} from 'lucide-react';
import type { CompareSessionState, WhiteboardOption } from './compareTypes';
import { formatMoney } from './trueCostEngine';

interface GoalNodeData extends Record<string, unknown> {
  goal: string;
  category: string;
  answers: Record<string, string>;
  winnerName: string;
  winnerCost: string;
  poweredBy: string;
}

interface OptionNodeData extends Record<string, unknown> {
  option: WhiteboardOption;
  isWinner: boolean;
  onToggleAddon: (optionId: string) => void;
  onJumpToAnchor: (
    option: WhiteboardOption,
    selector: string,
    message: string,
    variant: 'spotlight' | 'warning' | 'success'
  ) => void;
  onInspectOption: (option: WhiteboardOption) => void;
}

const GoalNode: React.FC<NodeProps<Node<GoalNodeData>>> = ({ data }) => {
  const answerChips = Object.values(data.answers).filter(Boolean).slice(0, 3);
  return (
    <div className="w-[315px] rounded-2xl border-2 border-[#331E6D] bg-gradient-to-br from-[#331E6D] to-[#1E1B4B] p-4 text-white shadow-lg">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#FDE68A]">
          <Sparkles className="h-3 w-3" /> {data.category} Comparison
        </span>
        <span className="rounded-full bg-[#059669] px-2 py-0.5 text-[9px] font-bold text-white truncate max-w-[130px]">
          {data.poweredBy}
        </span>
      </div>

      <div className="mt-2 text-sm font-extrabold leading-snug">{data.goal}</div>

      {answerChips.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {answerChips.map((chip, i) => (
            <span
              key={i}
              className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-medium text-purple-100"
            >
              {chip}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 rounded-lg bg-white/10 px-3 py-1.5 text-xs flex items-center justify-between gap-2">
        <span className="text-purple-200">Top Pick:</span>
        <span className="font-bold text-[#6EE7B7] truncate">
          {data.winnerName} ({data.winnerCost})
        </span>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-[#D9433B] !w-3 !h-3 !border-2 !border-white"
      />
    </div>
  );
};

const OptionNode: React.FC<NodeProps<Node<OptionNodeData>>> = ({ data }) => {
  const { option, isWinner, onToggleAddon, onJumpToAnchor, onInspectOption } = data;
  const hasTraps = option.darkPatterns.length > 0;
  const specEntries = Object.entries(option.specs).slice(0, 3);

  return (
    <div
      className={`w-[290px] rounded-2xl border bg-white p-3.5 shadow-md transition-all ${
        isWinner
          ? 'border-[#059669] ring-2 ring-[#059669]/20'
          : hasTraps
            ? 'border-[#FDE68A]'
            : 'border-[#E2E8F0]'
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-[#331E6D] !w-3 !h-3 !border-2 !border-white"
      />

      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => onInspectOption(option)}
            className="text-left text-sm font-extrabold text-[#1E1B4B] hover:text-[#331E6D] cursor-pointer leading-tight line-clamp-2"
          >
            {option.name}
          </button>
          <div className="mt-0.5 font-mono text-[10px] text-[#64748B] truncate">
            {option.domain} {option.rating ? `• ★ ${option.rating}` : ''}
          </div>
        </div>

        <span
          className={`rounded-full px-2 py-0.5 text-[9px] font-bold shrink-0 border ${
            isWinner
              ? 'bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]'
              : hasTraps
                ? 'bg-[#FFFBEB] text-[#D97706] border-[#FDE68A]'
                : 'bg-[#F3F0FF] text-[#331E6D] border-[#DDD6FE]'
          }`}
        >
          {option.badge}
        </span>
      </div>

      {/* Deterministic True-Cost Box */}
      <div className="mt-2.5 grid grid-cols-2 gap-2 rounded-xl bg-[#F8F9FC] border border-[#E2E8F0] p-2.5">
        <div>
          <div className="text-[9px] font-semibold uppercase text-[#64748B]">
            {option.category === 'service'
              ? 'True Monthly'
              : option.category === 'travel'
                ? 'Base Fare'
                : 'Base Price'}
          </div>
          <div className="text-sm font-extrabold text-[#331E6D]">
            {option.category === 'service'
              ? formatMoney(option.effectiveMonthly, option.currency)
              : formatMoney(option.basePrice, option.currency)}
            {option.category === 'service' && option.effectiveMonthly !== null && (
              <span className="text-[10px] font-normal text-[#64748B]">/mo</span>
            )}
          </div>
        </div>
        <div className="border-l border-[#E2E8F0] pl-2.5">
          <div className="text-[9px] font-semibold uppercase text-[#64748B]">
            {option.category === 'service'
              ? '1st-Yr Total'
              : option.category === 'travel'
                ? 'All-In Trip'
                : 'All-In Price'}
          </div>
          <div className="text-sm font-extrabold text-[#1E1B4B]">
            {formatMoney(option.totalCost, option.currency)}
          </div>
        </div>
      </div>

      {/* Key Specs & Policy (Never Hallucinated) */}
      <div className="mt-2 space-y-1 text-[10px]">
        {specEntries.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-2">
            <span className="text-[#64748B] truncate">{k}:</span>
            <span className="font-semibold text-[#1E1B4B] truncate">{v || 'Not stated'}</span>
          </div>
        ))}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[#64748B]">Policy / Terms:</span>
          {option.contractOrPolicy ? (
            <span className="font-semibold text-[#1E1B4B] truncate max-w-[155px]">
              {option.contractOrPolicy}
            </span>
          ) : (
            <span className="font-bold italic text-[#D97706]">Not stated on this page</span>
          )}
        </div>
      </div>

      {/* Interactive Pre-Ticked Add-on Stripper */}
      {option.addonCost > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleAddon(option.id);
          }}
          className={`mt-2 w-full flex items-center justify-between gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold transition-all cursor-pointer ${
            option.addonEnabled
              ? 'border-[#FDE68A] bg-[#FFFBEB] text-[#D97706] hover:bg-[#FEF3C7]'
              : 'border-[#A7F3D0] bg-[#ECFDF5] text-[#059669] hover:bg-[#D1FAE5]'
          }`}
          title="Toggle optional add-on to recalculate true cost live"
        >
          <span className="truncate">
            {option.addonEnabled
              ? `Add-on ON: ${option.addonLabel || 'Optional cover'}`
              : `Stripped add-on (Saved ${formatMoney(option.savingsIfAddonsRemoved, option.currency)})`}
          </span>
          {option.addonEnabled ? (
            <ToggleRight className="h-4 w-4 shrink-0" />
          ) : (
            <ToggleLeft className="h-4 w-4 shrink-0" />
          )}
        </button>
      )}

      {/* Dark-Pattern Warning Pills */}
      {option.darkPatterns.length > 0 && (
        <div className="mt-2 space-y-1">
          {option.darkPatterns.slice(0, 2).map((dp) => (
            <button
              key={dp.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onJumpToAnchor(option, dp.selector, dp.label, 'warning');
              }}
              className={`w-full flex items-center justify-between gap-1.5 rounded-lg border px-2 py-1 text-left text-[10px] font-bold transition-all cursor-pointer ${
                dp.severity === 'crimson'
                  ? 'border-[#FECACA] bg-[#FEF2F2] text-[#DC2626] hover:bg-[#FEE2E2]'
                  : 'border-[#FDE68A] bg-[#FFFBEB] text-[#D97706] hover:bg-[#FEF3C7]'
              }`}
            >
              <span className="flex items-center gap-1 min-w-0">
                {dp.severity === 'crimson' ? (
                  <ShieldAlert className="h-3 w-3 shrink-0" />
                ) : (
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                )}
                <span className="truncate">{dp.label}</span>
              </span>
              <MapPin className="h-3 w-3 shrink-0 opacity-75" />
            </button>
          ))}
        </div>
      )}

      {/* Footer Actions */}
      <div className="mt-2.5 pt-2 border-t border-[#E2E8F0] flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => onInspectOption(option)}
          className="text-[10px] font-bold text-[#331E6D] hover:underline cursor-pointer"
        >
          Inspect Details
        </button>
        <button
          type="button"
          onClick={() =>
            onJumpToAnchor(
              option,
              option.sourceSelector,
              `${option.name}: ${formatMoney(option.totalCost, option.currency)}`,
              isWinner ? 'success' : 'spotlight'
            )
          }
          className="inline-flex items-center gap-1 rounded-lg bg-[#F3F0FF] px-2 py-1 text-[10px] font-bold text-[#331E6D] hover:bg-[#E9E3FF] cursor-pointer"
        >
          Jump to Source <ExternalLink className="h-2.5 w-2.5" />
        </button>
      </div>
    </div>
  );
};

const nodeTypes = {
  goalNode: GoalNode,
  optionNode: OptionNode,
};

interface InnerFlowProps {
  nodes: Node[];
  edges: Edge[];
  compact: boolean;
}

const InnerFlow: React.FC<InnerFlowProps> = ({ nodes, edges, compact }) => {
  const { fitView } = useReactFlow();
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fitView({ padding: 0.12, duration: 200, maxZoom: 1.1 });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [nodes.length, compact, fitView]);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let raf = 0;
    const obs = new ResizeObserver(() => {
      window.cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(() => {
        fitView({ padding: 0.12, duration: 120, maxZoom: 1.1 });
      });
    });
    obs.observe(el);
    return () => {
      window.cancelAnimationFrame(raf);
      obs.disconnect();
    };
  }, [fitView]);

  return (
    <div
      ref={wrapperRef}
      className={`w-full rounded-2xl border border-[#E2E8F0] bg-white overflow-hidden relative ${
        compact ? 'h-[370px]' : 'h-full min-h-[540px]'
      }`}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.12, maxZoom: 1.1 }}
        minZoom={0.3}
        maxZoom={1.6}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#CBD5E1" gap={20} size={1} />
        <Controls showInteractive={false} />
        {!compact && (
          <MiniMap
            nodeColor={(n) => (n.type === 'goalNode' ? '#331E6D' : '#CBD5E1')}
            maskColor="rgba(248, 249, 252, 0.75)"
          />
        )}
      </ReactFlow>
      <div className="pointer-events-none absolute top-2.5 right-2.5 rounded-lg bg-white/95 border border-[#E2E8F0] px-2.5 py-1 text-[10px] font-medium text-[#64748B] shadow-xs">
        Drag nodes • Scroll to zoom • Click warnings to highlight tab
      </div>
    </div>
  );
};

interface WhiteboardCanvasProps {
  session: CompareSessionState;
  compact?: boolean;
  onToggleAddon: (optionId: string) => void;
  onJumpToAnchor: (
    option: WhiteboardOption,
    selector: string,
    message: string,
    variant: 'spotlight' | 'warning' | 'success'
  ) => void;
  onSelectOption?: (option: WhiteboardOption) => void;
}

export const WhiteboardCanvas: React.FC<WhiteboardCanvasProps> = ({
  session,
  compact = true,
  onToggleAddon,
  onJumpToAnchor,
  onSelectOption,
}) => {
  const [inspectedOptionId, setInspectedOptionId] = useState<string | null>(null);

  const inspectedOption = useMemo(
    () => session.options.find((o) => o.id === inspectedOptionId) ?? null,
    [session.options, inspectedOptionId]
  );

  const winnerOption = useMemo(
    () => session.options.find((o) => o.id === session.recommendation.winnerId),
    [session.options, session.recommendation.winnerId]
  );

  const handleInspect = (opt: WhiteboardOption) => {
    setInspectedOptionId(opt.id);
    onSelectOption?.(opt);
  };

  const nodes: Node[] = useMemo(() => {
    const count = session.options.length;
    const spacing = 315;
    const totalWidth = Math.max(0, (count - 1) * spacing);
    const goalX = Math.max(0, totalWidth / 2 - 12);

    const goalNode: Node<GoalNodeData> = {
      id: 'goal',
      type: 'goalNode',
      position: { x: goalX, y: 10 },
      data: {
        goal: session.normalizedGoal || session.prompt,
        category: session.category,
        answers: session.answers,
        winnerName: session.recommendation.winnerName,
        winnerCost: winnerOption
          ? formatMoney(winnerOption.totalCost, winnerOption.currency)
          : 'N/A',
        poweredBy: session.poweredBy,
      },
    };

    const optionNodes: Node<OptionNodeData>[] = session.options.map((opt, idx) => ({
      id: opt.id,
      type: 'optionNode',
      position: { x: idx * spacing, y: 215 },
      data: {
        option: opt,
        isWinner: opt.id === session.recommendation.winnerId,
        onToggleAddon,
        onJumpToAnchor,
        onInspectOption: handleInspect,
      },
    }));

    return [goalNode, ...optionNodes];
  }, [session, winnerOption, onToggleAddon, onJumpToAnchor]);

  const edges: Edge[] = useMemo(
    () =>
      session.options.map((opt) => {
        const isWinner = opt.id === session.recommendation.winnerId;
        const hasTraps = opt.darkPatterns.length > 0;
        return {
          id: `edge-goal-${opt.id}`,
          source: 'goal',
          target: opt.id,
          animated: true,
          style: {
            stroke: isWinner ? '#059669' : hasTraps ? '#D97706' : '#331E6D',
            strokeWidth: isWinner ? 2.5 : 2,
          },
        };
      }),
    [session.options, session.recommendation.winnerId]
  );

  return (
    <div className={compact ? 'space-y-2.5' : 'h-full flex flex-col space-y-2.5'}>
      <ReactFlowProvider>
        <InnerFlow nodes={nodes} edges={edges} compact={compact} />
      </ReactFlowProvider>

      {compact && inspectedOption && (
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-3.5 shadow-sm space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-xs font-extrabold text-[#1E1B4B]">{inspectedOption.name}</div>
              <div className="font-mono text-[10px] text-[#64748B]">{inspectedOption.domain}</div>
            </div>
            <button
              type="button"
              onClick={() => setInspectedOptionId(null)}
              className="rounded-lg p-1 text-[#64748B] hover:bg-[#F8F9FC] cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] p-2 space-y-1">
              <div className="font-bold text-[#059669]">Pros</div>
              {inspectedOption.pros.map((p, i) => (
                <div key={i} className="flex items-start gap-1 text-[#1E1B4B]">
                  <CheckCircle2 className="h-3 w-3 text-[#059669] shrink-0 mt-0.5" />
                  <span>{p}</span>
                </div>
              ))}
            </div>
            <div className="rounded-xl bg-[#FFFBEB] border border-[#FDE68A] p-2 space-y-1">
              <div className="font-bold text-[#D97706]">Watch-outs</div>
              {inspectedOption.cons.map((c, i) => (
                <div key={i} className="flex items-start gap-1 text-[#1E1B4B]">
                  <AlertTriangle className="h-3 w-3 text-[#D97706] shrink-0 mt-0.5" />
                  <span>{c}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
