import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { ThemeProvider } from '@/components/theme-provider';
import { AuthProvider, ProtectedRoute } from '@/components/auth-provider';
import { Shell } from '@/components/shell';

// Pages
import Login from '@/pages/login';
import Register from '@/pages/register';
import Dashboard from '@/pages/dashboard';
import Organizations from '@/pages/organizations';
import OrganizationDetail from '@/pages/organization-detail';
import ProjectDetail from '@/pages/project-detail';
import QueueDetail from '@/pages/queue-detail';
import JobExplorer from '@/pages/job-explorer';
import JobDetail from '@/pages/job-detail';
import Workers from '@/pages/workers';
import Dlq from '@/pages/dlq';
import Settings from '@/pages/settings';

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      
      <Route path="/">
        <ProtectedRoute>
          <Shell>
            <Dashboard />
          </Shell>
        </ProtectedRoute>
      </Route>
      
      <Route path="/dashboard">
        <ProtectedRoute>
          <Shell>
            <Dashboard />
          </Shell>
        </ProtectedRoute>
      </Route>
      
      <Route path="/organizations">
        <ProtectedRoute>
          <Shell>
            <Organizations />
          </Shell>
        </ProtectedRoute>
      </Route>
      
      <Route path="/organizations/:id">
        <ProtectedRoute>
          <Shell>
            <OrganizationDetail />
          </Shell>
        </ProtectedRoute>
      </Route>
      
      <Route path="/projects/:id">
        <ProtectedRoute>
          <Shell>
            <ProjectDetail />
          </Shell>
        </ProtectedRoute>
      </Route>
      
      <Route path="/queues/:id">
        <ProtectedRoute>
          <Shell>
            <QueueDetail />
          </Shell>
        </ProtectedRoute>
      </Route>
      
      <Route path="/jobs">
        <ProtectedRoute>
          <Shell>
            <JobExplorer />
          </Shell>
        </ProtectedRoute>
      </Route>
      
      <Route path="/jobs/:id">
        <ProtectedRoute>
          <Shell>
            <JobDetail />
          </Shell>
        </ProtectedRoute>
      </Route>
      
      <Route path="/workers">
        <ProtectedRoute>
          <Shell>
            <Workers />
          </Shell>
        </ProtectedRoute>
      </Route>
      
      <Route path="/dlq">
        <ProtectedRoute>
          <Shell>
            <Dlq />
          </Shell>
        </ProtectedRoute>
      </Route>
      
      <Route path="/settings">
        <ProtectedRoute>
          <Shell>
            <Settings />
          </Shell>
        </ProtectedRoute>
      </Route>
      
      <Route>
        <ProtectedRoute>
          <Shell>
            <NotFound />
          </Shell>
        </ProtectedRoute>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="dark">
      <QueryClientProvider client={queryClient}>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <AuthProvider>
            <TooltipProvider>
              <Router />
              <Toaster />
            </TooltipProvider>
          </AuthProvider>
        </WouterRouter>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
