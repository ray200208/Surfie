import { useEffect, useRef } from 'react';
import { canSubmit } from './plan';
import type { ReviewItem } from './types';
import SourceBadge from './SourceBadge';

export interface ReviewCardProps {
  items: ReviewItem[];
  onEdit: (fieldId: string) => void;
  onBack: () => void;
  onConfirm: () => void;
}

export default function ReviewCard({ items, onEdit, onBack, onConfirm }: ReviewCardProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const submitAllowed = canSubmit(items);
  const missingCount = items.filter((item) => item.missing && !item.sensitive).length;

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <section className="space-y-3.5 rounded-xl border border-[#E2E8F0] bg-white p-4 text-[#1E1B4B] shadow-xs">
      <div
        role="status"
        className={`rounded-xl border px-3 py-2.5 text-xs font-semibold ${
          submitAllowed
            ? 'border-[#A7F3D0] bg-[#ECFDF5] text-[#059669]'
            : 'border-[#FDE68A] bg-[#FFFBEB] text-[#D97706]'
        }`}
      >
        {submitAllowed ? 'All required fields are ready.' : `${missingCount} required fields missing.`}
      </div>

      <h3 ref={headingRef} tabIndex={-1} className="text-sm font-bold text-[#1E1B4B] focus:outline-none">
        Review your fields
      </h3>

      <ul className="space-y-2.5">
        {items.map((item) => (
          <li
            key={item.fieldId}
            className={`rounded-xl border p-3 ${
              item.missing && !item.sensitive
                ? 'border-[#FDE68A] bg-[#FFFBEB] text-[#D97706]'
                : 'border-[#E2E8F0] bg-white text-[#475569]'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className={`text-xs font-bold ${item.missing && !item.sensitive ? 'text-[#D97706]' : 'text-[#1E1B4B]'}`}>
                  {item.label}
                </p>
                <p className="mt-1 break-words text-xs">
                  {item.displayValue || <span className="italic text-[#94A3B8]">Not provided</span>}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                {item.source && <SourceBadge source={item.source} />}
                {item.missing && !item.sensitive && (
                  <span className="rounded-full border border-[#FDE68A] bg-[#FFFBEB] px-2 py-0.5 text-[10px] font-bold text-[#D97706]">
                    Required
                  </span>
                )}
              </div>
            </div>

            {(item.source === 'inferred' || item.source === 'voice') && (
              <p className="mt-2 text-[10px] font-medium text-[#475569]">
                Please double-check this value.
              </p>
            )}

            {!item.sensitive && (
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => onEdit(item.fieldId)}
                  className="rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1 text-[10px] font-bold text-[#331E6D] transition hover:bg-[#F8F9FC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#331E6D]/40"
                >
                  {item.missing ? 'Add' : 'Edit'}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      <p className="text-[11px] leading-relaxed text-[#475569]">
        Nothing is submitted. Focus Mode only fills the fields. You press Submit yourself.
      </p>

      <div className="flex items-center justify-between gap-2 border-t border-[#E2E8F0] pt-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-semibold text-[#475569] transition hover:bg-[#F8F9FC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#331E6D]/40"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={!submitAllowed}
          className="pp-cta-gradient rounded-xl px-3 py-2 text-xs font-bold text-white shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#331E6D]/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Confirm and fill form
        </button>
      </div>
    </section>
  );
}
