import * as React from "react"
import { useQuery } from '@tanstack/react-query';
import { 
  useGetDashboardStats, 
  useGetDashboardMetrics, 
  useGetDashboardActivity, 
  useGetDashboardQueueSummary,
  GetDashboardMetricsPeriod 
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { cn, formatDateTime } from "@/lib/utils";
import { Activity, Clock, CheckCircle2, XCircle, ListOrdered, Server, BarChart3, RotateCw } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: metrics, isLoading: metricsLoading } = useGetDashboardMetrics({ period: '24h' as GetDashboardMetricsPeriod });
  const { data: activity, isLoading: activityLoading } = useGetDashboardActivity({ limit: 10 });
  const { data: queueSummary, isLoading: summaryLoading } = useGetDashboardQueueSummary();

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-1">Dashboard</h1>
        <p className="text-muted-foreground">Global overview of your job execution clusters.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Running Jobs" value={stats?.running_jobs} icon={Activity} loading={statsLoading} />
        <StatCard title="Queued Jobs" value={stats?.queued_jobs} icon={ListOrdered} loading={statsLoading} />
        <StatCard title="Active Workers" value={stats?.active_workers} icon={Server} loading={statsLoading} />
        <StatCard title="Success Rate" value={stats?.success_rate ? `${stats.success_rate.toFixed(1)}%` : '0%'} icon={CheckCircle2} loading={statsLoading} />
        <StatCard title="Failed Jobs" value={stats?.failed_jobs} icon={XCircle} loading={statsLoading} className="text-destructive" />
        <StatCard title="Avg Execution" value={stats?.avg_execution_ms ? `${(stats.avg_execution_ms / 1000).toFixed(2)}s` : '0s'} icon={Clock} loading={statsLoading} />
        <StatCard title="Throughput / min" value={stats?.throughput_per_minute} icon={BarChart3} loading={statsLoading} />
        <StatCard title="DLQ Count" value={stats?.dlq_count} icon={RotateCw} loading={statsLoading} className={stats?.dlq_count ? "text-destructive" : ""} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Execution Throughput (24h)</CardTitle>
            <CardDescription>Completed vs Failed jobs over time</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {metricsLoading ? (
              <Skeleton className="w-full h-full" />
            ) : metrics && metrics.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={metrics} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorFailed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-5))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--chart-5))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="timestamp" 
                    tickFormatter={(val) => new Date(val).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
                    labelFormatter={(val) => formatDateTime(val)}
                  />
                  <Area type="monotone" dataKey="completed" stroke="hsl(var(--chart-1))" fillOpacity={1} fill="url(#colorCompleted)" />
                  <Area type="monotone" dataKey="failed" stroke="hsl(var(--chart-5))" fillOpacity={1} fill="url(#colorFailed)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground border border-dashed rounded-md">
                No metrics available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Activity Feed</CardTitle>
            <CardDescription>Recent cluster events</CardDescription>
          </CardHeader>
          <CardContent>
            {activityLoading ? (
              <div className="space-y-4">
                {Array(5).fill(0).map((_, i) => <Skeleton key={i} className="w-full h-12" />)}
              </div>
            ) : activity && activity.length > 0 ? (
              <div className="space-y-4">
                {activity.map(event => (
                  <div key={event.id} className="flex gap-3 text-sm">
                    <div className="mt-0.5">
                      <ActivityIcon type={event.event_type} />
                    </div>
                    <div>
                      <p className="text-foreground leading-snug">{event.description}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{formatDateTime(event.timestamp)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-8">No recent activity</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Queue Summary</CardTitle>
          <CardDescription>Current state of all active queues</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Queue</TableHead>
                <TableHead>Project</TableHead>
                <TableHead className="text-right">Queued</TableHead>
                <TableHead className="text-right">Running</TableHead>
                <TableHead className="text-right">Completed</TableHead>
                <TableHead className="text-right">Failed</TableHead>
                <TableHead className="text-right">Throughput/min</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summaryLoading ? (
                Array(3).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    {Array(8).fill(0).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-16" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : queueSummary && queueSummary.length > 0 ? (
                queueSummary.map(q => (
                  <TableRow key={q.queue_id}>
                    <TableCell className="font-medium">{q.queue_name}</TableCell>
                    <TableCell className="text-muted-foreground">{q.project_name}</TableCell>
                    <TableCell className="text-right font-mono">{q.queued.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono text-primary">{q.running.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono text-green-500">{q.completed.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono text-destructive">{q.failed.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono">{q.throughput_per_minute?.toFixed(1) || '0.0'}</TableCell>
                    <TableCell>
                      {q.paused ? (
                        <Badge variant="warning">Paused</Badge>
                      ) : (
                        <Badge variant="success">Active</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No queues available
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, loading, className }: any) {
  return (
    <Card>
      <CardContent className="p-6 flex flex-row items-center justify-between space-y-0">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          {loading ? (
            <Skeleton className="h-7 w-20" />
          ) : (
            <p className={cn("text-2xl font-bold tracking-tight font-mono", className)}>
              {value != null ? value : '-'}
            </p>
          )}
        </div>
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
          <Icon className="h-6 w-6" />
        </div>
      </CardContent>
    </Card>
  );
}

function ActivityIcon({ type }: { type: string }) {
  switch(type) {
    case 'job_completed': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    case 'job_failed': return <XCircle className="w-4 h-4 text-destructive" />;
    case 'job_retried': return <RotateCw className="w-4 h-4 text-warning" />;
    case 'worker_online': return <Server className="w-4 h-4 text-primary" />;
    case 'worker_offline': return <Server className="w-4 h-4 text-muted-foreground" />;
    default: return <Activity className="w-4 h-4 text-muted-foreground" />;
  }
}