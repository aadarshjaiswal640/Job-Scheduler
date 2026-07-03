import React from 'react';
import { useListWorkers } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime } from '@/lib/utils';
import { WorkerStatusBadge } from '@/components/worker-status-badge';
import { Server, Activity, Cpu, MemoryStick } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

export default function Workers() {
  const { data: workers, isLoading } = useListWorkers();

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto h-full overflow-y-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-1">Worker Fleet</h1>
        <p className="text-muted-foreground">Monitor the health and capacity of your execution nodes.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {isLoading ? (
          Array(8).fill(0).map((_, i) => <Skeleton key={i} className="h-64 w-full" />)
        ) : workers && workers.length > 0 ? (
          workers.map(worker => (
            <Card key={worker.id} className="flex flex-col border-l-4" style={{ borderLeftColor: worker.status === 'active' ? 'hsl(var(--chart-3))' : worker.status === 'idle' ? 'hsl(var(--chart-4))' : 'hsl(var(--destructive))' }}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg flex items-center gap-2 font-mono text-base truncate pr-2">
                    <Server className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="truncate">{worker.hostname}</span>
                  </CardTitle>
                  <WorkerStatusBadge status={worker.status} />
                </div>
                <CardDescription className="font-mono text-xs mt-1">ID: {worker.id.substring(0,8)}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-4 mt-auto">
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-muted-foreground"><Cpu className="w-3 h-3" /> CPU</span>
                      <span className="font-mono">{worker.cpu_usage || 0}%</span>
                    </div>
                    <Progress value={worker.cpu_usage || 0} className="h-1.5" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-muted-foreground"><MemoryStick className="w-3 h-3" /> Memory</span>
                      <span className="font-mono">{worker.memory_usage || 0}%</span>
                    </div>
                    <Progress value={worker.memory_usage || 0} className="h-1.5" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-4 border-t border-border/50 text-center">
                  <div className="flex flex-col">
                    <span className="text-lg font-semibold text-primary font-mono">{worker.running_jobs}</span>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Active</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-lg font-semibold text-green-500 font-mono">{worker.completed_jobs}</span>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Done</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-lg font-semibold text-destructive font-mono">{worker.failed_jobs}</span>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Failed</span>
                  </div>
                </div>

                <div className="pt-2 text-[10px] text-muted-foreground flex justify-between">
                  <span>Queue: {worker.current_queue || 'None'}</span>
                  <span>Beat: {worker.last_heartbeat ? new Date(worker.last_heartbeat).toLocaleTimeString() : 'Never'}</span>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="col-span-full py-12 text-center text-muted-foreground border border-dashed rounded-lg">
            No workers connected to the cluster.
          </div>
        )}
      </div>
    </div>
  );
}