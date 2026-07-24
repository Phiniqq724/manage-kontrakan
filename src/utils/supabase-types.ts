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
      changelogs: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "changelogs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "changelogs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      event_votes: {
        Row: {
          created_at: string
          event_id: string
          id: string
          is_attending: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          is_attending: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          is_attending?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_votes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          creator_id: string
          event_time: string
          id: string
          location: string
          modified_at: string
          name: string
        }
        Insert: {
          created_at?: string
          creator_id: string
          event_time: string
          id?: string
          location: string
          modified_at?: string
          name: string
        }
        Update: {
          created_at?: string
          creator_id?: string
          event_time?: string
          id?: string
          location?: string
          modified_at?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      guests: {
        Row: {
          activity: string | null
          check_in: string
          check_out: string | null
          created_at: string | null
          id: string
          invited_by: string | null
          modified_at: string | null
          name: string
          phone: string | null
        }
        Insert: {
          activity?: string | null
          check_in: string
          check_out?: string | null
          created_at?: string | null
          id?: string
          invited_by?: string | null
          modified_at?: string | null
          name: string
          phone?: string | null
        }
        Update: {
          activity?: string | null
          check_in?: string
          check_out?: string | null
          created_at?: string | null
          id?: string
          invited_by?: string | null
          modified_at?: string | null
          name?: string
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guests_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guests_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      kamar: {
        Row: {
          description: string | null
          id: string
          room_code: string
          user_id: string | null
        }
        Insert: {
          description?: string | null
          id?: string
          room_code: string
          user_id?: string | null
        }
        Update: {
          description?: string | null
          id?: string
          room_code?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kamar_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kamar_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      linked_accounts: {
        Row: {
          created_at: string
          id: string
          linked_user_id: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          linked_user_id: string
          owner_id: string
        }
        Update: {
          created_at?: string
          id?: string
          linked_user_id?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "linked_accounts_linked_user_id_fkey"
            columns: ["linked_user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "linked_accounts_linked_user_id_fkey"
            columns: ["linked_user_id"]
            isOneToOne: true
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "linked_accounts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "linked_accounts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: true
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          account_holder: string | null
          account_number: string | null
          created_at: string
          id: string
          modified_at: string
          provider_name: string
          qris_image_url: string | null
          type: string
          user_id: string
        }
        Insert: {
          account_holder?: string | null
          account_number?: string | null
          created_at?: string
          id?: string
          modified_at?: string
          provider_name: string
          qris_image_url?: string | null
          type: string
          user_id: string
        }
        Update: {
          account_holder?: string | null
          account_number?: string | null
          created_at?: string
          id?: string
          modified_at?: string
          provider_name?: string
          qris_image_url?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_methods_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number | null
          created_at: string | null
          docs: string | null
          due_date: string | null
          id: string
          modified_at: string | null
          paid_at: string | null
          paid_by: string | null
          period: string
          status: string
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          docs?: string | null
          due_date?: string | null
          id?: string
          modified_at?: string | null
          paid_at?: string | null
          paid_by?: string | null
          period: string
          status?: string
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          docs?: string | null
          due_date?: string | null
          id?: string
          modified_at?: string | null
          paid_at?: string | null
          paid_by?: string | null
          period?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      piket_requests: {
        Row: {
          assign_to: string | null
          created_at: string | null
          id: string
          modified_at: string | null
          piket_id: string | null
          reason: string | null
          status: string
        }
        Insert: {
          assign_to?: string | null
          created_at?: string | null
          id?: string
          modified_at?: string | null
          piket_id?: string | null
          reason?: string | null
          status?: string
        }
        Update: {
          assign_to?: string | null
          created_at?: string | null
          id?: string
          modified_at?: string | null
          piket_id?: string | null
          reason?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "piket_requests_assign_to_fkey"
            columns: ["assign_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "piket_requests_assign_to_fkey"
            columns: ["assign_to"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "piket_requests_piket_id_fkey"
            columns: ["piket_id"]
            isOneToOne: false
            referencedRelation: "pikets"
            referencedColumns: ["id"]
          },
        ]
      }
      pikets: {
        Row: {
          assign_to: string | null
          created_at: string | null
          day: string
          docs: string | null
          finished: boolean | null
          id: string
          modified_at: string | null
          status: string
        }
        Insert: {
          assign_to?: string | null
          created_at?: string | null
          day: string
          docs?: string | null
          finished?: boolean | null
          id?: string
          modified_at?: string | null
          status?: string
        }
        Update: {
          assign_to?: string | null
          created_at?: string | null
          day?: string
          docs?: string | null
          finished?: boolean | null
          id?: string
          modified_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "pikets_assign_to_fkey"
            columns: ["assign_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pikets_assign_to_fkey"
            columns: ["assign_to"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      receipts: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string | null
          docs: string
          id: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          created_by?: string | null
          docs: string
          id?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          docs?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          docs: string | null
          id: string
          modified_at: string | null
          suspect: string | null
          title: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          docs?: string | null
          id?: string
          modified_at?: string | null
          suspect?: string | null
          title: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          docs?: string | null
          id?: string
          modified_at?: string | null
          suspect?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_suspect_fkey"
            columns: ["suspect"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_suspect_fkey"
            columns: ["suspect"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      request_votes: {
        Row: {
          created_at: string
          id: string
          request_id: string
          user_id: string
          vote_value: number
        }
        Insert: {
          created_at?: string
          id?: string
          request_id: string
          user_id: string
          vote_value: number
        }
        Update: {
          created_at?: string
          id?: string
          request_id?: string
          user_id?: string
          vote_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "request_votes_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      requests: {
        Row: {
          created_at: string
          creator_id: string
          description: string | null
          id: string
          modified_at: string
          title: string
        }
        Insert: {
          created_at?: string
          creator_id: string
          description?: string | null
          id?: string
          modified_at?: string
          title: string
        }
        Update: {
          created_at?: string
          creator_id?: string
          description?: string | null
          id?: string
          modified_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "requests_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      rule_request_votes: {
        Row: {
          created_at: string
          id: string
          rule_request_id: string
          vote: string
          voter_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          rule_request_id: string
          vote: string
          voter_id: string
        }
        Update: {
          created_at?: string
          id?: string
          rule_request_id?: string
          vote?: string
          voter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rule_request_votes_rule_request_id_fkey"
            columns: ["rule_request_id"]
            isOneToOne: false
            referencedRelation: "rule_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rule_request_votes_voter_id_fkey"
            columns: ["voter_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rule_request_votes_voter_id_fkey"
            columns: ["voter_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      rule_requests: {
        Row: {
          assign_by: string | null
          created_at: string | null
          id: string
          modified_at: string | null
          priority: string
          rules: string
          status: string
        }
        Insert: {
          assign_by?: string | null
          created_at?: string | null
          id?: string
          modified_at?: string | null
          priority?: string
          rules: string
          status?: string
        }
        Update: {
          assign_by?: string | null
          created_at?: string | null
          id?: string
          modified_at?: string | null
          priority?: string
          rules?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "rule_requests_assign_by_fkey"
            columns: ["assign_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rule_requests_assign_by_fkey"
            columns: ["assign_by"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      rules: {
        Row: {
          assign_by: string | null
          created_at: string | null
          id: string
          modified_at: string | null
          priority: string
          rules: string
        }
        Insert: {
          assign_by?: string | null
          created_at?: string | null
          id?: string
          modified_at?: string | null
          priority?: string
          rules: string
        }
        Update: {
          assign_by?: string | null
          created_at?: string | null
          id?: string
          modified_at?: string | null
          priority?: string
          rules?: string
        }
        Relationships: [
          {
            foreignKeyName: "rules_assign_by_fkey"
            columns: ["assign_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rules_assign_by_fkey"
            columns: ["assign_by"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      split_bill_participants: {
        Row: {
          amount_due: number
          created_at: string
          display_name: string | null
          id: string
          modified_at: string
          paid_at: string | null
          payment_method_id: string | null
          payment_status: string
          proof_of_payment_url: string | null
          split_bill_id: string
          user_id: string | null
        }
        Insert: {
          amount_due: number
          created_at?: string
          display_name?: string | null
          id?: string
          modified_at?: string
          paid_at?: string | null
          payment_method_id?: string | null
          payment_status?: string
          proof_of_payment_url?: string | null
          split_bill_id: string
          user_id?: string | null
        }
        Update: {
          amount_due?: number
          created_at?: string
          display_name?: string | null
          id?: string
          modified_at?: string
          paid_at?: string | null
          payment_method_id?: string | null
          payment_status?: string
          proof_of_payment_url?: string | null
          split_bill_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "split_bill_participants_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "split_bill_participants_split_bill_id_fkey"
            columns: ["split_bill_id"]
            isOneToOne: false
            referencedRelation: "split_bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "split_bill_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "split_bill_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      split_bill_payment_methods: {
        Row: {
          created_at: string
          id: string
          payment_method_id: string
          split_bill_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          payment_method_id: string
          split_bill_id: string
        }
        Update: {
          created_at?: string
          id?: string
          payment_method_id?: string
          split_bill_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "split_bill_payment_methods_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "split_bill_payment_methods_split_bill_id_fkey"
            columns: ["split_bill_id"]
            isOneToOne: false
            referencedRelation: "split_bills"
            referencedColumns: ["id"]
          },
        ]
      }
      split_bills: {
        Row: {
          created_at: string
          creator_id: string
          id: string
          modified_at: string
          ppn_included_in_price: boolean
          split_type: string
          subtotal: number
          tax_percentage: number
          title: string
          total_amount: number
        }
        Insert: {
          created_at?: string
          creator_id: string
          id?: string
          modified_at?: string
          ppn_included_in_price?: boolean
          split_type?: string
          subtotal: number
          tax_percentage?: number
          title: string
          total_amount: number
        }
        Update: {
          created_at?: string
          creator_id?: string
          id?: string
          modified_at?: string
          ppn_included_in_price?: boolean
          split_type?: string
          subtotal?: number
          tax_percentage?: number
          title?: string
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "split_bills_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "split_bills_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          contact: string | null
          created_at: string | null
          email: string
          fullname: string
          id: string
          modified_at: string | null
          password: string
          push_token: string | null
          role: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          contact?: string | null
          created_at?: string | null
          email: string
          fullname: string
          id?: string
          modified_at?: string | null
          password: string
          push_token?: string | null
          role?: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          contact?: string | null
          created_at?: string | null
          email?: string
          fullname?: string
          id?: string
          modified_at?: string | null
          password?: string
          push_token?: string | null
          role?: string
          username?: string
        }
        Relationships: []
      }
    }
    Views: {
      admin_contact: {
        Row: {
          contact: string | null
        }
        Relationships: []
      }
      users_public: {
        Row: {
          fullname: string | null
          id: string | null
          role: string | null
        }
        Insert: {
          fullname?: string | null
          id?: string | null
          role?: string | null
        }
        Update: {
          fullname?: string | null
          id?: string | null
          role?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      generate_next_piket_schedule: { Args: never; Returns: undefined }
      get_rule_request_vote_tally: {
        Args: { p_rule_request_id: string }
        Returns: {
          approve_count: number
          decline_count: number
          total_votes: number
        }[]
      }
      get_rule_request_voters: {
        Args: { p_rule_request_id: string }
        Returns: {
          voter_id: string
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      is_sup_member: { Args: never; Returns: boolean }
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
  public: {
    Enums: {},
  },
} as const
