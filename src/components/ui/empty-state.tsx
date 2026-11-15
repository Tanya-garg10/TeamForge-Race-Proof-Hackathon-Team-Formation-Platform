import * as React from 'react';
import { cn } from '@/src/lib/utils';

export interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-dashed border-[#DCD4EE] bg-white/80 px-6 py-12 text-center flex flex-col items-center justify-center',
        className,
      )}
    >
      <div className="h-12 w-12 rounded-2xl bg-[#F3F0FF] text-[#7257E8] flex items-center justify-center mb-4 border border-[#EAE5FF]">
        {icon}
      </div>
      <h3 className="text-base font-bold text-[#201B35]">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm text-[#77718C] leading-relaxed">{description}</p>
      {action && <div className="mt-5 flex flex-wrap items-center justify-center gap-3">{action}</div>}
    </div>
  );
}
