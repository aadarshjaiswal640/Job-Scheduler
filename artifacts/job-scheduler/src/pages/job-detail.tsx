import React from 'react';
import { useRoute } from 'wouter';
import { 
  useGetJob, 
  useGetJobLogs, 
  useGetJobExecutions,
  useRetryJob,
  useCancelJob,
  getGetJobQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDateTime, formatDuration } from '@/lib/utils';
import { JobStatusBadge } from '@/components/job-status-badge';
import { RotateCw, XCircle, Terminal, History, Code2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function JobDetail() {
  const [, params] = useRoute("/jobs/:id");
  const jobId = params?.id || '';
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: job, isLoading: jobLoading } = useGetJob(jobId);
  const { data: logs, isLoading: logsLoading } = useGetJobLogs(jobId);
  const { data: executions, isLoading: execLoading } = useGetJobExecutions(jobId);

  const retryJob = useRetryJob();
  const cancelJob = useCancelJob();

  const handleRetry = () => {
    retryJob.mutate({ jobId }, {
      onSuccess: () => {
        toast({ title: "Job retry initiated" });
        queryClient.invalidateQueries({ queryKey: getGetJobQueryKey(jobId) });
      },
      onError: (err) => {
        toast({ title: "Retry failed", description: err.message, variant: "destructive" });
      }
    });
  };

  const handleCancel = () => {
    cancelJob.mutate({ jobId }, {
      onSuccess: () => {
        toast({ title: "Job cancelled" });
        queryClient.invalidateQueries({ queryKey: getGetJobQueryKey(jobId) });
      },
      onError: (err) => {
        toast({ title: "Cancel failed", description: err.message, variant: "destructive" });
      }
    });
  };

  if (jobLoading) return <div className="p-6"><Skeleton className="h-10 w-64 mb-6" /><Skeleton className="h-64 w-full" /></div>;
  if (!job) return <div className="p-6 text-destructive">Job not found</div>;

  const canRetry = job.status === 'failed' || job.status === 'dead';
  const canCancel = job.status === 'queued' || job.status === 'scheduled' || job.status === 'retry';

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2 font-mono flex items-center gap-3">
            {job.name}
            <JobStatusBadge status={job.status} />
          </h1>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>ID: <span className="font-mono">{job.id}</span></span>
            <span>Queue: <span className="font-mono">{job.queue_name || job.queue_id}</span></span>
            <span>Type: <span className="capitalize">{job.job_type}</span></span>
            <span>Created: {formatDateTime(job.created_at)}</span>
          </div>
        </div>
        <div className="flex gap-2">
          {canCancel && (
            <Button variant="outline" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={handleCancel} disabled={cancelJob.isPending}>
              <XCircle className="w-4 h-4 mr-2" /> Cancel
            </Button>
          )}
          {canRetry && (
            <Button onClick={handleRetry} disabled={retryJob.isPending}>
              <RotateCw className="w-4 h-4 mr-2" /> Retry Job
            </Button>
          )}
        </div>
      </div>

      {job.error_message && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-destructive flex items-center gap-2 text-lg">
              <AlertCircle className="w-5 h-5" />
              Job Failed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-mono whitespace-pre-wrap break-all text-destructive/90">{job.error_message}</p>
            {job.ai_failure_summary && (
              <div className="mt-4 p-3 bg-background/50 rounded border text-sm">
                <span className="font-semibold text-muted-foreground block mb-1">AI Root Cause Analysis:</span>
                {job.ai_failure_summary}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Execution Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-6 text-sm">
              <div>
                <dt className="text-muted-foreground mb-1">Started At</dt>
                <dd className="font-medium">{formatDateTime(job.started_at)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground mb-1">Completed At</dt>
                <dd className="font-medium">{formatDateTime(job.completed_at)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground mb-1">Worker Node</dt>
                <dd className="font-mono bg-muted px-1 py-0.5 rounded inline-block">{job.worker_id || '-'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground mb-1">Retries</dt>
                <dd className="font-medium">{job.retry_count} / {job.max_retries || '∞'}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Code2 className="w-4 h-4" /> Payload</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-muted p-4 rounded-md overflow-auto max-h-[300px]">
              <pre className="text-xs font-mono text-foreground">
                {JSON.stringify(job.payload, null, 2)}
              </pre>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="logs" className="w-full">
        <TabsList>
          <TabsTrigger value="logs"><Terminal className="w-4 h-4 mr-2" /> Application Logs</TabsTrigger>
          <TabsTrigger value="history"><History className="w-4 h-4 mr-2" /> Execution History</TabsTrigger>
        </TabsList>
        
        <TabsContent value="logs" className="mt-4">
          <Card>
            <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-xs overflow-auto h-[500px]">
              {logsLoading ? (
                <div className="animate-pulse space-y-2">
                  <div className="h-4 bg-white/10 rounded w-1/4"></div>
                  <div className="h-4 bg-white/10 rounded w-1/2"></div>
                  <div className="h-4 bg-white/10 rounded w-1/3"></div>
                </div>
              ) : logs && logs.length > 0 ? (
                <div className="space-y-1">
                  {logs.map(log => (
                    <div key={log.id} className="flex gap-4 hover:bg-white/5 px-2 py-0.5 rounded">
                      <span className="text-gray-500 shrink-0">{new Date(log.timestamp).toISOString()}</span>
                      <span className={
                        log.level === 'error' ? 'text-red-400 w-16 shrink-0' :
                        log.level === 'warning' ? 'text-yellow-400 w-16 shrink-0' :
                        log.level === 'debug' ? 'text-gray-400 w-16 shrink-0' :
                        'text-blue-400 w-16 shrink-0'
                      }>[{log.level.toUpperCase()}]</span>
                      <span className="break-all">{log.message}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-gray-500">No logs emitted by this job.</div>
              )}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Attempt</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Worker</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {execLoading ? (
                  <TableRow><TableCell colSpan={6}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                ) : executions && executions.length > 0 ? (
                  executions.map(exec => (
                    <TableRow key={exec.id}>
                      <TableCell className="font-mono">#{exec.attempt_number}</TableCell>
                      <TableCell>
                        <Badge variant={exec.status === 'completed' ? 'success' : exec.status === 'failed' ? 'destructive' : 'default'}>
                          {exec.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{exec.worker_id || '-'}</TableCell>
                      <TableCell className="text-sm">{formatDateTime(exec.started_at)}</TableCell>
                      <TableCell className="text-sm font-mono">{formatDuration(exec.duration_ms)}</TableCell>
                      <TableCell className="text-sm text-destructive max-w-xs truncate" title={exec.error_message || ''}>
                        {exec.error_message || '-'}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No execution history.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}