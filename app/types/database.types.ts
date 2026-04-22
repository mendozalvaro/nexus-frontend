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
          start_time: string
          status: Database["public"]["Enums"]["appointment_status"] | null
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
          start_time: string
          status?: Database["public"]["Enums"]["appointment_status"] | null
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
          start_time?: string
          status?: Database["public"]["Enums"]["appointment_status"] | null
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
            referencedRelation: "profiles"
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
          id: string
          is_active: boolean | null
          name: string
          organization_id: string
          parent_id: string | null
          type: string
        }
        Insert: {
          id?: string
          is_active?: boolean | null
          name: string
          organization_id: string
          parent_id?: string | null
          type: string
        }
        Update: {
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string
          parent_id?: string | null
          type?: string
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
          client_id: string
          created_at: string
          organization_id: string
          status: string
          updated_at: string
        }
        Insert: {
          billing_data?: Json
          client_id: string
          created_at?: string
          organization_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          billing_data?: Json
          client_id?: string
          created_at?: string
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
      organizations: {
        Row: {
          address: string | null
          billing_data: Json | null
          business_type: string | null
          country: string | null
          created_at: string | null
          currency_code: string | null
          id: string
          is_active: boolean | null
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
          business_type?: string | null
          country?: string | null
          created_at?: string | null
          currency_code?: string | null
          id?: string
          is_active?: boolean | null
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
          business_type?: string | null
          country?: string | null
          created_at?: string | null
          currency_code?: string | null
          id?: string
          is_active?: boolean | null
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
          related_appointment_id: string | null
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
          related_appointment_id?: string | null
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
          related_appointment_id?: string | null
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
            referencedRelation: "profiles"
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
          {
            foreignKeyName: "transactions_related_appointment_id_fkey"
            columns: ["related_appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
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
      create_onboarding_organization:
        | {
            Args: {
              p_billing_mode?: string
              p_business_type?: string
              p_country?: string
              p_currency?: string
              p_email?: string
              p_full_name?: string
              p_name: string
              p_phone?: string
              p_timezone?: string
            }
            Returns: string
          }
        | {
            Args: {
              p_address?: string
              p_billing_data?: Json
              p_billing_mode?: string
              p_business_type?: string
              p_country?: string
              p_currency?: string
              p_email?: string
              p_full_name?: string
              p_name: string
              p_phone?: string
              p_slug?: string
              p_timezone?: string
            }
            Returns: string
          }
        | {
            Args: {
              p_address?: string
              p_country: string
              p_email?: string
              p_full_name?: string
              p_name: string
              p_phone?: string
            }
            Returns: string
          }
        | {
            Args: {
              p_address: string
              p_billing_data: Json
              p_currency: string
              p_email: string
              p_full_name: string
              p_name: string
              p_phone?: string
              p_slug: string
              p_timezone: string
            }
            Returns: string
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
      is_branch_in_user_organization: {
        Args: { target_branch_id: string }
        Returns: boolean
      }
      is_system_user: { Args: { input_user_id?: string }; Returns: boolean }
      is_user_assigned_to_branch: {
        Args: { target_branch_id: string }
        Returns: boolean
      }
      plan_billing_mode_enabled: {
        Args: { p_available_billing_modes: Json; p_billing_mode: string }
        Returns: boolean
      }
    }
    Enums: {
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
    },
  },
} as const
