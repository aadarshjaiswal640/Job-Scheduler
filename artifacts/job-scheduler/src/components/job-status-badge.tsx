import React from 'react';
import { Badge } from '@/components/ui/badge';
import { JobStatus } from '@workspace/api-client-react';

export function JobStatusBadge({ status }: { status: JobStatus }) {
  let variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info" = "default";
  
  switch (status) {
    case 'completed':
      variant = 'success';
      break;
    case 'failed':
    case 'dead':
      variant = 'destructive';
      break;
    case 'running':
    case 'claimed':
      variant = 'info';
      break;
    case 'retry':
      variant = 'warning';
      break;
    case 'queued':
    case 'scheduled':
      variant = 'secondary';
      break;
  }

  return (
    <Badge variant={variant} className="capitalize font-mono">
      {status}
    </Badge>
  );
}
