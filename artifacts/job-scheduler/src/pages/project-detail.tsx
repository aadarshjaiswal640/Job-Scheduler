import React, { useState } from 'react';
import { useRoute, Link } from 'wouter';
import { 
  useGetProject, 
  useListQueues, 
  useCreateQueue,
  getListQueuesQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Plus, ListOrdered, PauseCircle, PlayCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function ProjectDetail() {
  const [, params] = useRoute("/projects/:id");
  const projectId = params?.id || '';
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: project, isLoading: projLoading } = useGetProject(projectId);
  const { data: queues, isLoading: queuesLoading } = useListQueues(projectId);
  const createQueue = useCreateQueue();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [concurrency, setConcurrency] = useState('10');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createQueue.mutate({ 
      projectId, 
      data: { 
        name, 
        description: desc, 
        concurrency: parseInt(concurrency) || 10,
        retry_policy: { strategy: 'exponential', max_retries: 3, retry_interval_seconds: 60 }
      } 
    }, {
      onSuccess: () => {
        toast({ title: "Queue created" });
        queryClient.invalidateQueries({ queryKey: getListQueuesQueryKey(projectId) });
        setOpen(false);
        setName('');
        setDesc('');
        setConcurrency('10');
      },
      onError: (err) => {
        toast({ title: "Queue creation failed", description: err.message, variant: "destructive" });
      }
    });
  };

  if (projLoading) return <div className="p-6"><Skeleton className="h-10 w-64 mb-6" /><Skeleton className="h-64 w-full" /></div>;
  if (!project) return <div className="p-6 text-destructive">Project not found</div>;

  return (
    <div className="p-6 space-y-6 max-w-[1200px] mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href={`/organizations/${project.org_id}`} className="text-muted-foreground hover:text-foreground text-sm">
              &larr; Back to Organization
            </Link>
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">{project.name}</h1>
          <p className="text-muted-foreground">{project.description || project.slug}</p>
        </div>
        
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> New Queue</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Queue</DialogTitle>
              <DialogDescription>A queue processes a specific type of jobs.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Name</label>
                  <Input required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. email-sending" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Description</label>
                  <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Optional" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Concurrency</label>
                  <Input type="number" min="1" required value={concurrency} onChange={e => setConcurrency(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createQueue.isPending}>
                  {createQueue.isPending ? "Creating..." : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {queuesLoading ? (
          Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)
        ) : queues && queues.length > 0 ? (
          queues.map(queue => (
            <Link key={queue.id} href={`/queues/${queue.id}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full flex flex-col">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <ListOrdered className="w-4 h-4 text-primary" />
                      {queue.name}
                    </CardTitle>
                    {queue.paused ? (
                      <Badge variant="warning" className="flex items-center gap-1 px-1.5 py-0">
                        <PauseCircle className="w-3 h-3" /> Paused
                      </Badge>
                    ) : (
                      <Badge variant="success" className="flex items-center gap-1 px-1.5 py-0 bg-green-500 hover:bg-green-600">
                        <PlayCircle className="w-3 h-3" /> Active
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="line-clamp-1">{queue.description || "No description"}</CardDescription>
                </CardHeader>
                <CardContent className="mt-auto pt-4">
                  <div className="grid grid-cols-3 gap-2 text-center text-sm">
                    <div className="bg-muted rounded-md p-2 flex flex-col">
                      <span className="font-mono text-foreground font-medium">{queue.job_counts?.queued || 0}</span>
                      <span className="text-xs text-muted-foreground">Queued</span>
                    </div>
                    <div className="bg-primary/10 text-primary rounded-md p-2 flex flex-col">
                      <span className="font-mono font-medium">{queue.job_counts?.running || 0}</span>
                      <span className="text-xs opacity-80">Running</span>
                    </div>
                    <div className="bg-destructive/10 text-destructive rounded-md p-2 flex flex-col">
                      <span className="font-mono font-medium">{queue.job_counts?.failed || 0}</span>
                      <span className="text-xs opacity-80">Failed</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        ) : (
          <div className="col-span-full py-12 text-center text-muted-foreground border border-dashed rounded-lg">
            No queues found. Create one to start processing jobs.
          </div>
        )}
      </div>
    </div>
  );
}