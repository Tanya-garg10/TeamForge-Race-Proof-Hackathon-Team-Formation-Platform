import * as React from 'react';
import { cn } from '@/src/lib/utils';

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-xl bg-[#EAE5FF]/60', className)}
      {...props}
    />
  );
}

export function TeamCardSkeleton() {
  return (
    <div className="rounded-2xl border border-[#ECE8F4] bg-white p-6 space-y-4 tf-card-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <Skeleton className="h-6 w-20 rounded-lg" />
      </div>
      <Skeleton className="h-10 w-full" />
      <div className="flex gap-2">
        <Skeleton className="h-6 w-16 rounded-lg" />
        <Skeleton className="h-6 w-20 rounded-lg" />
        <Skeleton className="h-6 w-14 rounded-lg" />
      </div>
      <Skeleton className="h-2 w-full rounded-full" />
      <div className="flex items-center justify-between pt-2">
        <Skeleton className="h-7 w-24 rounded-full" />
        <Skeleton className="h-9 w-24 rounded-xl" />
      </div>
    </div>
  );
}
