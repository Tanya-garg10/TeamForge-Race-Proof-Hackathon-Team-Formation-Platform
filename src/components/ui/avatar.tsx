import * as React from 'react';
import * as AvatarPrimitive from '@radix-ui/react-avatar';
import { cn } from '@/src/lib/utils';

const TINTS = [
  'bg-[#EAE5FF] text-[#4338A8]',
  'bg-[#E8F0FE] text-[#2F5EC4]',
  'bg-[#E6F6F0] text-[#117A58]',
  'bg-[#FDF3E4] text-[#9A6312]',
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function getTint(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return TINTS[Math.abs(hash) % TINTS.length];
}

export interface UserAvatarProps {
  name: string;
  avatarUrl?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<UserAvatarProps['size']>, string> = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-lg',
};

export function UserAvatar({ name, avatarUrl, size = 'md', className }: UserAvatarProps) {
  return (
    <AvatarPrimitive.Root
      className={cn(
        'relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full border border-[#ECE8F4] font-semibold',
        SIZE_CLASSES[size],
        className,
      )}
    >
      {avatarUrl ? (
        <AvatarPrimitive.Image
          src={avatarUrl}
          alt={name}
          className="h-full w-full object-cover"
        />
      ) : null}
      <AvatarPrimitive.Fallback
        delayMs={avatarUrl ? 300 : 0}
        className={cn('flex h-full w-full items-center justify-center font-semibold', getTint(name))}
      >
        {getInitials(name)}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}

export interface AvatarStackProps {
  members: Array<{ name: string; avatarUrl?: string | null }>;
  maxVisible?: number;
  size?: 'xs' | 'sm' | 'md';
}

export function AvatarStack({ members, maxVisible = 4, size = 'sm' }: AvatarStackProps) {
  const visible = members.slice(0, maxVisible);
  const overflow = Math.max(0, members.length - visible.length);

  return (
    <div className="flex items-center -space-x-2">
      {visible.map((m, idx) => (
        <UserAvatar
          key={`${m.name}-${idx}`}
          name={m.name}
          avatarUrl={m.avatarUrl}
          size={size}
          className="ring-2 ring-white"
        />
      ))}
      {overflow > 0 && (
        <span
          className={cn(
            'inline-flex items-center justify-center rounded-full border border-[#ECE8F4] bg-[#F3F0FF] font-mono font-semibold text-[#4338A8] ring-2 ring-white',
            SIZE_CLASSES[size],
          )}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}
