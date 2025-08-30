import { supabase } from '@/integrations/supabase/client';

const FUNCTIONS_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

export class JustTCGApi {
  
  static async discoverGames() {
    try {
      const { data, error } = await supabase.functions.invoke('discover-games', {
        body: {}
      });

      if (error) {
        throw new Error(error.message || 'Failed to discover games');
      }

      return data;
    } catch (error) {
      console.error('JustTCG API Error - discoverGames:', error);
      throw error;
    }
  }

  static async discoverSets(gameSlug: string) {
    try {
      const { data, error } = await supabase.functions.invoke('discover-sets', {
        body: { gameSlug }
      });

      if (error) {
        throw new Error(error.message || 'Failed to discover sets');
      }

      return data;
    } catch (error) {
      console.error('JustTCG API Error - discoverSets:', error);
      throw error;
    }
  }

  static async importCards(gameSlug: string, setCode: string) {
    try {
      const { data, error } = await supabase.functions.invoke('justtcg-import', {
        body: { gameSlug, setCode }
      });

      if (error) {
        throw new Error(error.message || 'Failed to import cards');
      }

      return data;
    } catch (error) {
      console.error('JustTCG API Error - importCards:', error);
      throw error;
    }
  }
}