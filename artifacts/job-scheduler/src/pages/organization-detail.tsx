import React, { useState } from 'react';
import { useRoute, Link } from 'wouter';
import { 
  useGetOrganization, 
  useListOrganizationMembers, 
  useListProjects,
  useInviteMember,
  useCreateProject,
  getListOrganizationMembersQueryKey,
  getListProjectsQueryKey,
  MemberInviteRole
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime } from '@/lib/utils';
import { Plus, FolderGit2, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function OrganizationDetail() {
  const [, params] = useRoute("/organizations/:id");
  const orgId = params?.id || '';
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: org, isLoading: orgLoading } = useGetOrganization(orgId);
  const { data: members, isLoading: membersLoading } = useListOrganizationMembers(orgId);
  const { data: projects, isLoading: projectsLoading } = useListProjects(orgId);

  const inviteMember = useInviteMember();
  const createProject = useCreateProject();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  
  const [projOpen, setProjOpen] = useState(false);
  const [projName, setProjName] = useState('');
  const [projDesc, setProjDesc] = useState('');

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    inviteMember.mutate({ orgId, data: { email: inviteEmail, role: 'member' } }, {
      onSuccess: () => {
        toast({ title: "Member invited" });
        queryClient.invalidateQueries({ queryKey: getListOrganizationMembersQueryKey(orgId) });
        setInviteOpen(false);
        setInviteEmail('');
      },
      onError: (err) => {
        toast({ title: "Invite failed", description: err.message, variant: "destructive" });
      }
    });
  };

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    createProject.mutate({ orgId, data: { name: projName, description: projDesc } }, {
      onSuccess: () => {
        toast({ title: "Project created" });
        queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey(orgId) });
        setProjOpen(false);
        setProjName('');
        setProjDesc('');
      },
      onError: (err) => {
        toast({ title: "Project creation failed", description: err.message, variant: "destructive" });
      }
    });
  };

  if (orgLoading) return <div className="p-6"><Skeleton className="h-10 w-64 mb-6" /><Skeleton className="h-64 w-full" /></div>;
  if (!org) return <div className="p-6 text-destructive">Organization not found</div>;

  return (
    <div className="p-6 space-y-6 max-w-[1200px] mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-1">{org.name}</h1>
        <p className="text-muted-foreground">{org.description || org.slug}</p>
      </div>

      <Tabs defaultValue="projects" className="w-full">
        <TabsList>
          <TabsTrigger value="projects"><FolderGit2 className="w-4 h-4 mr-2" /> Projects</TabsTrigger>
          <TabsTrigger value="members"><Users className="w-4 h-4 mr-2" /> Members</TabsTrigger>
        </TabsList>
        
        <TabsContent value="projects" className="mt-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Projects</h2>
            <Dialog open={projOpen} onOpenChange={setProjOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="w-4 h-4 mr-2" /> New Project</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Project</DialogTitle>
                  <DialogDescription>A project groups related queues together.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateProject}>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Name</label>
                      <Input required value={projName} onChange={e => setProjName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Description</label>
                      <Input value={projDesc} onChange={e => setProjDesc(e.target.value)} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={createProject.isPending}>
                      {createProject.isPending ? "Creating..." : "Create"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projectsLoading ? (
              Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)
            ) : projects && projects.length > 0 ? (
              projects.map(proj => (
                <Link key={proj.id} href={`/projects/${proj.id}`}>
                  <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">{proj.name}</CardTitle>
                      <CardDescription className="line-clamp-1">{proj.description || "No description"}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-4">
                        <div className="flex flex-col">
                          <span className="font-mono text-foreground font-medium">{proj.queue_count}</span>
                          <span className="text-xs">Queues</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="font-mono text-foreground font-medium">{proj.job_count || 0}</span>
                          <span className="text-xs">Total Jobs</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))
            ) : (
              <div className="col-span-full py-8 text-center text-muted-foreground border border-dashed rounded-lg">
                No projects yet. Create one to start scheduling jobs.
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="members" className="mt-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Members</h2>
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="w-4 h-4 mr-2" /> Invite Member</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite Member</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleInvite}>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Email Address</label>
                      <Input type="email" required value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={inviteMember.isPending}>
                      {inviteMember.isPending ? "Inviting..." : "Invite"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {membersLoading ? (
                  Array(3).fill(0).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    </TableRow>
                  ))
                ) : members && members.length > 0 ? (
                  members.map(member => (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{member.full_name}</div>
                          <div className="text-xs text-muted-foreground">{member.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{member.role}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDateTime(member.joined_at)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-4 text-muted-foreground">No members found</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}