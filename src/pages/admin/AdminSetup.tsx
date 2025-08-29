import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Copy, Shield, CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react';

export default function AdminSetup() {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [hasAdminUsers, setHasAdminUsers] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);

  const checkAdminUsers = async () => {
    setChecking(true);
    try {
      const { data, error } = await supabase.rpc('has_admin_users');
      if (error) {
        console.error('Error checking admin users:', error);
        setHasAdminUsers(null);
      } else {
        setHasAdminUsers(data);
      }
    } catch (error) {
      console.error('Error checking admin users:', error);
      setHasAdminUsers(null);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (user) {
      checkAdminUsers();
    }
  }, [user]);

  const sqlSnippet = user ? `-- Run this in Supabase SQL Editor to promote your account
select public.grant_role_by_email('${user.email}', 'admin');` : '';

  const copyToClipboard = async () => {
    if (!sqlSnippet) return;
    
    try {
      await navigator.clipboard.writeText(sqlSnippet);
      toast({
        title: "Copied!",
        description: "SQL snippet copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Please copy the SQL manually",
        variant: "destructive",
      });
    }
  };

  if (loading || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // If admin users exist, redirect to main admin
  if (hasAdminUsers) {
    return <Navigate to="/admin" replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Admin Setup Required</CardTitle>
          <CardDescription>
            No administrator users found. Let's set up your first admin account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              You're currently signed in as <strong>{user.email}</strong> but don't have admin privileges yet.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">Step 1: Run SQL Command</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Copy and run this SQL snippet in your Supabase SQL Editor to promote your account:
              </p>
              
              <div className="relative">
                <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
                  <code>{sqlSnippet}</code>
                </pre>
                <Button
                  size="sm"
                  variant="outline"
                  className="absolute top-2 right-2"
                  onClick={copyToClipboard}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2">Step 2: Access Supabase</h3>
              <div className="flex gap-2">
                <Button asChild>
                  <a 
                    href={`https://supabase.com/dashboard/project/${import.meta.env.VITE_SUPABASE_URL?.split('//')[1]?.split('.')[0]}/sql/new`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open SQL Editor
                  </a>
                </Button>
                <Badge variant="outline">Opens in new tab</Badge>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2">Step 3: Verify Setup</h3>
              <p className="text-sm text-muted-foreground mb-3">
                After running the SQL command, click the button below to check if admin access is now available:
              </p>
              
              <Button onClick={checkAdminUsers} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Check Admin Status
              </Button>
            </div>
          </div>

          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              Once you have admin privileges, you'll automatically be redirected to the admin panel.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}