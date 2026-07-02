export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      clients: {
        Row: {
          brand_color: string | null
          created_at: string
          currency: string
          id: string
          is_archived: boolean
          last_refresh_at: string | null
          logo_url: string | null
          name: string
          slug: string
          timezone: string
        }
        Insert: {
          brand_color?: string | null
          created_at?: string
          currency?: string
          id?: string
          is_archived?: boolean
          last_refresh_at?: string | null
          logo_url?: string | null
          name: string
          slug: string
          timezone?: string
        }
        Update: {
          brand_color?: string | null
          created_at?: string
          currency?: string
          id?: string
          is_archived?: boolean
          last_refresh_at?: string | null
          logo_url?: string | null
          name?: string
          slug?: string
          timezone?: string
        }
        Relationships: []
      }
      dashboard_configs: {
        Row: {
          client_id: string
          config: Json
          default_date_range: string
          notes: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          client_id: string
          config?: Json
          default_date_range?: string
          notes?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          client_id?: string
          config?: Json
          default_date_range?: string
          notes?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_configs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      data_sources: {
        Row: {
          backfill_completed_at: string | null
          client_id: string
          config: Json
          created_at: string
          credential_id: string
          display_name: string
          external_id: string
          id: string
          is_active: boolean
          last_synced_at: string | null
          source: string
        }
        Insert: {
          backfill_completed_at?: string | null
          client_id: string
          config?: Json
          created_at?: string
          credential_id: string
          display_name: string
          external_id: string
          id?: string
          is_active?: boolean
          last_synced_at?: string | null
          source: string
        }
        Update: {
          backfill_completed_at?: string | null
          client_id?: string
          config?: Json
          created_at?: string
          credential_id?: string
          display_name?: string
          external_id?: string
          id?: string
          is_active?: boolean
          last_synced_at?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_sources_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_sources_credential_id_fkey"
            columns: ["credential_id"]
            isOneToOne: false
            referencedRelation: "oauth_credentials"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          client_id: string
          user_id: string
        }
        Insert: {
          client_id: string
          user_id: string
        }
        Update: {
          client_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      metrics_ga4_daily: {
        Row: {
          channel: string
          client_id: string
          data_source_id: string
          device_split: Json | null
          engaged_sessions: number
          engagement_rate: number | null
          key_events: number
          metric_date: string
          new_users: number
          sessions: number
          synced_at: string
          total_revenue: number
          total_users: number
        }
        Insert: {
          channel?: string
          client_id: string
          data_source_id: string
          device_split?: Json | null
          engaged_sessions?: number
          engagement_rate?: number | null
          key_events?: number
          metric_date: string
          new_users?: number
          sessions?: number
          synced_at?: string
          total_revenue?: number
          total_users?: number
        }
        Update: {
          channel?: string
          client_id?: string
          data_source_id?: string
          device_split?: Json | null
          engaged_sessions?: number
          engagement_rate?: number | null
          key_events?: number
          metric_date?: string
          new_users?: number
          sessions?: number
          synced_at?: string
          total_revenue?: number
          total_users?: number
        }
        Relationships: [
          {
            foreignKeyName: "metrics_ga4_daily_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metrics_ga4_daily_data_source_id_fkey"
            columns: ["data_source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      metrics_ga4_pages: {
        Row: {
          client_id: string
          data_source_id: string
          key_events: number
          landing_page: string
          metric_date: string
          sessions: number
        }
        Insert: {
          client_id: string
          data_source_id: string
          key_events?: number
          landing_page: string
          metric_date: string
          sessions?: number
        }
        Update: {
          client_id?: string
          data_source_id?: string
          key_events?: number
          landing_page?: string
          metric_date?: string
          sessions?: number
        }
        Relationships: [
          {
            foreignKeyName: "metrics_ga4_pages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metrics_ga4_pages_data_source_id_fkey"
            columns: ["data_source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      metrics_gads_daily: {
        Row: {
          campaign_id: string
          campaign_name: string | null
          clicks: number
          client_id: string
          conversions: number
          conversions_value: number
          cost: number
          data_source_id: string
          impressions: number
          metric_date: string
          synced_at: string
        }
        Insert: {
          campaign_id?: string
          campaign_name?: string | null
          clicks?: number
          client_id: string
          conversions?: number
          conversions_value?: number
          cost?: number
          data_source_id: string
          impressions?: number
          metric_date: string
          synced_at?: string
        }
        Update: {
          campaign_id?: string
          campaign_name?: string | null
          clicks?: number
          client_id?: string
          conversions?: number
          conversions_value?: number
          cost?: number
          data_source_id?: string
          impressions?: number
          metric_date?: string
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "metrics_gads_daily_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metrics_gads_daily_data_source_id_fkey"
            columns: ["data_source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      metrics_gsc_daily: {
        Row: {
          clicks: number
          client_id: string
          ctr: number | null
          data_source_id: string
          device_split: Json | null
          impressions: number
          is_final: boolean
          metric_date: string
          position: number | null
          synced_at: string
        }
        Insert: {
          clicks?: number
          client_id: string
          ctr?: number | null
          data_source_id: string
          device_split?: Json | null
          impressions?: number
          is_final?: boolean
          metric_date: string
          position?: number | null
          synced_at?: string
        }
        Update: {
          clicks?: number
          client_id?: string
          ctr?: number | null
          data_source_id?: string
          device_split?: Json | null
          impressions?: number
          is_final?: boolean
          metric_date?: string
          position?: number | null
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "metrics_gsc_daily_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metrics_gsc_daily_data_source_id_fkey"
            columns: ["data_source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      metrics_gsc_pages: {
        Row: {
          clicks: number
          client_id: string
          data_source_id: string
          impressions: number
          page: string
          position: number | null
          week_start: string
        }
        Insert: {
          clicks?: number
          client_id: string
          data_source_id: string
          impressions?: number
          page: string
          position?: number | null
          week_start: string
        }
        Update: {
          clicks?: number
          client_id?: string
          data_source_id?: string
          impressions?: number
          page?: string
          position?: number | null
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "metrics_gsc_pages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metrics_gsc_pages_data_source_id_fkey"
            columns: ["data_source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      metrics_gsc_queries: {
        Row: {
          clicks: number
          client_id: string
          data_source_id: string
          impressions: number
          position: number | null
          query: string
          week_start: string
        }
        Insert: {
          clicks?: number
          client_id: string
          data_source_id: string
          impressions?: number
          position?: number | null
          query: string
          week_start: string
        }
        Update: {
          clicks?: number
          client_id?: string
          data_source_id?: string
          impressions?: number
          position?: number | null
          query?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "metrics_gsc_queries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metrics_gsc_queries_data_source_id_fkey"
            columns: ["data_source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      metrics_meta_daily: {
        Row: {
          actions: Json | null
          campaign_id: string
          campaign_name: string | null
          clicks: number
          client_id: string
          conversions: number
          cpc: number | null
          cpm: number | null
          ctr: number | null
          data_source_id: string
          impressions: number
          metric_date: string
          reach: number | null
          spend: number
          synced_at: string
        }
        Insert: {
          actions?: Json | null
          campaign_id?: string
          campaign_name?: string | null
          clicks?: number
          client_id: string
          conversions?: number
          cpc?: number | null
          cpm?: number | null
          ctr?: number | null
          data_source_id: string
          impressions?: number
          metric_date: string
          reach?: number | null
          spend?: number
          synced_at?: string
        }
        Update: {
          actions?: Json | null
          campaign_id?: string
          campaign_name?: string | null
          clicks?: number
          client_id?: string
          conversions?: number
          cpc?: number | null
          cpm?: number | null
          ctr?: number | null
          data_source_id?: string
          impressions?: number
          metric_date?: string
          reach?: number | null
          spend?: number
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "metrics_meta_daily_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metrics_meta_daily_data_source_id_fkey"
            columns: ["data_source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_credentials: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          label: string
          last_refreshed_at: string | null
          provider: string
          scopes: string[]
          status: Database["public"]["Enums"]["credential_status"]
          vault_secret_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          label: string
          last_refreshed_at?: string | null
          provider: string
          scopes?: string[]
          status?: Database["public"]["Enums"]["credential_status"]
          vault_secret_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          label?: string
          last_refreshed_at?: string | null
          provider?: string
          scopes?: string[]
          status?: Database["public"]["Enums"]["credential_status"]
          vault_secret_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      sync_runs: {
        Row: {
          client_id: string
          data_source_id: string
          error_code: string | null
          error_message: string | null
          finished_at: string | null
          id: string
          rows_upserted: number | null
          started_at: string | null
          status: Database["public"]["Enums"]["sync_status"]
          telemetry: Json | null
          trigger: string
          window_end: string
          window_start: string
        }
        Insert: {
          client_id: string
          data_source_id: string
          error_code?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          rows_upserted?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["sync_status"]
          telemetry?: Json | null
          trigger: string
          window_end: string
          window_start: string
        }
        Update: {
          client_id?: string
          data_source_id?: string
          error_code?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          rows_upserted?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["sync_status"]
          telemetry?: Json | null
          trigger?: string
          window_end?: string
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_runs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_runs_data_source_id_fkey"
            columns: ["data_source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      app_role: "super_admin" | "admin" | "client_viewer"
      credential_status: "active" | "needs_reauth" | "revoked"
      sync_status: "queued" | "running" | "success" | "error"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  vault: {
    Tables: {
      secrets: {
        Row: {
          created_at: string
          description: string
          id: string
          key_id: string | null
          name: string | null
          nonce: string | null
          secret: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          key_id?: string | null
          name?: string | null
          nonce?: string | null
          secret: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          key_id?: string | null
          name?: string | null
          nonce?: string | null
          secret?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      decrypted_secrets: {
        Row: {
          created_at: string | null
          decrypted_secret: string | null
          description: string | null
          id: string | null
          key_id: string | null
          name: string | null
          nonce: string | null
          secret: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          decrypted_secret?: never
          description?: string | null
          id?: string | null
          key_id?: string | null
          name?: string | null
          nonce?: string | null
          secret?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          decrypted_secret?: never
          description?: string | null
          id?: string | null
          key_id?: string | null
          name?: string | null
          nonce?: string | null
          secret?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _crypto_aead_det_decrypt: {
        Args: {
          additional: string
          context?: string
          key_id: number
          message: string
          nonce?: string
        }
        Returns: string
      }
      _crypto_aead_det_encrypt: {
        Args: {
          additional: string
          context?: string
          key_id: number
          message: string
          nonce?: string
        }
        Returns: string
      }
      _crypto_aead_det_noncegen: { Args: never; Returns: string }
      create_secret: {
        Args: {
          new_description?: string
          new_key_id?: string
          new_name?: string
          new_secret: string
        }
        Returns: string
      }
      update_secret: {
        Args: {
          new_description?: string
          new_key_id?: string
          new_name?: string
          new_secret?: string
          secret_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["super_admin", "admin", "client_viewer"],
      credential_status: ["active", "needs_reauth", "revoked"],
      sync_status: ["queued", "running", "success", "error"],
    },
  },
  vault: {
    Enums: {},
  },
} as const

