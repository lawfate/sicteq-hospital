import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// shadcn/ui Button. Tamaños generosos: se usa en pantallas táctiles y por
// personal con poca práctica digital.
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-bold transition-colors active:translate-y-px disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary: 'bg-muted text-foreground hover:bg-muted/70 border border-border',
        outline: 'border border-border bg-transparent hover:bg-muted',
        ghost: 'hover:bg-muted',
        destructive: 'bg-danger text-primary-foreground hover:bg-danger/90',
        ok: 'bg-ok text-primary-foreground hover:bg-ok/90',
      },
      size: {
        default: 'h-11 px-5 text-[15px]',
        sm: 'min-h-11 px-3 py-2 text-sm',
        lg: 'h-14 px-6 text-lg',
        icon: 'h-11 w-11 shrink-0',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
);

export function Button({ className, variant, size, type = 'button', ...props }) {
  return <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
