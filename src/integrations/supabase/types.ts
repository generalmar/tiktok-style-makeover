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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      answers: {
        Row: {
          choice: string
          created_at: string
          id: string
          is_correct: boolean | null
          round_id: string
          session_id: string
          viewer_display_name: string | null
          viewer_handle: string
        }
        Insert: {
          choice: string
          created_at?: string
          id?: string
          is_correct?: boolean | null
          round_id: string
          session_id: string
          viewer_display_name?: string | null
          viewer_handle: string
        }
        Update: {
          choice?: string
          created_at?: string
          id?: string
          is_correct?: boolean | null
          round_id?: string
          session_id?: string
          viewer_display_name?: string | null
          viewer_handle?: string
        }
        Relationships: [
          {
            foreignKeyName: "answers_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answers_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      questions: {
        Row: {
          account_id: string | null
          category: string
          choices: Json
          correct_choice: string
          created_at: string
          difficulty: Database["public"]["Enums"]["difficulty"]
          id: string
          owner_id: string | null
          source: string
          text: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          category?: string
          choices: Json
          correct_choice: string
          created_at?: string
          difficulty?: Database["public"]["Enums"]["difficulty"]
          id?: string
          owner_id?: string | null
          source?: string
          text: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          category?: string
          choices?: Json
          correct_choice?: string
          created_at?: string
          difficulty?: Database["public"]["Enums"]["difficulty"]
          id?: string
          owner_id?: string | null
          source?: string
          text?: string
          updated_at?: string
        }
        Relationships: []
      }
      rounds: {
        Row: {
          closes_at: string | null
          created_at: string
          duration_seconds: number
          id: string
          question_id: string
          resolved_at: string | null
          session_id: string
          started_at: string | null
          status: Database["public"]["Enums"]["round_status"]
        }
        Insert: {
          closes_at?: string | null
          created_at?: string
          duration_seconds?: number
          id?: string
          question_id: string
          resolved_at?: string | null
          session_id: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["round_status"]
        }
        Update: {
          closes_at?: string | null
          created_at?: string
          duration_seconds?: number
          id?: string
          question_id?: string
          resolved_at?: string | null
          session_id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["round_status"]
        }
        Relationships: [
          {
            foreignKeyName: "rounds_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rounds_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_questions: {
        Row: {
          created_at: string
          id: string
          played: boolean
          position: number
          question_id: string
          session_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          played?: boolean
          position: number
          question_id: string
          session_id: string
        }
        Update: {
          created_at?: string
          id?: string
          played?: boolean
          position?: number
          question_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_questions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_questions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_scores: {
        Row: {
          answer_count: number
          correct_count: number
          id: string
          score: number
          session_id: string
          updated_at: string
          viewer_display_name: string | null
          viewer_handle: string
        }
        Insert: {
          answer_count?: number
          correct_count?: number
          id?: string
          score?: number
          session_id: string
          updated_at?: string
          viewer_display_name?: string | null
          viewer_handle: string
        }
        Update: {
          answer_count?: number
          correct_count?: number
          id?: string
          score?: number
          session_id?: string
          updated_at?: string
          viewer_display_name?: string | null
          viewer_handle?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_scores_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          account_id: string | null
          auto_advance: boolean
          created_at: string
          finished_at: string | null
          id: string
          name: string
          overlay_token: string
          owner_id: string | null
          question_duration_seconds: number
          status: Database["public"]["Enums"]["session_status"]
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          auto_advance?: boolean
          created_at?: string
          finished_at?: string | null
          id?: string
          name?: string
          overlay_token?: string
          owner_id?: string | null
          question_duration_seconds?: number
          status?: Database["public"]["Enums"]["session_status"]
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          auto_advance?: boolean
          created_at?: string
          finished_at?: string | null
          id?: string
          name?: string
          overlay_token?: string
          owner_id?: string | null
          question_duration_seconds?: number
          status?: Database["public"]["Enums"]["session_status"]
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "operator"
      difficulty: "easy" | "medium" | "hard"
      round_status: "idle" | "live" | "closed" | "resolved"
      session_status: "idle" | "active" | "finished"
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
      app_role: ["admin", "operator"],
      difficulty: ["easy", "medium", "hard"],
      round_status: ["idle", "live", "closed", "resolved"],
      session_status: ["idle", "active", "finished"],
    },
  },
} as const
