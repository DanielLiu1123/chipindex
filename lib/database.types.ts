export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.5'
  }
  public: {
    Tables: {
      buy_in: {
        Row: {
          amount: number
          created_at: string
          deleted_at: string | null
          id: string
          player_id: string
          session_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          deleted_at?: string | null
          id?: string
          player_id: string
          session_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          deleted_at?: string | null
          id?: string
          player_id?: string
          session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'buy_in_player_id_fkey'
            columns: ['player_id']
            isOneToOne: false
            referencedRelation: 'player'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'buy_in_session_id_fkey'
            columns: ['session_id']
            isOneToOne: false
            referencedRelation: 'session'
            referencedColumns: ['id']
          },
        ]
      }
      group: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      group_player: {
        Row: {
          created_at: string
          deleted_at: string | null
          group_id: string
          id: string
          player_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          group_id: string
          id?: string
          player_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          group_id?: string
          id?: string
          player_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      player: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      session: {
        Row: {
          buy_in_unit: number | null
          created_at: string
          date: string
          deleted_at: string | null
          description: string | null
          ended_at: string | null
          exchange_rate: number | null
          group_id: string
          id: string
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          buy_in_unit?: number | null
          created_at?: string
          date: string
          deleted_at?: string | null
          description?: string | null
          ended_at?: string | null
          exchange_rate?: number | null
          group_id: string
          id?: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          buy_in_unit?: number | null
          created_at?: string
          date?: string
          deleted_at?: string | null
          description?: string | null
          ended_at?: string | null
          exchange_rate?: number | null
          group_id?: string
          id?: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      session_participant: {
        Row: {
          created_at: string
          deleted_at: string | null
          final_chips: number | null
          id: string
          player_id: string
          session_id: string
          settled_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          final_chips?: number | null
          id?: string
          player_id: string
          session_id: string
          settled_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          final_chips?: number | null
          id?: string
          player_id?: string
          session_id?: string
          settled_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'session_participant_player_id_fkey'
            columns: ['player_id']
            isOneToOne: false
            referencedRelation: 'player'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'session_participant_session_id_fkey'
            columns: ['session_id']
            isOneToOne: false
            referencedRelation: 'session'
            referencedColumns: ['id']
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
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Tables<TableName extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][TableName]['Row']

export type TablesInsert<TableName extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][TableName]['Insert']

export type TablesUpdate<TableName extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][TableName]['Update']
