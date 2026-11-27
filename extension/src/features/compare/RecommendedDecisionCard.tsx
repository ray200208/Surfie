import React from 'react';
import { Award, ArrowUpRight, CheckCircle2, Sparkles } from 'lucide-react';
import type { RecommendedDecision, WhiteboardOption } from './compareTypes';
import { formatMoney } from './trueCostEngine';

interface RecommendedDecisionCardProps {
  recommendation: RecommendedDecision;
  winnerOption?: WhiteboardOption;
  onOpenWinner: (option: WhiteboardOption) => void;
}

export const RecommendedDecisionCard: React.FC<RecommendedDecisionCardProps> = ({
  recommendation,
  winnerOption,
  onOpenWinner,
}) => {
  return (
    <div className="rounded-2xl border border-[#A7F3D0] bg-gradient-to-br from-[#ECFDF5] via-white to-[#F8F9FC] p-3.5 shadow-sm space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-1 rounded-full bg-[#059669] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
            <Award className="h-3 w-3" /> Recommended Decision
          </div>
          <h3 className="mt-1.5 text-sm font-extrabold text-[#1E1B4B] leading-snug">
            {recommendation.headline}
          </h3>
        </div>

        {winnerOption && (
          <div className="text-right shrink-0">
            <div className="text-[10px] font-semibold uppercase text-[#64748B]">
              {winnerOption.category === 'service' ? '1st-Year Total' : 'True Cost'}
            </div>
            <div className="text-base font-extrabold text-[#059669]">
              {formatMoney(winnerOption.totalCost, winnerOption.currency)}
            </div>
            {winnerOption.effectiveMonthly !== null && (
              <div className="text-[10px] font-semibold text-[#475569]">
                ({formatMoney(winnerOption.effectiveMonthly, winnerOption.currency)}/mo)
              </div>
            )}
          </div>
        )}
      </div>

      <ul className="space-y-1">
        {recommendation.rationale.map((line, idx) => (
          <li key={idx} className="flex items-start gap-1.5 text-[11px] text-[#475569]">
            <CheckCircle2 className="h-3.5 w-3.5 text-[#059669] shrink-0 mt-0.5" />
            <span>{line}</span>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between gap-2 pt-1">
        <span className="inline-flex items-center gap-1 rounded-lg bg-[#ECFDF5] border border-[#A7F3D0] px-2 py-1 text-[10px] font-bold text-[#059669]">
          <Sparkles className="h-3 w-3 shrink-0" />
          <span className="truncate max-w-[190px]">{recommendation.savingsSummary}</span>
        </span>

        {winnerOption && (
          <button
            type="button"
            onClick={() => onOpenWinner(winnerOption)}
            className="pp-cta-gradient inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-[11px] font-bold text-white shadow-xs transition-all cursor-pointer shrink-0"
          >
            Open Winner Tab <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
