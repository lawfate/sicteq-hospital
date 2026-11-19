import { cn } from '@/lib/utils';

export const Table = ({ className, ...props }) => (
  <div className="w-full overflow-x-auto">
    <table className={cn('w-full text-sm tabular-nums', className)} {...props} />
  </div>
);
export const TableHeader = (props) => <thead {...props} />;
export const TableBody = (props) => <tbody {...props} />;
export const TableRow = ({ className, ...props }) => (
  <tr className={cn('border-b border-border last:border-0 hover:bg-muted/40', className)} {...props} />
);
export const TableHead = ({ className, ...props }) => (
  <th className={cn('h-10 px-3 text-left align-middle text-xs font-bold uppercase tracking-wider text-muted-foreground', className)} {...props} />
);
export const TableCell = ({ className, ...props }) => <td className={cn('px-3 py-3 align-middle', className)} {...props} />;
