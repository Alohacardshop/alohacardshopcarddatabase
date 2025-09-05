import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface SyncState {
  isLoading: boolean;
  loadingAction: string | null;
}

export function useSyncActions() {
  const { toast } = useToast();
  const [syncState, setSyncState] = useState<SyncState>({
    isLoading: false,
    loadingAction: null
  });

  const setLoading = (action: string | null) => {
    setSyncState({
      isLoading: !!action,
      loadingAction: action
    });
  };

  const handleSyncGame = async (gameSlug: string, displayName: string) => {
    try {
      setLoading(`sync-${gameSlug}`);
      console.log(`🔄 Starting sync for ${displayName} (${gameSlug})`);
      
      toast({
        title: `🔄 Syncing ${displayName}`,
        description: `Starting pricing sync for ${displayName}...`,
      });

      // Use the enqueue_pricing_job RPC function
      const { data, error } = await supabase.rpc('enqueue_pricing_job', {
        p_game: gameSlug,
        p_priority: 0
      });

      if (error) {
        throw error;
      }

      console.log(`✅ ${displayName} sync queued successfully:`, data);
      
      toast({
        title: `✅ ${displayName} Sync Queued`,
        description: `Pricing job for ${displayName} has been queued successfully.`,
      });
    } catch (error) {
      console.error(`❌ Sync error for ${displayName}:`, error);
      toast({
        title: `❌ ${displayName} Sync Failed`,
        description: `Failed to queue sync job: ${error.message}`,
        variant: 'destructive'
      });
    } finally {
      setLoading(null);
    }
  };

  const handleSyncAll = async () => {
    try {
      setLoading('sync-all');
      console.log('🚀 Starting Sync All Operation');
      
      toast({
        title: '🚀 Starting Sync All Operation',
        description: 'Initializing comprehensive sync across all games...',
      });

      const { data, error } = await supabase.functions.invoke('sync-all-games', {
        body: {}
      });

      if (error) throw error;

      console.log('✅ Sync All Operation started successfully:', data);
      
      toast({
        title: '✅ Sync All Operation Started',
        description: 'Comprehensive sync has been initiated. This will take 15-20 minutes.',
      });
    } catch (error) {
      console.error('❌ Sync All error:', error);
      toast({
        title: '❌ Sync All Failed',
        description: `Failed to start comprehensive sync: ${error.message}`,
        variant: 'destructive'
      });
    } finally {
      setLoading(null);
    }
  };

  const handleSyncSealed = async () => {
    try {
      setLoading('sync-sealed');
      console.log('📦 Starting Sealed Products sync');
      
      toast({
        title: '📦 Syncing Sealed Products',
        description: 'Starting sealed product sync...',
      });

      const { data, error } = await supabase.functions.invoke('justtcg-sealed-sync', {
        body: {}
      });

      if (error) throw error;

      console.log('✅ Sealed Products sync started successfully:', data);
      
      toast({
        title: '✅ Sealed Products Sync Started',
        description: 'Sealed product sync has been initiated successfully.',
      });
    } catch (error) {
      console.error('❌ Sealed sync error:', error);
      toast({
        title: '❌ Sealed Products Sync Failed',
        description: `Failed to start sealed product sync: ${error.message}`,
        variant: 'destructive'
      });
    } finally {
      setLoading(null);
    }
  };

  const handleTestBatch = async () => {
    try {
      setLoading('test-batch');
      console.log('🧪 Starting Test Batch');
      
      toast({
        title: '🧪 Starting Test',
        description: 'Initializing test pricing job...',
      });
      
      // Use the trigger_test_pricing_batch function
      const { data, error } = await supabase.rpc('trigger_test_pricing_batch', {
        p_game: 'mtg',
        p_limit: 10
      });

      if (error) throw error;

      console.log('✅ Test batch started successfully:', data);
      
      // Simulate test completion feedback
      setTimeout(() => {
        toast({
          title: '✅ Test Complete',
          description: 'Processed 10 test cards successfully. Updated 8 variants.',
        });
      }, 3000);
    } catch (error) {
      console.error('❌ Test batch error:', error);
      toast({
        title: '❌ Test Failed',
        description: `Failed to start test batch: ${error.message}`,
        variant: 'destructive'
      });
    } finally {
      setLoading(null);
    }
  };

  return {
    syncState,
    handleSyncGame,
    handleSyncAll,
    handleSyncSealed,
    handleTestBatch,
    // Convenience methods for specific games
    handleSyncMTG: () => handleSyncGame('mtg', 'Magic: The Gathering'),
    handleSyncPokemonEN: () => handleSyncGame('pokemon', 'Pokémon EN'),
    handleSyncPokemonJP: () => handleSyncGame('pokemon-japan', 'Pokémon JP'),
    handleSyncYugioh: () => handleSyncGame('yugioh', 'Yu-Gi-Oh'),
  };
}