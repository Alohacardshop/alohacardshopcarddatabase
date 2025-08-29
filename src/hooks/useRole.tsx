import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

export const useRole = () => {
  const { user, loading: authLoading } = useAuth();
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRoles = async () => {
      if (!user) {
        setRoles([]);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        if (error) {
          console.error('Error fetching roles:', error);
          setRoles([]);
        } else {
          setRoles(data.map(row => row.role));
        }
      } catch (error) {
        console.error('Error fetching roles:', error);
        setRoles([]);
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) {
      fetchRoles();
    }
  }, [user, authLoading]);

  const hasRole = (role: string) => roles.includes(role);
  const isAdmin = hasRole('admin');
  const isStaff = hasRole('staff');

  // Check for dev bypass
  const bypassEnabled = import.meta.env.VITE_BYPASS_ROLE_GUARD === 'true';
  const canBypass = bypassEnabled && user !== null;

  return {
    roles,
    hasRole,
    isAdmin: isAdmin || canBypass,
    isStaff: isStaff || canBypass,
    loading: authLoading || loading,
    bypassEnabled
  };
};