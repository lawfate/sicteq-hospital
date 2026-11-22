import { cn } from '@/lib/utils';

export function Input({ className, ...props }) {
  return (
    <input
      className={cn('h-11 w-full rounded-md border border-border bg-background px-3 text-[15px] placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50', className)}
      {...props}
    />
  );
}

export function Select({ className, ...props }) {
  return (
    <select
      className={cn('h-11 w-full rounded-md border border-border bg-background px-3 text-[15px] focus-visible:ring-2 focus-visible:ring-primary', className)}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }) {
  return (
    <textarea
      className={cn('min-h-[88px] w-full rounded-md border border-border bg-background p-3 text-[15px] placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-primary', className)}
      {...props}
    />
  );
}

export function Label({ className, ...props }) {
  return <label className={cn('block text-sm font-bold text-foreground', className)} {...props} />;
}
