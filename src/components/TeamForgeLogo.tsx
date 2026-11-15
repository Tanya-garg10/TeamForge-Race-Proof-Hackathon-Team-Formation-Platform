import { cn } from '@/src/lib/utils';

export function TeamForgeLogo({
  showWordmark = true,
  size = 'md',
  className,
}: {
  showWordmark?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const boxSize = size === 'sm' ? 'h-7 w-7' : size === 'lg' ? 'h-10 w-10' : 'h-8 w-8';
  const textSize = size === 'sm' ? 'text-base' : size === 'lg' ? 'text-xl' : 'text-lg';

  return (
    <span className={cn('inline-flex items-center gap-2.5 select-none', className)}>
      <span
        className={cn(
          'relative inline-flex items-center justify-center rounded-xl bg-[#7257E8] text-white shadow-xs shrink-0',
          boxSize,
        )}
      >
        {/* Custom geometric connected-team symbol: 3 nodes linked in precision triangle around forged core */}
        <svg viewBox="0 0 32 32" fill="none" className="h-5 w-5" aria-hidden="true">
          <path
            d="M16 7.5L8.5 21.5H23.5L16 7.5Z"
            stroke="rgba(255,255,255,0.55)"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d="M16 14.5V7.5M16 14.5L8.5 21.5M16 14.5L23.5 21.5" stroke="#EAE5FF" strokeWidth="1.75" />
          <circle cx="16" cy="7.5" r="2.7" fill="#FFFFFF" />
          <circle cx="8.5" cy="21.5" r="2.7" fill="#FFFFFF" />
          <circle cx="23.5" cy="21.5" r="2.7" fill="#FFFFFF" />
          <circle cx="16" cy="15.2" r="2.2" fill="#5B8DEF" stroke="#FFFFFF" strokeWidth="1.2" />
        </svg>
      </span>
      {showWordmark && (
        <span
          className={cn(
            'font-extrabold tracking-tight text-[#201B35] whitespace-nowrap',
            textSize,
          )}
          style={{ fontFamily: 'var(--font-display)' }}
        >
          TeamForge
        </span>
      )}
    </span>
  );
}
