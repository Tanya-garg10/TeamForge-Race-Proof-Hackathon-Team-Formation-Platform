import * as React from 'react';
import * as ProgressPrimitive from '@radix-ui/react-progress';
import { cn } from '@/src/lib/utils';

export const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & {
    tone?: 'violet' | 'success' | 'warning' | 'danger' | 'blue';
  }
>(({ className, value, tone = 'violet', ...props }, ref) => {
  const indicatorClass =
    tone === 'success'
      ? 'bg-[#16A477]'
      : tone === 'warning'
        ? 'bg-[#E9A23B]'
        : tone === 'danger'
          ? 'bg-[#E15B70]'
          : tone === 'blue'
            ? 'bg-[#5B8DEF]'
            : 'bg-[#7257E8]';

  return (
    <ProgressPrimitive.Root
      ref={ref}
      className={cn('relative h-2 w-full overflow-hidden rounded-full bg-[#F3F0FF]', className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn('h-full w-full flex-1 rounded-full transition-transform duration-300', indicatorClass)}
        style={{ transform: `translateX(-${100 - Math.min(100, Math.max(0, value || 0))}%)` }}
      />
    </ProgressPrimitive.Root>
  );
});
Progress.displayName = ProgressPrimitive.Root.displayName;
