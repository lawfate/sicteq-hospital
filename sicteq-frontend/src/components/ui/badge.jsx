import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// Estado de una caja o carga: el color solo se usa para esto.
const badgeVariants = cva('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold whitespace-nowrap', {
  variants: {
    variant: {
      default: 'border-border bg-muted text-foreground',
      ok: 'border-ok/40 bg-ok/15 text-ok',
      warn: 'border-warn/40 bg-warn/15 text-warn',
      danger: 'border-danger/40 bg-danger/15 text-danger',
      info: 'border-primary/40 bg-primary/15 text-primary',
    },
  },
  defaultVariants: { variant: 'default' },
});

export function Badge({ className, variant, ...props }) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
