import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/src/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 rounded-xl text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7257E8] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FAF9FF] disabled:pointer-events-none disabled:opacity-50 cursor-pointer active:scale-[0.99]',
  {
    variants: {
      variant: {
        default:
          'bg-[#7257E8] text-white shadow-xs hover:bg-[#5E43D6] active:bg-[#4338A8]',
        secondary:
          'bg-[#EAE5FF] text-[#4338A8] hover:bg-[#DFD7FF] border border-[#DDD5FF]',
        outline:
          'border border-[#ECE8F4] bg-white text-[#201B35] hover:bg-[#F3F0FF]/60 hover:border-[#DCD4EE]',
        ghost:
          'text-[#77718C] hover:bg-[#F3F0FF] hover:text-[#201B35]',
        destructive:
          'bg-[#E15B70] text-white hover:bg-[#CC475C]',
        success:
          'bg-[#16A477] text-white hover:bg-[#128B65]',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 px-3.5 text-xs',
        lg: 'h-11 px-6 text-sm font-semibold',
        icon: 'h-10 w-10',
        'icon-sm': 'h-8 w-8 rounded-lg',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, isLoading = false, children, disabled, ...props }, ref) => {
    if (asChild) {
      return (
        <Slot
          className={cn(buttonVariants({ variant, size, className }))}
          ref={ref}
          {...props}
        >
          {children}
        </Slot>
      );
    }

    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : null}
        {children}
      </button>
    );
  },
);
Button.displayName = 'Button';
