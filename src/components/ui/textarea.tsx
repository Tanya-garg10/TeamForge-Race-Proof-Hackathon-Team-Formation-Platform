import * as React from 'react';
import { cn } from '@/src/lib/utils';

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'flex min-h-[100px] w-full rounded-xl border border-[#ECE8F4] bg-white px-3.5 py-2.5 text-sm text-[#201B35] placeholder:text-[#77718C]/75 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7257E8]/30 focus-visible:border-[#7257E8] disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = 'Textarea';
