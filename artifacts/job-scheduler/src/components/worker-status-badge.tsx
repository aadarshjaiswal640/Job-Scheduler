import React from 'react';
import { Badge } from '@/components/ui/badge';

export function WorkerStatusBadge({ status }: { status: string }) {
  let variant: "success" | "warning" | "destructive" | "secondary" = "secondary";
  
  switch (status) {
    case 'active':
      variant = 'success';
      break;
    case 'idle':
      variant = 'warning';
      break;
    case 'offline':
      variant = 'destructive';
      break;
  }

  return (
    <Badge variant={variant} className="capitalize font-mono">
      {status}
    </Badge>
  );
}