import { cn } from '@/lib/utils';

export const Card = ({ className, ...props }) => (
  <div className={cn('min-w-0 rounded-lg border border-border bg-card text-foreground', className)} {...props} />
);
export const CardHeader = ({ className, ...props }) => (
  <div className={cn('flex flex-col gap-1 p-5 pb-3', className)} {...props} />
);
export const CardTitle = ({ className, ...props }) => (
  <h3 className={cn('text-lg font-bold leading-tight', className)} {...props} />
);
export const CardDescription = ({ className, ...props }) => (
  <p className={cn('text-sm text-muted-foreground', className)} {...props} />
);
export const CardContent = ({ className, ...props }) => <div className={cn('p-5 pt-0', className)} {...props} />;
