import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface GameConfig {
  id: string;
  slug: string;
  display_name: string;
  justtcg_api_slug: string;
  is_active: boolean;
}

interface GameMapping {
  databaseSlug: string;
  apiSlug: string;
  displayName: string;
}

export class GameService {
  private supabase: SupabaseClient;
  private gameConfigs: GameConfig[] | null = null;
  private lastFetch: number = 0;
  private cacheTTL = 300000; // 5 minutes cache

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Fetch and cache game configurations from the database
   */
  private async fetchGameConfigs(): Promise<GameConfig[]> {
    const now = Date.now();
    
    // Return cached data if still valid
    if (this.gameConfigs && (now - this.lastFetch) < this.cacheTTL) {
      return this.gameConfigs;
    }

    console.log('🔄 Fetching game configurations from database...');
    
    const { data, error } = await this.supabase
      .from('game_configs')
      .select('*')
      .eq('is_active', true);

    if (error) {
      console.error('❌ Failed to fetch game configs:', error);
      throw new Error(`Failed to fetch game configurations: ${error.message}`);
    }

    this.gameConfigs = data || [];
    this.lastFetch = now;
    
    console.log(`✅ Loaded ${this.gameConfigs.length} game configurations`);
    return this.gameConfigs;
  }

  /**
   * Get game mapping for a given input slug
   */
  async getGameMapping(inputSlug: string): Promise<GameMapping | null> {
    const configs = await this.fetchGameConfigs();
    
    // Direct slug match
    let config = configs.find(c => c.slug === inputSlug);
    
    // If not found, try case-insensitive match
    if (!config) {
      config = configs.find(c => 
        c.slug.toLowerCase() === inputSlug.toLowerCase()
      );
    }

    // If still not found, try partial matching for common variations
    if (!config) {
      config = configs.find(c => {
        const variations = this.getSlugVariations(c.slug);
        return variations.some(v => v === inputSlug.toLowerCase());
      });
    }

    if (!config) {
      console.log(`⚠️ No game configuration found for slug: ${inputSlug}`);
      return null;
    }

    return {
      databaseSlug: config.slug,
      apiSlug: config.justtcg_api_slug,
      displayName: config.display_name
    };
  }

  /**
   * Get all supported game slugs
   */
  async getSupportedGames(): Promise<string[]> {
    const configs = await this.fetchGameConfigs();
    return configs.map(c => c.slug);
  }

  /**
   * Validate if a game is supported
   */
  async isGameSupported(inputSlug: string): Promise<boolean> {
    const mapping = await this.getGameMapping(inputSlug);
    return mapping !== null;
  }

  /**
   * Get common slug variations for better matching
   */
  private getSlugVariations(slug: string): string[] {
    const variations = [slug.toLowerCase()];
    
    switch (slug) {
      case 'mtg':
        variations.push('magic', 'magic-the-gathering', 'magic: the gathering');
        break;
      case 'pokemon':
        variations.push('pokémon', 'pokemon-en', 'pokémon en', 'pokemon en');
        break;
      case 'pokemon-japan':
        variations.push('pokemon-jp', 'pokémon jp', 'pokemon jp', 'pokémon japan');
        break;
      case 'yugioh':
        variations.push('yu-gi-oh', 'yu-gi-oh!', 'yugioh!');
        break;
    }
    
    return variations;
  }

  /**
   * Log game mapping for debugging
   */
  logGameMapping(inputSlug: string, mapping: GameMapping | null): void {
    if (mapping) {
      console.log(`🎮 Game mapping: "${inputSlug}" -> DB: "${mapping.databaseSlug}", API: "${mapping.apiSlug}"`);
    } else {
      console.log(`❌ Game mapping failed for: "${inputSlug}"`);
    }
  }
}