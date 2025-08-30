export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      cards: {
        Row: {
          cmc: number | null
          color_identity: string[] | null
          colors: string[] | null
          created_at: string
          details: Json | null
          id: string
          image_small_url: string | null
          image_url: string | null
          item_type: Database["public"]["Enums"]["item_type_enum"]
          justtcg_card_id: string
          keywords: string[] | null
          loyalty: string | null
          mana_cost: string | null
          name: string
          number: string | null
          oracle_text: string | null
          power: string | null
          rarity: string | null
          set_id: string
          tcgplayer_id: string | null
          toughness: string | null
          type_line: string | null
          updated_at: string
        }
        Insert: {
          cmc?: number | null
          color_identity?: string[] | null
          colors?: string[] | null
          created_at?: string
          details?: Json | null
          id?: string
          image_small_url?: string | null
          image_url?: string | null
          item_type?: Database["public"]["Enums"]["item_type_enum"]
          justtcg_card_id: string
          keywords?: string[] | null
          loyalty?: string | null
          mana_cost?: string | null
          name: string
          number?: string | null
          oracle_text?: string | null
          power?: string | null
          rarity?: string | null
          set_id: string
          tcgplayer_id?: string | null
          toughness?: string | null
          type_line?: string | null
          updated_at?: string
        }
        Update: {
          cmc?: number | null
          color_identity?: string[] | null
          colors?: string[] | null
          created_at?: string
          details?: Json | null
          id?: string
          image_small_url?: string | null
          image_url?: string | null
          item_type?: Database["public"]["Enums"]["item_type_enum"]
          justtcg_card_id?: string
          keywords?: string[] | null
          loyalty?: string | null
          mana_cost?: string | null
          name?: string
          number?: string | null
          oracle_text?: string | null
          power?: string | null
          rarity?: string | null
          set_id?: string
          tcgplayer_id?: string | null
          toughness?: string | null
          type_line?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cards_set_id_fkey"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "sets"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          justtcg_id: string | null
          logo_url: string | null
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          justtcg_id?: string | null
          logo_url?: string | null
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          justtcg_id?: string | null
          logo_url?: string | null
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      sets: {
        Row: {
          card_count: number | null
          code: string
          created_at: string
          description: string | null
          game_id: string
          id: string
          image_url: string | null
          justtcg_set_id: string | null
          last_synced_at: string | null
          name: string
          release_date: string | null
          sync_status: Database["public"]["Enums"]["sync_status_enum"] | null
          updated_at: string
        }
        Insert: {
          card_count?: number | null
          code: string
          created_at?: string
          description?: string | null
          game_id: string
          id?: string
          image_url?: string | null
          justtcg_set_id?: string | null
          last_synced_at?: string | null
          name: string
          release_date?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status_enum"] | null
          updated_at?: string
        }
        Update: {
          card_count?: number | null
          code?: string
          created_at?: string
          description?: string | null
          game_id?: string
          id?: string
          image_url?: string | null
          justtcg_set_id?: string | null
          last_synced_at?: string | null
          name?: string
          release_date?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status_enum"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sets_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_details: Json | null
          game_slug: string | null
          id: string
          progress: number | null
          results: Json | null
          set_code: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["sync_job_status_enum"] | null
          total: number | null
          type: Database["public"]["Enums"]["sync_job_type_enum"]
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_details?: Json | null
          game_slug?: string | null
          id?: string
          progress?: number | null
          results?: Json | null
          set_code?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["sync_job_status_enum"] | null
          total?: number | null
          type: Database["public"]["Enums"]["sync_job_type_enum"]
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_details?: Json | null
          game_slug?: string | null
          id?: string
          progress?: number | null
          results?: Json | null
          set_code?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["sync_job_status_enum"] | null
          total?: number | null
          type?: Database["public"]["Enums"]["sync_job_type_enum"]
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          role: string
          user_id: string
        }
        Insert: {
          role: string
          user_id: string
        }
        Update: {
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      variants: {
        Row: {
          card_id: string
          condition: Database["public"]["Enums"]["card_condition_enum"]
          created_at: string
          high_price_cents: number | null
          id: string
          is_available: boolean | null
          justtcg_variant_id: string
          last_updated: string | null
          low_price_cents: number | null
          market_price_cents: number | null
          price_cents: number | null
          printing: Database["public"]["Enums"]["card_printing_enum"]
          updated_at: string
        }
        Insert: {
          card_id: string
          condition?: Database["public"]["Enums"]["card_condition_enum"]
          created_at?: string
          high_price_cents?: number | null
          id?: string
          is_available?: boolean | null
          justtcg_variant_id: string
          last_updated?: string | null
          low_price_cents?: number | null
          market_price_cents?: number | null
          price_cents?: number | null
          printing?: Database["public"]["Enums"]["card_printing_enum"]
          updated_at?: string
        }
        Update: {
          card_id?: string
          condition?: Database["public"]["Enums"]["card_condition_enum"]
          created_at?: string
          high_price_cents?: number | null
          id?: string
          is_available?: boolean | null
          justtcg_variant_id?: string
          last_updated?: string | null
          low_price_cents?: number | null
          market_price_cents?: number | null
          price_cents?: number | null
          printing?: Database["public"]["Enums"]["card_printing_enum"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "variants_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variants_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "popular_cards"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      database_stats: {
        Row: {
          active_jobs: number | null
          cards_table_size: string | null
          last_updated: string | null
          recent_jobs: number | null
          sync_status_breakdown: Json | null
          synced_sets: number | null
          total_cards: number | null
          total_games: number | null
          total_sets: number | null
          total_variants: number | null
          variants_table_size: string | null
        }
        Relationships: []
      }
      popular_cards: {
        Row: {
          avg_price_cents: number | null
          game_name: string | null
          id: string | null
          image_url: string | null
          last_price_update: string | null
          max_price_cents: number | null
          name: string | null
          rarity: string | null
          set_name: string | null
          variant_count: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      grant_role_by_email: {
        Args: { p_email: string; p_role: string }
        Returns: undefined
      }
      gtrgm_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_decompress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_options: {
        Args: { "": unknown }
        Returns: undefined
      }
      gtrgm_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      has_admin_users: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      has_role: {
        Args: { r: string; uid: string }
        Returns: boolean
      }
      normalize_condition: {
        Args: { api_condition: string }
        Returns: Database["public"]["Enums"]["card_condition_enum"]
      }
      normalize_printing: {
        Args: { api_printing: string }
        Returns: Database["public"]["Enums"]["card_printing_enum"]
      }
      search_cards: {
        Args: {
          game_slug?: string
          limit_count?: number
          search_query: string
          set_code?: string
        }
        Returns: {
          game_name: string
          id: string
          image_url: string
          name: string
          rank: number
          rarity: string
          set_name: string
        }[]
      }
      set_limit: {
        Args: { "": number }
        Returns: number
      }
      show_limit: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      show_trgm: {
        Args: { "": string }
        Returns: string[]
      }
    }
    Enums: {
      card_condition_enum:
        | "mint"
        | "near_mint"
        | "excellent"
        | "good"
        | "light_played"
        | "played"
        | "poor"
        | "lightly_played"
        | "moderately_played"
        | "heavily_played"
        | "damaged"
      card_printing_enum:
        | "normal"
        | "foil"
        | "etched"
        | "borderless"
        | "extended"
        | "showcase"
        | "holo"
        | "reverse_holo"
        | "promo"
        | "first_edition"
      item_type_enum:
        | "card"
        | "booster_pack"
        | "theme_deck"
        | "starter_deck"
        | "bundle"
        | "collection"
        | "other"
      sync_job_status_enum: "queued" | "running" | "completed" | "failed"
      sync_job_type_enum: "games" | "sets" | "cards" | "refresh_variants"
      sync_status_enum: "pending" | "syncing" | "completed" | "failed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      card_condition_enum: [
        "mint",
        "near_mint",
        "excellent",
        "good",
        "light_played",
        "played",
        "poor",
        "lightly_played",
        "moderately_played",
        "heavily_played",
        "damaged",
      ],
      card_printing_enum: [
        "normal",
        "foil",
        "etched",
        "borderless",
        "extended",
        "showcase",
        "holo",
        "reverse_holo",
        "promo",
        "first_edition",
      ],
      item_type_enum: [
        "card",
        "booster_pack",
        "theme_deck",
        "starter_deck",
        "bundle",
        "collection",
        "other",
      ],
      sync_job_status_enum: ["queued", "running", "completed", "failed"],
      sync_job_type_enum: ["games", "sets", "cards", "refresh_variants"],
      sync_status_enum: ["pending", "syncing", "completed", "failed"],
    },
  },
} as const
