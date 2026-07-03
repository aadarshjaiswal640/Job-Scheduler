import { Link, useLocation } from "wouter";
import { useAuth } from "./auth-provider";
import { useLiveUpdates } from "@/hooks/use-live-updates";
import { 
  Activity, 
  LayoutDashboard, 
  Building2, 
  FolderGit2, 
  ListOrdered, 
  Settings, 
  LogOut, 
  Moon, 
  Sun,
  Boxes,
  Server,
  AlertTriangle
} from "lucide-react";
import { useTheme } from "./theme-provider";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/organizations", label: "Organizations", icon: Building2 },
  { href: "/jobs", label: "Job Explorer", icon: ListOrdered },
  { href: "/workers", label: "Workers", icon: Server },
  { href: "/dlq", label: "Dead Letter Queue", icon: AlertTriangle },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const { logout } = useAuth();
  const [location] = useLocation();
  const { theme, setTheme } = useTheme();
  const { status } = useLiveUpdates();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card flex flex-col z-10 shrink-0">
        <div className="h-14 border-b flex items-center px-4 shrink-0">
          <div className="flex items-center gap-2 font-bold text-lg text-primary tracking-tight">
            <Activity className="w-5 h-5" />
            <span>JobControl</span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = location.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                  isActive 
                    ? "bg-primary/10 text-primary" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t shrink-0 space-y-2">
          <div className="flex items-center justify-between text-xs px-2 mb-4">
            <span className="text-muted-foreground">Live Status</span>
            <div className="flex items-center gap-1.5">
              <div className={cn(
                "w-2 h-2 rounded-full",
                status === 'connected' ? "bg-chart-3" : 
                status === 'connecting' ? "bg-chart-4 animate-pulse" : "bg-destructive"
              )} />
              <span className="capitalize">{status}</span>
            </div>
          </div>
          <Link 
            href="/settings"
            className={cn(
              "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
              location.startsWith("/settings")
                ? "bg-primary/10 text-primary" 
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Settings className="w-4 h-4" />
            Settings
          </Link>
          <button 
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors text-muted-foreground hover:bg-muted hover:text-foreground text-left"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            Toggle Theme
          </button>
          <button 
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors text-destructive hover:bg-destructive/10 text-left"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto flex flex-col min-w-0">
        {children}
      </main>
    </div>
  );
}
