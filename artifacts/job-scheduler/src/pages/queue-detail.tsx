import React from 'react';
import { useRoute } from 'wouter';
import { 
  useGetQueue, 
  useGetQueueMetrics, 
  useListJobs,
  usePauseQueue,
  useResumeQueue,
  getGetQueueQueryKey,
  getGetQueueMetricsQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Pause, Play, Settings2, Activity, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDateTime } from '@/lib/utils';
import { JobStatusBadge } from '@/components/job-status-badge';
import { Link } from 'wouter';

export default function QueueDetail() {
  const [, params] = useRoute("/queues/:id");
  const queueId = params?.id || '';
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: queue, isLoading: queueLoading } = useGetQueue(queueId);
  const { data: metrics, isLoading: metricsLoading } = useGetQueueMetrics(queueId);
  const { data: jobsPage, isLoading: jobsLoading } = useListJobs(queueId);

  const pauseQueue = usePauseQueue();
  const resumeQueue = useResumeQueue();

  const handleTogglePause = () => {
    if (!queue) return;
    const action = queue.paused ? resumeQueue : pauseQueue;
    action.mutate({ queueId }, {
      onSuccess: () => {
        toast({ title: queue.paused ? "Queue resumed" : "Queue paused" });
        queryClient.invalidateQueries({ queryKey: getGetQueueQueryKey(queueId) });
      },
      onError: (err) => {
        toast({ title: "Action failed", description: err.message, variant: "destructive" });
      }
    });
  };

  if (queueLoading) return <div className="p-6"><Skeleton className="h-10 w-64 mb-6" /><Skeleton className="h-64 w-full" /></div>;
  if (!queue) return <div className="p-6 text-destructive">Queue not found</div>;

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href={`/projects/${queue.project_id}`} className="text-muted-foreground hover:text-foreground text-sm">
              &larr; Back to Project
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{queue.name}</h1>
            {queue.paused ? (
              <Badge variant="warning">Paused</Badge>
            ) : (
              <Badge variant="success" className="bg-green-500 hover:bg-green-600">Active</Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1">{queue.description || "No description provided."}</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant={queue.paused ? "default" : "secondary"} 
            onClick={handleTogglePause}
            disabled={pauseQueue.isPending || resumeQueue.isPending}
          >
            {queue.paused ? <><Play className="w-4 h-4 mr-2" /> Resume Queue</> : <><Pause className="w-4 h-4 mr-2" /> Pause Queue</>}
          </Button>
          <Button variant="outline"><Settings2 className="w-4 h-4 mr-2" /> Settings</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Queued" value={metrics?.job_counts?.queued} isLoading={metricsLoading} icon={Activity} />
        <MetricCard title="Running" value={metrics?.job_counts?.running} isLoading={metricsLoading} icon={Play} className="text-primary" />
        <MetricCard title="Completed" value={metrics?.job_counts?.completed} isLoading={metricsLoading} icon={CheckCircle2} className="text-green-500" />
        <MetricCard title="Failed" value={metrics?.job_counts?.failed} isLoading={metricsLoading} icon={AlertTriangle} className="text-destructive" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Recent Jobs</CardTitle>
                <CardDescription>Latest executions in this queue</CardDescription>
              </div>
              <Link href={`/jobs?queueId=${queueId}`}>
                <Button variant="outline" size="sm">View All</Button>
              </Link>
            </div>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobsLoading ? (
                Array(5).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    {Array(4).fill(0).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>)}
                  </TableRow>
                ))
              ) : jobsPage?.jobs && jobsPage.jobs.length > 0 ? (
                jobsPage.jobs.map(job => (
                  <TableRow key={job.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">{job.id.substring(0,8)}</TableCell>
                    <TableCell>
                      <Link href={`/jobs/${job.id}`} className="font-medium hover:underline text-primary">
                        {job.name}
                      </Link>
                    </TableCell>
                    <TableCell><JobStatusBadge status={job.status} /></TableCell>
                    <TableCell className="text-muted-foreground text-sm">{formatDateTime(job.created_at)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No jobs found in this queue.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Queue Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <span className="text-sm text-muted-foreground">Concurrency</span>
              <p className="font-medium">{queue.concurrency} concurrent jobs</p>
            </div>
            <div className="space-y-1">
              <span className="text-sm text-muted-foreground">Priority</span>
              <p className="font-medium">Level {queue.priority}</p>
            </div>
            <div className="pt-4 border-t space-y-3">
              <h4 className="font-semibold text-sm">Retry Policy</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-muted-foreground">Strategy:</span>
                <span className="font-medium capitalize">{queue.retry_policy.strategy}</span>
                
                <span className="text-muted-foreground">Max Retries:</span>
                <span className="font-medium">{queue.retry_policy.max_retries}</span>
                
                <span className="text-muted-foreground">Interval:</span>
                <span className="font-medium">{queue.retry_policy.retry_interval_seconds}s</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({ title, value, isLoading, icon: Icon, className }: any) {
  return (
    <Card>
      <CardContent className="p-6 flex items-center gap-4">
        <div className="bg-muted p-3 rounded-md">
          <Icon className="w-5 h-5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          {isLoading ? (
            <Skeleton className="h-6 w-16 mt-1" />
          ) : (
            <p className={`text-2xl font-bold font-mono tracking-tight ${className || ''}`}>
              {value || 0}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}