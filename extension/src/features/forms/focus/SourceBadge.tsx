import type { FocusFieldSource } from './types';

interface SourceBadgeProps {
  source: FocusFieldSource;
}

const SOURCE_LABELS: Record<FocusFieldSource, string> = {
  vault: 'Vault',
  voice: 'Voice',
  inferred: 'Inferred',
  user: 'You',
};

const SOURCE_STYLES: Record<FocusFieldSource, string> = {
  vault: 'border-[#A7F3D0] bg-[#ECFDF5] text-[#059669]',
  voice: 'border-[#DDD6FE] bg-[#F3F0FF] text-[#331E6D]',
  inferred: 'border-[#FDE68A] bg-[#FFFBEB] text-[#D97706]',
  user: 'border-[#DDD6FE] bg-[#F3F0FF] text-[#331E6D]',
};

export default function SourceBadge({ source }: SourceBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${SOURCE_STYLES[source]}`}
    >
      {SOURCE_LABELS[source]}
    </span>
  );
}
