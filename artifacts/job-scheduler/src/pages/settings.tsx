import React from 'react';
import { useGetCurrentUser } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useTheme } from '@/components/theme-provider';
import { Button } from '@/components/ui/button';
import { Moon, Sun, Monitor, User as UserIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const { data: user, isLoading } = useGetCurrentUser();

  return (
    <div className="p-6 space-y-6 max-w-[800px] mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-1">Settings</h1>
        <p className="text-muted-foreground">Manage your account and preferences.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><UserIcon className="w-5 h-5" /> Account Profile</CardTitle>
          <CardDescription>Your personal information and role</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
          ) : user ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 border-b pb-4">
                <div className="text-sm font-medium text-muted-foreground">Full Name</div>
                <div className="col-span-2 font-medium">{user.full_name}</div>
              </div>
              <div className="grid grid-cols-3 gap-4 border-b pb-4">
                <div className="text-sm font-medium text-muted-foreground">Email</div>
                <div className="col-span-2">{user.email}</div>
              </div>
              <div className="grid grid-cols-3 gap-4 border-b pb-4">
                <div className="text-sm font-medium text-muted-foreground">Global Role</div>
                <div className="col-span-2"><Badge variant="outline" className="capitalize">{user.role}</Badge></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-sm font-medium text-muted-foreground">Joined</div>
                <div className="col-span-2 text-sm">{formatDateTime(user.created_at)}</div>
              </div>
            </div>
          ) : (
            <p>Failed to load profile.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Customize the look and feel of the dashboard.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button 
              variant={theme === 'light' ? 'default' : 'outline'} 
              className="flex-1 h-24 flex flex-col gap-2"
              onClick={() => setTheme('light')}
            >
              <Sun className="w-6 h-6" />
              Light
            </Button>
            <Button 
              variant={theme === 'dark' ? 'default' : 'outline'} 
              className="flex-1 h-24 flex flex-col gap-2"
              onClick={() => setTheme('dark')}
            >
              <Moon className="w-6 h-6" />
              Dark
            </Button>
            <Button 
              variant={theme === 'system' ? 'default' : 'outline'} 
              className="flex-1 h-24 flex flex-col gap-2"
              onClick={() => setTheme('system')}
            >
              <Monitor className="w-6 h-6" />
              System
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}