import { ReactNode, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useRole } from '@/hooks/useRole';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Shield, BookOpen, AlertTriangle } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  requireRole?: string;
}

export const ProtectedRoute = ({ children, requireRole = 'admin' }: ProtectedRouteProps) => {
  const { user, loading: authLoading } = useAuth();
  const { hasRole, loading: roleLoading, bypassEnabled } = useRole();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && !user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to access this page.",
        variant: "destructive",
      });
    }
  }, [user, authLoading, toast]);

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!hasRole(requireRole)) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <Shield className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Access Restricted</CardTitle>
            <CardDescription>
              You're signed in but don't have the required permissions to access this area.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted rounded-lg p-4">
              <p className="text-sm text-muted-foreground">
                <strong>Required role:</strong> {requireRole}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Ask an administrator to grant you the <strong>{requireRole}</strong> role to access this page.
              </p>
            </div>
            
            {bypassEnabled && (
              <div className="bg-warning/10 border border-warning/20 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  <span className="text-sm font-medium text-warning">Development Mode</span>
                </div>
                <p className="text-xs text-warning/80">
                  Role bypass is enabled but you still need the required role. Check your user_roles table.
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <Button asChild variant="outline" className="flex-1">
                <a href="/">
                  Back to Home
                </a>
              </Button>
              <Button asChild variant="outline" size="sm">
                <a href="/docs/ONBOARDING.md" target="_blank" className="flex items-center gap-1">
                  <BookOpen className="h-4 w-4" />
                  Help
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
};