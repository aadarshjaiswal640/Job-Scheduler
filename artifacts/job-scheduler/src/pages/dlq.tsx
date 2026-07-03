import React, { useState } from 'react';
import { 
  useListDlqEntries, 
  useRetryDlqEntry, 
  useDeleteDlqEntry,
  getListDlqEntriesQueryKey
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime } from '@/lib/utils';
import { AlertTriangle, RotateCw, Trash2, Code2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'wouter';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export default function Dlq() {
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: dlqPage, isLoading } = useListDlqEntries({ page, limit: 50 });
  const retryEntry = useRetryDlqEntry();
  const deleteEntry = useDeleteDlqEntry();

  const handleRetry = (dlqId: string) => {
    retryEntry.mutate({ dlqId }, {
      onSuccess: () => {
        toast({ title: "Job re-queued successfully" });
        queryClient.invalidateQueries({ queryKey: getListDlqEntriesQueryKey({ page, limit: 50 }) });
      },
      onError: (err) => {
        toast({ title: "Failed to retry", description: err.message, variant: "destructive" });
      }
    });
  };

  const handleDelete = (dlqId: string) => {
    if(!confirm("Are you sure you want to permanently delete this job?")) return;
    deleteEntry.mutate({ dlqId }, {
      onSuccess: () => {
        toast({ title: "DLQ entry deleted" });
        queryClient.invalidateQueries({ queryKey: getListDlqEntriesQueryKey({ page, limit: 50 }) });
      },
      onError: (err) => {
        toast({ title: "Failed to delete", description: err.message, variant: "destructive" });
      }
    });
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto h-full flex flex-col">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <AlertTriangle className="w-8 h-8 text-destructive" />
          <h1 className="text-3xl font-bold tracking-tight text-destructive">Dead Letter Queue</h1>
        </div>
        <p className="text-muted-foreground">Jobs that exceeded max retries and require manual intervention.</p>
      </div>

      <Card className="flex-1 flex flex-col min-h-0 border-destructive/20 bg-destructive/5">
        <div className="overflow-auto flex-1">
          <Table>
            <TableHeader className="sticky top-0 bg-background/95 backdrop-blur z-10 shadow-sm">
              <TableRow>
                <TableHead>Job ID</TableHead>
                <TableHead>Name / Queue</TableHead>
                <TableHead>Failure Reason</TableHead>
                <TableHead>Moved At</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(10).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    {Array(5).fill(0).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                  </TableRow>
                ))
              ) : dlqPage?.entries && dlqPage.entries.length > 0 ? (
                dlqPage.entries.map(entry => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-mono text-xs">
                      <Link href={`/jobs/${entry.job_id}`} className="hover:underline text-destructive font-medium">
                        {entry.job_id.substring(0,8)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{entry.job_name}</div>
                      <div className="text-xs text-muted-foreground">{entry.queue_name}</div>
                    </TableCell>
                    <TableCell className="max-w-md">
                      <div className="truncate text-sm font-mono text-destructive/80" title={entry.failure_reason}>
                        {entry.failure_reason}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDateTime(entry.moved_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" title="View Payload"><Code2 className="w-4 h-4 text-muted-foreground" /></Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>Job Payload</DialogTitle>
                            </DialogHeader>
                            <div className="bg-muted p-4 rounded-md overflow-auto max-h-[500px]">
                              <pre className="text-xs font-mono">{JSON.stringify(entry.payload, null, 2)}</pre>
                            </div>
                          </DialogContent>
                        </Dialog>
                        <Button variant="ghost" size="icon" onClick={() => handleRetry(entry.id)} title="Retry Job">
                          <RotateCw className="w-4 h-4 text-primary" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(entry.id)} title="Delete">
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-16 text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center text-green-500 mb-2">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                      </div>
                      <p>The Dead Letter Queue is empty.</p>
                      <p className="text-xs">All jobs are processing successfully.</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        
        {dlqPage && dlqPage.pages && dlqPage.pages > 1 && (
          <div className="p-4 border-t border-destructive/20 flex justify-between items-center bg-background shrink-0">
            <span className="text-sm text-muted-foreground">
              Showing page {page} of {dlqPage.pages} ({dlqPage.total} total)
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= (dlqPage.pages || 1)} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}