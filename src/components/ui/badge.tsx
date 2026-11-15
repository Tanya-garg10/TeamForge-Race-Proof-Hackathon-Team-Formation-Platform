import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/src/lib/utils';

type BadgeTone = 'violet' | 'indigo' | 'blue' | 'success' | 'warning' | 'danger' | 'neutral';

const TONE_MAP: Record<BadgeTone, string> = {
  violet: 'bg-[#EAE5FF] text-[#4338A8] border-[#DCD4FA]',
  indigo: 'bg-[#4338A8] text-white border-[#4338A8]',
  blue: 'bg-[#EEF4FF] text-[#2F5EC4] border-[#D7E4FE]',
  success: 'bg-[#E8F8F2] text-[#117A58] border-[#C7EEDF]',
  warning: 'bg-[#FDF4E5] text-[#A86D14] border-[#F7E0B5]',
  danger: 'bg-[#FDECEF] text-[#B83249] border-[#F8CBD3]',
  neutral: 'bg-[#F3F0FF] text-[#77718C] border-[#ECE8F4]',
};

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function StatusBadge({ tone = 'neutral', className, children, ...props }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-0.5 text-xs font-semibold leading-5 whitespace-nowrap',
        TONE_MAP[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export interface SkillTagProps extends React.HTMLAttributes<HTMLSpanElement> {
  matched?: boolean;
  onRemove?: () => void;
}

export function SkillTag({ matched, onRemove, className, children, ...props }: SkillTagProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium leading-4 transition-colors',
        matched
          ? 'bg-[#EAE5FF] border-[#C9BDFB] text-[#4338A8]'
          : 'bg-[#FAF9FF] border-[#ECE8F4] text-[#201B35]',
        className,
      )}
      {...props}
    >
      <span>{children}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove skill"
          className="ml-0.5 rounded p-0.5 text-[#77718C] hover:bg-[#EAE5FF] hover:text-[#4338A8] cursor-pointer"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}

export interface FilterChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

export function FilterChip({ active = false, className, children, ...props }: FilterChipProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7257E8]',
        active
          ? 'bg-[#7257E8] border-[#7257E8] text-white shadow-xs'
          : 'bg-white border-[#ECE8F4] text-[#77718C] hover:border-[#D4CAEE] hover:bg-[#F3F0FF]/60 hover:text-[#201B35]',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
