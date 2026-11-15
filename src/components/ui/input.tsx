import * as React from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/src/lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded-xl border border-[#ECE8F4] bg-white px-3.5 py-2 text-sm text-[#201B35] placeholder:text-[#77718C]/75 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7257E8]/30 focus-visible:border-[#7257E8] disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

export interface SearchFieldProps extends Omit<InputProps, 'type'> {
  onClear?: () => void;
}

export const SearchField = React.forwardRef<HTMLInputElement, SearchFieldProps>(
  ({ className, value, onClear, ...props }, ref) => {
    const hasValue = typeof value === 'string' && value.length > 0;
    return (
      <div className="relative flex items-center w-full">
        <Search className="h-4 w-4 text-[#77718C] absolute left-3.5 pointer-events-none" />
        <Input
          ref={ref}
          type="search"
          value={value}
          className={cn('pl-10 pr-9', className)}
          {...props}
        />
        {hasValue && onClear && (
          <button
            type="button"
            onClick={onClear}
            aria-label="Clear search"
            className="absolute right-2.5 rounded-lg p-1 text-[#77718C] hover:bg-[#F3F0FF] hover:text-[#201B35] cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  },
);
SearchField.displayName = 'SearchField';
