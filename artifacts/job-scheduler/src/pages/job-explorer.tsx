import React, { useState } from 'react';
import { useListAllJobs } from '@workspace/api-client-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime } from '@/lib/utils';
import { JobStatusBadge } from '@/components/job-status-badge';
import { Link } from 'wouter';
import { Search, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function JobExplorer() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [page, setPage] = useState(1);

  const { data: jobPage, isLoading } = useListAllJobs({
    search: search || undefined,
    status: status !== 'all' ? status : undefined,
    page,
    limit: 50
  });

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto h-full flex flex-col">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-1">Job Explorer</h1>
        <p className="text-muted-foreground">Search and filter across all historical and active jobs.</p>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search by job ID or name..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[180px]">
            <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Filter Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="queued">Queued</SelectItem>
            <SelectItem value="running">Running</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="dead">Dead</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="flex-1 flex flex-col min-h-0">
        <div className="overflow-auto flex-1">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10 shadow-sm">
              <TableRow>
                <TableHead className="w-24">ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Queue</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead>Duration</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(10).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    {Array(7).fill(0).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full max-w-[100px]" /></TableCell>)}
                  </TableRow>
                ))
              ) : jobPage?.jobs && jobPage.jobs.length > 0 ? (
                jobPage.jobs.map(job => (
                  <TableRow key={job.id} className="group">
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      <Link href={`/jobs/${job.id}`} className="hover:text-primary hover:underline">
                        {job.id.substring(0,8)}
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link href={`/jobs/${job.id}`} className="hover:underline text-foreground group-hover:text-primary transition-colors">
                        {job.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{job.queue_name || job.queue_id.substring(0,8)}</TableCell>
                    <TableCell className="capitalize text-sm">{job.job_type}</TableCell>
                    <TableCell><JobStatusBadge status={job.status} /></TableCell>
                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap">{formatDateTime(job.created_at)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm font-mono">
                      {job.started_at && job.completed_at ? 
                        `${((new Date(job.completed_at).getTime() - new Date(job.started_at).getTime()) / 1000).toFixed(2)}s` 
                        : '-'}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    No jobs match your filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        
        {jobPage && jobPage.pages && jobPage.pages > 1 && (
          <div className="p-4 border-t flex justify-between items-center bg-muted/20 mt-auto shrink-0">
            <span className="text-sm text-muted-foreground">
              Showing page {page} of {jobPage.pages} ({jobPage.total} total)
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= (jobPage.pages || 1)} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}