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
      appointments: {
        Row: {
          branch_id: string
          cancellation_reason: string | null
          cancelled_by: string | null
          created_at: string | null
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          employee_id: string
          end_time: string
          id: string
          notes: string | null
          organization_id: string
          service_id: string
          source: Database["public"]["Enums"]["appointment_source"]
          start_time: string
          status: Database["public"]["Enums"]["appointment_status"] | null
          transaction_id: string | null
          updated_at: string | null
        }
        Insert: {
          branch_id: string
          cancellation_reason?: string | null
          cancelled_by?: string | null
          created_at?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          employee_id: string
          end_time: string
          id?: string
          notes?: string | null
          organization_id: string
          service_id: string
          source?: Database["public"]["Enums"]["appointment_source"]
          start_time: string
          status?: Database["public"]["Enums"]["appointment_status"] | null
          transaction_id?: string | null
          updated_at?: string | null
        }
        Update: {
          branch_id?: string
          cancellation_reason?: string | null
          cancelled_by?: string | null
          created_at?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          employee_id?: string
          end_time?: string
          id?: string
          notes?: string | null
          organization_id?: string
          service_id?: string
          source?: Database["public"]["Enums"]["appointment_source"]
          start_time?: string
          status?: Database["public"]["Enums"]["appointment_status"] | null
          transaction_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          checksum: string | null
          context: Json | null
          id: number
          ip_address: unknown
          logged_at: string
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          checksum?: string | null
          context?: Json | null
          id?: never
          ip_address?: unknown
          logged_at?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          checksum?: string | null
          context?: Json | null
          id?: never
          ip_address?: unknown
          logged_at?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      branches: {
        Row: {
          address: string | null
          code: string
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          organization_id: string
          phone: string | null
          settings: Json | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          code: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          organization_id: string
          phone?: string | null
          settings?: Json | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          code?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string
          phone?: string | null
          settings?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          organization_id: string
          parent_id: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          organization_id: string
          parent_id?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string
          parent_id?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      client_org: {
        Row: {
          billing_data: Json
          billing_email: string | null
          billing_name: string | null
          billing_phone: string | null
          client_id: string
          created_at: string
          document_number: string | null
          document_type: string | null
          is_anonymous_template: boolean
          organization_id: string
          status: string
          updated_at: string
        }
        Insert: {
          billing_data?: Json
          billing_email?: string | null
          billing_name?: string | null
          billing_phone?: string | null
          client_id: string
          created_at?: string
          document_number?: string | null
          document_type?: string | null
          is_anonymous_template?: boolean
          organization_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          billing_data?: Json
          billing_email?: string | null
          billing_name?: string | null
          billing_phone?: string | null
          client_id?: string
          created_at?: string
          document_number?: string | null
          document_type?: string | null
          is_anonymous_template?: boolean
          organization_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_org_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_org_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_org_billing_history: {
        Row: {
          billing_email: string | null
          billing_name: string | null
          billing_phone: string | null
          change_reason: string | null
          changed_at: string
          changed_by: string | null
          client_id: string
          created_at: string
          document_number: string | null
          document_type: string
          id: string
          is_active_version: boolean
          organization_id: string
        }
        Insert: {
          billing_email?: string | null
          billing_name?: string | null
          billing_phone?: string | null
          change_reason?: string | null
          changed_at?: string
          changed_by?: string | null
          client_id: string
          created_at?: string
          document_number?: string | null
          document_type: string
          id?: string
          is_active_version?: boolean
          organization_id: string
        }
        Update: {
          billing_email?: string | null
          billing_name?: string | null
          billing_phone?: string | null
          change_reason?: string | null
          changed_at?: string
          changed_by?: string | null
          client_id?: string
          created_at?: string
          document_number?: string | null
          document_type?: string
          id?: string
          is_active_version?: boolean
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_org_billing_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_org_billing_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_org_billing_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          billing_data: Json
          created_at: string
          email: string | null
          first_name: string
          id: string
          last_name: string | null
          phone: string | null
          preferences: Json
          updated_at: string
          user_id: string | null
        }
        Insert: {
          billing_data?: Json
          created_at?: string
          email?: string | null
          first_name: string
          id?: string
          last_name?: string | null
          phone?: string | null
          preferences?: Json
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          billing_data?: Json
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string | null
          phone?: string | null
          preferences?: Json
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      employee_branch_assignments: {
        Row: {
          branch_id: string
          can_manage_inventory: boolean | null
          can_override_prices: boolean | null
          id: string
          is_primary: boolean | null
          skills: Json | null
          user_id: string
        }
        Insert: {
          branch_id: string
          can_manage_inventory?: boolean | null
          can_override_prices?: boolean | null
          id?: string
          is_primary?: boolean | null
          skills?: Json | null
          user_id: string
        }
        Update: {
          branch_id?: string
          can_manage_inventory?: boolean | null
          can_override_prices?: boolean | null
          id?: string
          is_primary?: boolean | null
          skills?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_branch_assignments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_branch_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_customers: {
        Row: {
          branch_id: string | null
          created_at: string | null
          created_by: string | null
          full_name: string
          id: string
          notes: string | null
          organization_id: string
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          full_name: string
          id?: string
          notes?: string | null
          organization_id: string
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guest_customers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_customers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_customers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_adjust_batches: {
        Row: {
          branch_id: string
          created_at: string
          id: string
          idempotency_key: string
          mode: string
          note: string | null
          organization_id: string
          processed_by: string | null
          processed_count: number
          reason: string
          total_lines: number
          updated_at: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          idempotency_key: string
          mode: string
          note?: string | null
          organization_id: string
          processed_by?: string | null
          processed_count?: number
          reason: string
          total_lines: number
          updated_at?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
          idempotency_key?: string
          mode?: string
          note?: string | null
          organization_id?: string
          processed_by?: string | null
          processed_count?: number
          reason?: string
          total_lines?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_adjust_batches_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_adjust_batches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_adjust_batches_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_document_sequences: {
        Row: {
          doc_type: string
          last_value: number
          organization_id: string
          seq_year: number
          updated_at: string
        }
        Insert: {
          doc_type: string
          last_value?: number
          organization_id: string
          seq_year: number
          updated_at?: string
        }
        Update: {
          doc_type?: string
          last_value?: number
          organization_id?: string
          seq_year?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_document_sequences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          branch_id: string
          created_at: string | null
          created_by: string | null
          destination_branch_id: string | null
          id: string
          movement_type: string
          new_quantity: number
          note: string | null
          organization_id: string
          previous_quantity: number
          product_id: string
          quantity: number
          reason: string | null
          reference_code: string | null
          reference_id: string | null
          reference_type: string | null
          source_branch_id: string | null
        }
        Insert: {
          branch_id: string
          created_at?: string | null
          created_by?: string | null
          destination_branch_id?: string | null
          id?: string
          movement_type: string
          new_quantity: number
          note?: string | null
          organization_id: string
          previous_quantity: number
          product_id: string
          quantity: number
          reason?: string | null
          reference_code?: string | null
          reference_id?: string | null
          reference_type?: string | null
          source_branch_id?: string | null
        }
        Update: {
          branch_id?: string
          created_at?: string | null
          created_by?: string | null
          destination_branch_id?: string | null
          id?: string
          movement_type?: string
          new_quantity?: number
          note?: string | null
          organization_id?: string
          previous_quantity?: number
          product_id?: string
          quantity?: number
          reason?: string | null
          reference_code?: string | null
          reference_id?: string | null
          reference_type?: string | null
          source_branch_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_destination_branch_id_fkey"
            columns: ["destination_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_source_branch_id_fkey"
            columns: ["source_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_stock: {
        Row: {
          branch_id: string
          id: string
          min_stock_level: number | null
          product_id: string
          quantity: number | null
          reserved_quantity: number | null
          updated_at: string | null
        }
        Insert: {
          branch_id: string
          id?: string
          min_stock_level?: number | null
          product_id: string
          quantity?: number | null
          reserved_quantity?: number | null
          updated_at?: string | null
        }
        Update: {
          branch_id?: string
          id?: string
          min_stock_level?: number | null
          product_id?: string
          quantity?: number | null
          reserved_quantity?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_stock_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_stock_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_transfer_batch_lines: {
        Row: {
          batch_id: string
          created_at: string
          destination_new_quantity: number | null
          destination_previous_quantity: number | null
          id: string
          organization_id: string
          product_id: string
          quantity: number
          received_at: string | null
          received_by: string | null
          source_new_quantity: number | null
          source_previous_quantity: number | null
          status: string
          updated_at: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          destination_new_quantity?: number | null
          destination_previous_quantity?: number | null
          id?: string
          organization_id: string
          product_id: string
          quantity: number
          received_at?: string | null
          received_by?: string | null
          source_new_quantity?: number | null
          source_previous_quantity?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          destination_new_quantity?: number | null
          destination_previous_quantity?: number | null
          id?: string
          organization_id?: string
          product_id?: string
          quantity?: number
          received_at?: string | null
          received_by?: string | null
          source_new_quantity?: number | null
          source_previous_quantity?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_transfer_batch_lines_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "inventory_transfer_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transfer_batch_lines_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transfer_batch_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transfer_batch_lines_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_transfer_batches: {
        Row: {
          created_at: string
          destination_branch_id: string
          id: string
          idempotency_key: string
          observations: string | null
          organization_id: string
          received_at: string | null
          received_by: string | null
          reference_code: string | null
          requested_at: string
          requested_by: string | null
          source_branch_id: string
          status: string
          total_lines: number
          total_quantity: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          destination_branch_id: string
          id?: string
          idempotency_key: string
          observations?: string | null
          organization_id: string
          received_at?: string | null
          received_by?: string | null
          reference_code?: string | null
          requested_at?: string
          requested_by?: string | null
          source_branch_id: string
          status?: string
          total_lines: number
          total_quantity: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          destination_branch_id?: string
          id?: string
          idempotency_key?: string
          observations?: string | null
          organization_id?: string
          received_at?: string | null
          received_by?: string | null
          reference_code?: string | null
          requested_at?: string
          requested_by?: string | null
          source_branch_id?: string
          status?: string
          total_lines?: number
          total_quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_transfer_batches_destination_branch_id_fkey"
            columns: ["destination_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transfer_batches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transfer_batches_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transfer_batches_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transfer_batches_source_branch_id_fkey"
            columns: ["source_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_transfers: {
        Row: {
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          destination_branch_id: string
          id: string
          observations: string | null
          organization_id: string
          product_id: string
          quantity: number
          received_at: string | null
          received_by: string | null
          reference_code: string | null
          requested_at: string
          requested_by: string
          source_branch_id: string
          status: string
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          destination_branch_id: string
          id?: string
          observations?: string | null
          organization_id: string
          product_id: string
          quantity: number
          received_at?: string | null
          received_by?: string | null
          reference_code?: string | null
          requested_at?: string
          requested_by: string
          source_branch_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          destination_branch_id?: string
          id?: string
          observations?: string | null
          organization_id?: string
          product_id?: string
          quantity?: number
          received_at?: string | null
          received_by?: string | null
          reference_code?: string | null
          requested_at?: string
          requested_by?: string
          source_branch_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_transfers_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transfers_destination_branch_id_fkey"
            columns: ["destination_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transfers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transfers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transfers_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transfers_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transfers_source_branch_id_fkey"
            columns: ["source_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_progress: {
        Row: {
          current_step: string | null
          id: string
          organization_id: string | null
          progress_data: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          current_step?: string | null
          id?: string
          organization_id?: string | null
          progress_data?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          current_step?: string | null
          id?: string
          organization_id?: string | null
          progress_data?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_progress_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_subscriptions: {
        Row: {
          billing_mode: string | null
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string
          current_period_start: string | null
          id: string
          is_trial: boolean
          organization_id: string
          payment_method: string | null
          plan_id: string
          provider_subscription_id: string | null
          status: Database["public"]["Enums"]["sub_status"] | null
          trial_ends_at: string | null
          updated_at: string | null
        }
        Insert: {
          billing_mode?: string | null
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end: string
          current_period_start?: string | null
          id?: string
          is_trial?: boolean
          organization_id: string
          payment_method?: string | null
          plan_id: string
          provider_subscription_id?: string | null
          status?: Database["public"]["Enums"]["sub_status"] | null
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Update: {
          billing_mode?: string | null
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string
          current_period_start?: string | null
          id?: string
          is_trial?: boolean
          organization_id?: string
          payment_method?: string | null
          plan_id?: string
          provider_subscription_id?: string | null
          status?: Database["public"]["Enums"]["sub_status"] | null
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_business_types: {
        Row: {
          organization_id: string
          business_type: string
        }
        Insert: {
          organization_id: string
          business_type: string
        }
        Update: {
          organization_id?: string
          business_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_business_types_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_storefront_entitlements: {
        Row: {
          can_custom_colors: boolean
          can_manage: boolean
          can_publish: boolean
          can_view: boolean
          created_at: string
          max_sites: number
          organization_id: string
          template_keys: string[]
          updated_at: string
        }
        Insert: {
          can_custom_colors?: boolean
          can_manage?: boolean
          can_publish?: boolean
          can_view?: boolean
          created_at?: string
          max_sites?: number
          organization_id: string
          template_keys?: string[]
          updated_at?: string
        }
        Update: {
          can_custom_colors?: boolean
          can_manage?: boolean
          can_publish?: boolean
          can_view?: boolean
          created_at?: string
          max_sites?: number
          organization_id?: string
          template_keys?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_storefront_entitlements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_storefront_settings: {
        Row: {
          accent_color: string
          business_type: Database["public"]["Enums"]["business_type_enum"]
          color_preset_key: string
          company_description: string | null
          created_at: string
          hero_image_url: string | null
          is_published: boolean
          organization_id: string
          primary_color: string
          secondary_color: string
          template_key: string
          updated_at: string
        }
        Insert: {
          accent_color?: string
          business_type?: Database["public"]["Enums"]["business_type_enum"]
          color_preset_key?: string
          company_description?: string | null
          created_at?: string
          is_published?: boolean
          organization_id: string
          primary_color?: string
          secondary_color?: string
          template_key: string
          updated_at?: string
        }
        Update: {
          accent_color?: string
          business_type?: Database["public"]["Enums"]["business_type_enum"]
          color_preset_key?: string
          company_description?: string | null
          created_at?: string
          is_published?: boolean
          organization_id?: string
          primary_color?: string
          secondary_color?: string
          template_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_storefront_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address: string | null
          billing_data: Json | null
          country: string | null
          created_at: string | null
          currency_code: string | null
          default_receipt_format: string | null
          id: string
          is_active: boolean | null
          lodging_checkout_deadline: string | null
          lodging_late_checkout_penalty: number | null
          lodging_stay_cutoff_time: string | null
          logo_url: string | null
          name: string
          slug: string | null
          status: string | null
          timezone: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          billing_data?: Json | null
          country?: string | null
          created_at?: string | null
          currency_code?: string | null
          default_receipt_format?: string | null
          id?: string
          is_active?: boolean | null
          lodging_checkout_deadline?: string | null
          lodging_late_checkout_penalty?: number | null
          lodging_stay_cutoff_time?: string | null
          logo_url?: string | null
          name: string
          slug?: string | null
          status?: string | null
          timezone?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          billing_data?: Json | null
          country?: string | null
          created_at?: string | null
          currency_code?: string | null
          default_receipt_format?: string | null
          id?: string
          is_active?: boolean | null
          lodging_checkout_deadline?: string | null
          lodging_late_checkout_penalty?: number | null
          lodging_stay_cutoff_time?: string | null
          logo_url?: string | null
          name?: string
          slug?: string | null
          status?: string | null
          timezone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      payment_validations: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          organization_id: string
          payment_method: string | null
          receipt_filename: string
          receipt_mime_type: string | null
          receipt_storage_path: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          reviewed_by_system_user: string | null
          status: string | null
          transaction_ref: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          organization_id: string
          payment_method?: string | null
          receipt_filename: string
          receipt_mime_type?: string | null
          receipt_storage_path: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewed_by_system_user?: string | null
          status?: string | null
          transaction_ref?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          organization_id?: string
          payment_method?: string | null
          receipt_filename?: string
          receipt_mime_type?: string | null
          receipt_storage_path?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewed_by_system_user?: string | null
          status?: string | null
          transaction_ref?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_validations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_validations_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_validations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string | null
          cost_price: number | null
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          organization_id: string
          sale_price: number
          sku: string | null
          track_inventory: boolean | null
          updated_at: string | null
        }
        Insert: {
          category_id?: string | null
          cost_price?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          organization_id: string
          sale_price: number
          sku?: string | null
          track_inventory?: boolean | null
          updated_at?: string | null
        }
        Update: {
          category_id?: string | null
          cost_price?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          organization_id?: string
          sale_price?: number
          sku?: string | null
          track_inventory?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_client_map: {
        Row: {
          client_id: string
          created_at: string
          profile_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          profile_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_client_map_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_client_map_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean | null
          last_login_at: string | null
          organization_id: string | null
          phone: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          role_id: string | null
          trial_consumed_at: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          full_name: string
          id: string
          is_active?: boolean | null
          last_login_at?: string | null
          organization_id?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          role_id?: string | null
          trial_consumed_at?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean | null
          last_login_at?: string | null
          organization_id?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          role_id?: string | null
          trial_consumed_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "user_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      role_module_permissions: {
        Row: {
          can_approve: boolean
          can_assign: boolean
          can_create: boolean
          can_delete: boolean
          can_edit: boolean
          can_export: boolean
          can_manage: boolean
          can_view: boolean
          created_at: string
          id: string
          module_key: string
          role_id: string
          updated_at: string
        }
        Insert: {
          can_approve?: boolean
          can_assign?: boolean
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_export?: boolean
          can_manage?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          module_key: string
          role_id: string
          updated_at?: string
        }
        Update: {
          can_approve?: boolean
          can_assign?: boolean
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_export?: boolean
          can_manage?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          module_key?: string
          role_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_module_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "user_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          category_id: string | null
          created_at: string | null
          description: string | null
          duration_minutes: number
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          organization_id: string
          price: number
          updated_at: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          duration_minutes: number
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          organization_id: string
          price: number
          updated_at?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          duration_minutes?: number
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          organization_id?: string
          price?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "services_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          available_billing_modes: Json
          business_only: boolean
          created_at: string | null
          description: string
          feature_advanced_reports: boolean | null
          feature_api_access: boolean | null
          feature_forensic_export: boolean | null
          feature_inventory_transfer: boolean | null
          feature_manager_role: boolean | null
          feature_multi_branch: boolean | null
          feature_white_label: boolean | null
          features: Json
          id: string
          is_active: boolean | null
          limits: Json
          max_branches: number
          max_storage_mb: number | null
          max_users: number
          name: string
          permissions: Json
          price_monthly: number
          price_yearly: number
          resume: string
          slug: string
          trial: boolean
          trial_duration: number | null
        }
        Insert: {
          available_billing_modes?: Json
          business_only?: boolean
          created_at?: string | null
          description?: string
          feature_advanced_reports?: boolean | null
          feature_api_access?: boolean | null
          feature_forensic_export?: boolean | null
          feature_inventory_transfer?: boolean | null
          feature_manager_role?: boolean | null
          feature_multi_branch?: boolean | null
          feature_white_label?: boolean | null
          features?: Json
          id?: string
          is_active?: boolean | null
          limits?: Json
          max_branches?: number
          max_storage_mb?: number | null
          max_users?: number
          name: string
          permissions?: Json
          price_monthly: number
          price_yearly: number
          resume?: string
          slug: string
          trial?: boolean
          trial_duration?: number | null
        }
        Update: {
          available_billing_modes?: Json
          business_only?: boolean
          created_at?: string | null
          description?: string
          feature_advanced_reports?: boolean | null
          feature_api_access?: boolean | null
          feature_forensic_export?: boolean | null
          feature_inventory_transfer?: boolean | null
          feature_manager_role?: boolean | null
          feature_multi_branch?: boolean | null
          feature_white_label?: boolean | null
          features?: Json
          id?: string
          is_active?: boolean | null
          limits?: Json
          max_branches?: number
          max_storage_mb?: number | null
          max_users?: number
          name?: string
          permissions?: Json
          price_monthly?: number
          price_yearly?: number
          resume?: string
          slug?: string
          trial?: boolean
          trial_duration?: number | null
        }
        Relationships: []
      }
      system_role_module_permissions: {
        Row: {
          can_approve: boolean
          can_assign: boolean
          can_create: boolean
          can_delete: boolean
          can_edit: boolean
          can_export: boolean
          can_manage: boolean
          can_view: boolean
          created_at: string
          id: string
          module_key: string
          system_role: string
          updated_at: string
        }
        Insert: {
          can_approve?: boolean
          can_assign?: boolean
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_export?: boolean
          can_manage?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          module_key: string
          system_role: string
          updated_at?: string
        }
        Update: {
          can_approve?: boolean
          can_assign?: boolean
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_export?: boolean
          can_manage?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          module_key?: string
          system_role?: string
          updated_at?: string
        }
        Relationships: []
      }
      system_users: {
        Row: {
          created_at: string
          created_by: string | null
          email: string | null
          full_name: string | null
          is_active: boolean
          permissions: Json
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name?: string | null
          is_active?: boolean
          permissions?: Json
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name?: string | null
          is_active?: boolean
          permissions?: Json
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      transaction_items: {
        Row: {
          appointment_id: string | null
          id: string
          item_type: string
          product_id: string | null
          quantity: number
          service_id: string | null
          snapshot_data: Json | null
          subtotal: number
          transaction_id: string
          unit_price: number
        }
        Insert: {
          appointment_id?: string | null
          id?: string
          item_type: string
          product_id?: string | null
          quantity: number
          service_id?: string | null
          snapshot_data?: Json | null
          subtotal: number
          transaction_id: string
          unit_price: number
        }
        Update: {
          appointment_id?: string | null
          id?: string
          item_type?: string
          product_id?: string | null
          quantity?: number
          service_id?: string | null
          snapshot_data?: Json | null
          subtotal?: number
          transaction_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "transaction_items_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_items_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          branch_id: string
          created_at: string | null
          customer_id: string | null
          discount_amount: number | null
          employee_id: string
          final_amount: number
          id: string
          invoice_number: number
          organization_id: string
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          refund_reason: string | null
          status: string | null
          tax_amount: number | null
          total_amount: number
          type: Database["public"]["Enums"]["transaction_type"] | null
        }
        Insert: {
          branch_id: string
          created_at?: string | null
          customer_id?: string | null
          discount_amount?: number | null
          employee_id: string
          final_amount: number
          id?: string
          invoice_number?: number
          organization_id: string
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          refund_reason?: string | null
          status?: string | null
          tax_amount?: number | null
          total_amount: number
          type?: Database["public"]["Enums"]["transaction_type"] | null
        }
        Update: {
          branch_id?: string
          created_at?: string | null
          customer_id?: string | null
          discount_amount?: number | null
          employee_id?: string
          final_amount?: number
          id?: string
          invoice_number?: number
          organization_id?: string
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          refund_reason?: string | null
          status?: string | null
          tax_amount?: number | null
          total_amount?: number
          type?: Database["public"]["Enums"]["transaction_type"] | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          code: Database["public"]["Enums"]["user_role"]
          created_at: string
          description: string
          id: string
          is_active: boolean
          is_system: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code: Database["public"]["Enums"]["user_role"]
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          code?: Database["public"]["Enums"]["user_role"]
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      rooms: {
        Row: {
          base_price: number
          branch_id: string
          category_id: string
          created_at: string | null
          floor: number | null
          id: string
          is_active: boolean | null
          notes: string | null
          organization_id: string
          room_number: string
          status: Database["public"]["Enums"]["room_status"]
          updated_at: string | null
        }
        Insert: {
          base_price?: number
          branch_id: string
          category_id: string
          created_at?: string | null
          floor?: number | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          organization_id: string
          room_number: string
          status?: Database["public"]["Enums"]["room_status"]
          updated_at?: string | null
        }
        Update: {
          base_price?: number
          branch_id?: string
          category_id?: string
          created_at?: string | null
          floor?: number | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          organization_id?: string
          room_number?: string
          status?: Database["public"]["Enums"]["room_status"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rooms_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rooms_category_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rooms_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          actual_check_in_at: string | null
          actual_check_out_at: string | null
          branch_id: string
          cancelled_at: string | null
          cancelled_by: string | null
          check_in: string
          check_out: string
          created_at: string | null
          created_by: string
          extended_from_check_out: string | null
          extension_notes: string | null
          id: string
          is_open_ended: boolean
          nights: number | null
          notes: string | null
          organization_id: string
          paid_amount: number | null
          source: string | null
          status: Database["public"]["Enums"]["reservation_status"] | null
          total_amount: number
          updated_at: string | null
          cancellation_reason: string | null
        }
        Insert: {
          actual_check_in_at?: string | null
          actual_check_out_at?: string | null
          branch_id: string
          cancelled_at?: string | null
          cancelled_by?: string | null
          check_in: string
          check_out: string
          created_at?: string | null
          created_by: string
          extended_from_check_out?: string | null
          extension_notes?: string | null
          id?: string
          is_open_ended?: boolean
          notes?: string | null
          organization_id: string
          paid_amount?: number | null
          source?: string | null
          status?: Database["public"]["Enums"]["reservation_status"] | null
          total_amount: number
          updated_at?: string | null
          cancellation_reason?: string | null
        }
        Update: {
          actual_check_in_at?: string | null
          actual_check_out_at?: string | null
          branch_id?: string
          cancelled_at?: string | null
          cancelled_by?: string | null
          check_in?: string
          check_out?: string
          created_at?: string | null
          created_by?: string
          extended_from_check_out?: string | null
          extension_notes?: string | null
          id?: string
          is_open_ended?: boolean
          notes?: string | null
          organization_id?: string
          paid_amount?: number | null
          source?: string | null
          status?: Database["public"]["Enums"]["reservation_status"] | null
          total_amount?: number
          updated_at?: string | null
          cancellation_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reservations_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      reservation_rooms: {
        Row: {
          created_at: string | null
          id: string
          notes: string | null
          reservation_id: string
          room_id: string
          room_price: number
          subtotal: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          notes?: string | null
          reservation_id: string
          room_id: string
          room_price: number
          subtotal: number
        }
        Update: {
          created_at?: string | null
          id?: string
          notes?: string | null
          reservation_id?: string
          room_id?: string
          room_price?: number
          subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: "reservation_rooms_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_rooms_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      reservation_guests: {
        Row: {
          address: string | null
          birth_date: string | null
          created_at: string | null
          document_number: string | null
          document_type: string | null
          email: string | null
          full_name: string
          id: string
          is_main_guest: boolean | null
          marital_status: string | null
          nationality: string | null
          phone: string | null
          reservation_room_id: string
          sex: string | null
        }
        Insert: {
          address?: string | null
          birth_date?: string | null
          created_at?: string | null
          document_number?: string | null
          document_type?: string | null
          email?: string | null
          full_name: string
          id?: string
          is_main_guest?: boolean | null
          marital_status?: string | null
          nationality?: string | null
          phone?: string | null
          reservation_room_id: string
          sex?: string | null
        }
        Update: {
          address?: string | null
          birth_date?: string | null
          created_at?: string | null
          document_number?: string | null
          document_type?: string | null
          email?: string | null
          full_name?: string
          id?: string
          is_main_guest?: boolean | null
          marital_status?: string | null
          nationality?: string | null
          phone?: string | null
          reservation_room_id?: string
          sex?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reservation_guests_reservation_room_id_fkey"
            columns: ["reservation_room_id"]
            isOneToOne: false
            referencedRelation: "reservation_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      reservation_payments: {
        Row: {
          amount: number
          created_at: string | null
          created_by: string
          id: string
          notes: string | null
          organization_id: string
          paid_at: string | null
          payment_method: string
          payment_type: string
          reference: string | null
          reservation_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          created_by: string
          id?: string
          notes?: string | null
          organization_id: string
          paid_at?: string | null
          payment_method: string
          payment_type: string
          reference?: string | null
          reservation_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          created_by?: string
          id?: string
          notes?: string | null
          organization_id?: string
          paid_at?: string | null
          payment_method?: string
          payment_type?: string
          reference?: string | null
          reservation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservation_payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_payments_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      admin_payment_stats: {
        Row: {
          approved_today: number | null
          avg_review_minutes: number | null
          pending_count: number | null
          rejected_today: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_get_payment_validation_detail: {
        Args: { p_validation_id: string }
        Returns: {
          amount: number
          billing_data: Json
          created_at: string
          id: string
          organization_address: string
          organization_id: string
          organization_name: string
          organization_slug: string
          organization_status: string
          payment_method: string
          receipt_filename: string
          receipt_mime_type: string
          receipt_storage_path: string
          rejection_reason: string
          reviewed_at: string
          reviewed_by_name: string
          status: string
          subscription_status: string
          transaction_ref: string
          user_email: string
          user_full_name: string
          user_id: string
        }[]
      }
      admin_list_payment_validations: {
        Args: {
          p_date_from?: string
          p_date_to?: string
          p_page?: number
          p_page_size?: number
          p_search?: string
          p_status?: string
        }
        Returns: {
          amount: number
          created_at: string
          id: string
          organization_id: string
          organization_name: string
          organization_slug: string
          payment_method: string
          receipt_filename: string
          receipt_mime_type: string
          receipt_storage_path: string
          rejection_reason: string
          reviewed_at: string
          reviewed_by_name: string
          status: string
          total_count: number
          transaction_ref: string
          user_email: string
          user_full_name: string
          user_id: string
        }[]
      }
      admin_payment_validation_stats: {
        Args: never
        Returns: {
          approved_today: number
          avg_review_minutes: number
          pending_count: number
          rejected_today: number
        }[]
      }
      admin_review_payment_validation: {
        Args: { p_decision: string; p_reason?: string; p_validation_id: string }
        Returns: Json
      }
      apply_inventory_stock_mutation: {
        Args: {
          p_branch_id: string
          p_min_stock_level?: number
          p_mode: string
          p_product_id: string
          p_quantity: number
          p_require_available?: boolean
        }
        Returns: {
          min_stock_level: number
          new_quantity: number
          previous_quantity: number
          reserved_quantity: number
          stock_id: string
        }[]
      }
      check_subscription_limit: {
        Args: { org_id: string; resource_type: string }
        Returns: boolean
      }
      create_onboarding_organization: {
        Args: {
          p_activation_mode?: string
          p_billing_mode?: string
          p_business_types?: string
          p_country?: string
          p_currency?: string
          p_email?: string
          p_full_name?: string
          p_name: string
          p_plan_slug?: string
          p_phone?: string
          p_timezone?: string
        }
        Returns: string
      }
      get_account_status_snapshot: {
        Args: { p_organization_id: string }
        Returns: {
          is_trial: boolean
          latest_validation_status: string
          organization_status: string
          subscription_status: Database["public"]["Enums"]["sub_status"]
          trial_ends_at: string
        }[]
      }
      get_organization_capabilities: {
        Args: { input_org_id: string }
        Returns: Json
      }
      get_user_branch_id: { Args: never; Returns: string }
      get_user_organization_id: { Args: never; Returns: string }
      get_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      inventory_adjust_batch_execute: {
        Args: {
          p_branch_id: string
          p_idempotency_key: string
          p_lines: Json
          p_mode: string
          p_note: string
          p_organization_id: string
          p_reason: string
          p_reference_code: string
          p_user_id: string
        }
        Returns: {
          batch_id: string
          idempotent: boolean
          processed_count: number
        }[]
      }
      inventory_adjust_batch_precheck: {
        Args: {
          p_branch_id: string
          p_lines: Json
          p_mode: string
          p_organization_id: string
        }
        Returns: {
          current_quantity: number
          error_code: string
          error_message: string
          is_valid: boolean
          line_index: number
          next_quantity: number
          product_id: string
          quantity: number
        }[]
      }
      inventory_transfer_batch_create: {
        Args: {
          p_destination_branch_id: string
          p_idempotency_key: string
          p_lines: Json
          p_observations: string
          p_organization_id: string
          p_reference_code: string
          p_source_branch_id: string
          p_user_id: string
        }
        Returns: {
          batch_id: string
          idempotent: boolean
          processed_count: number
        }[]
      }
      inventory_transfer_batch_precheck: {
        Args: {
          p_destination_branch_id: string
          p_lines: Json
          p_organization_id: string
          p_source_branch_id: string
        }
        Returns: {
          current_quantity: number
          error_code: string
          error_message: string
          is_valid: boolean
          line_index: number
          next_quantity: number
          product_id: string
          quantity: number
        }[]
      }
      inventory_transfer_batch_receive: {
        Args: {
          p_batch_id: string
          p_organization_id: string
          p_user_id: string
        }
        Returns: {
          batch_id: string
          idempotent: boolean
          processed_count: number
        }[]
      }
      is_branch_in_user_organization: {
        Args: { target_branch_id: string }
        Returns: boolean
      }
      is_system_user: { Args: { input_user_id?: string }; Returns: boolean }
      is_user_assigned_to_branch: {
        Args: { target_branch_id: string }
        Returns: boolean
      }
      next_inventory_document_code: {
        Args: {
          p_doc_type: string
          p_organization_id: string
          p_prefix?: string
          p_year?: number
        }
        Returns: string
      }
      plan_billing_mode_enabled: {
        Args: { p_available_billing_modes: Json; p_billing_mode: string }
        Returns: boolean
      }
    }
    Enums: {
      appointment_source: "manual" | "pos_checkout" | "client_booking"
      appointment_status:
        | "pending"
        | "confirmed"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "no_show"
      audit_action:
        | "INSERT"
        | "UPDATE"
        | "DELETE"
        | "TRUNCATE"
        | "LOGIN_FAILED"
        | "PERMISSION_DENIED"
      payment_method: "cash" | "card" | "transfer" | "mixed" | "digital_wallet"
      sub_status: "active" | "past_due" | "canceled" | "trial" | "over_limit"
      transaction_type: "sale" | "refund" | "adjustment" | "void"
      user_role: "admin" | "manager" | "employee" | "client"
      reservation_status:
        | "pending_payment"
        | "pending"
        | "confirmed"
        | "checked_in"
        | "checked_out"
        | "cancelled"
        | "no_show"
      room_status: "available" | "occupied" | "maintenance" | "cleaning"
      business_type_enum: "product" | "service" | "lodging"
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
      appointment_source: ["manual", "pos_checkout", "client_booking"],
      appointment_status: [
        "pending",
        "confirmed",
        "in_progress",
        "completed",
        "cancelled",
        "no_show",
      ],
      audit_action: [
        "INSERT",
        "UPDATE",
        "DELETE",
        "TRUNCATE",
        "LOGIN_FAILED",
        "PERMISSION_DENIED",
      ],
      payment_method: ["cash", "card", "transfer", "mixed", "digital_wallet"],
      sub_status: ["active", "past_due", "canceled", "trial", "over_limit"],
      transaction_type: ["sale", "refund", "adjustment", "void"],
      user_role: ["admin", "manager", "employee", "client"],
      reservation_status: [
        "pending_payment",
        "pending",
        "confirmed",
        "checked_in",
        "checked_out",
        "cancelled",
        "no_show",
      ],
      room_status: ["available", "occupied", "maintenance", "cleaning"],
      business_type_enum: ["product", "service", "lodging"],
    },
  },
} as const
