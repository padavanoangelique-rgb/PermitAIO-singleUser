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
      contractor_profiles: {
        Row: {
          address: string | null
          bonding_address: string | null
          bonding_city: string | null
          bonding_company: string | null
          bonding_state: string | null
          bonding_zip: string | null
          business_tax_receipt_number: string | null
          city: string | null
          company_name: string
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          is_default: boolean
          license_number: string | null
          logo_url: string | null
          org_id: string
          phone: string | null
          qualifier_name: string | null
          state: string | null
          trade: string
          updated_at: string
          zip: string | null
        }
        Insert: {
          address?: string | null
          bonding_address?: string | null
          bonding_city?: string | null
          bonding_company?: string | null
          bonding_state?: string | null
          bonding_zip?: string | null
          business_tax_receipt_number?: string | null
          city?: string | null
          company_name: string
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_default?: boolean
          license_number?: string | null
          logo_url?: string | null
          org_id: string
          phone?: string | null
          qualifier_name?: string | null
          state?: string | null
          trade?: string
          updated_at?: string
          zip?: string | null
        }
        Update: {
          address?: string | null
          bonding_address?: string | null
          bonding_city?: string | null
          bonding_company?: string | null
          bonding_state?: string | null
          bonding_zip?: string | null
          business_tax_receipt_number?: string | null
          city?: string | null
          company_name?: string
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_default?: boolean
          license_number?: string | null
          logo_url?: string | null
          org_id?: string
          phone?: string | null
          qualifier_name?: string | null
          state?: string | null
          trade?: string
          updated_at?: string
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contractor_profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      floor_plans: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          job_id: string | null
          name: string
          org_id: string
          plan_data: Json
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          job_id?: string | null
          name?: string
          org_id: string
          plan_data?: Json
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          job_id?: string | null
          name?: string
          org_id?: string
          plan_data?: Json
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "floor_plans_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "floor_plans_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      folio_jurisdiction_codes: {
        Row: {
          code: string
          county: string
          id: number
          jurisdiction_name: string
          notes: string | null
        }
        Insert: {
          code: string
          county: string
          id?: never
          jurisdiction_name: string
          notes?: string | null
        }
        Update: {
          code?: string
          county?: string
          id?: never
          jurisdiction_name?: string
          notes?: string | null
        }
        Relationships: []
      }
      form_templates: {
        Row: {
          county: string
          created_at: string
          description: string | null
          doc_type: string
          field_mapping: Json
          file_data: string | null
          file_name: string | null
          id: string
          jurisdiction_code: string | null
          jurisdiction_name: string | null
          org_id: string | null
          sort_order: number
          title: string
          trade: string
          updated_at: string
          visibility: string
        }
        Insert: {
          county: string
          created_at?: string
          description?: string | null
          doc_type?: string
          field_mapping?: Json
          file_data?: string | null
          file_name?: string | null
          id?: string
          jurisdiction_code?: string | null
          jurisdiction_name?: string | null
          org_id?: string | null
          sort_order?: number
          title: string
          trade?: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          county?: string
          created_at?: string
          description?: string | null
          doc_type?: string
          field_mapping?: Json
          file_data?: string | null
          file_name?: string | null
          id?: string
          jurisdiction_code?: string | null
          jurisdiction_name?: string | null
          org_id?: string | null
          sort_order?: number
          title?: string
          trade?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      hoa_documents: {
        Row: {
          file_name: string
          hoa_id: string | null
          id: string
          org_id: string
          storage_path: string
          uploaded_at: string | null
        }
        Insert: {
          file_name: string
          hoa_id?: string | null
          id?: string
          org_id: string
          storage_path: string
          uploaded_at?: string | null
        }
        Update: {
          file_name?: string
          hoa_id?: string | null
          id?: string
          org_id?: string
          storage_path?: string
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hoa_documents_hoa_id_fkey"
            columns: ["hoa_id"]
            isOneToOne: false
            referencedRelation: "hoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hoa_documents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      hoa_jobs: {
        Row: {
          address: string
          assigned_date: string | null
          assigned_to: string | null
          created_at: string | null
          date_approved: string | null
          date_submitted: string | null
          hoa_id: string | null
          id: string
          job_id: string | null
          job_name: string | null
          job_number: string | null
          notes: string | null
          org_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          address: string
          assigned_date?: string | null
          assigned_to?: string | null
          created_at?: string | null
          date_approved?: string | null
          date_submitted?: string | null
          hoa_id?: string | null
          id?: string
          job_id?: string | null
          job_name?: string | null
          job_number?: string | null
          notes?: string | null
          org_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string
          assigned_date?: string | null
          assigned_to?: string | null
          created_at?: string | null
          date_approved?: string | null
          date_submitted?: string | null
          hoa_id?: string | null
          id?: string
          job_id?: string | null
          job_name?: string | null
          job_number?: string | null
          notes?: string | null
          org_id?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hoa_jobs_hoa_id_fkey"
            columns: ["hoa_id"]
            isOneToOne: false
            referencedRelation: "hoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hoa_jobs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hoa_jobs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      hoa_spine: {
        Row: {
          address: string | null
          city: string | null
          contact_name: string | null
          county: string | null
          created_at: string
          email: string | null
          id: string
          mgmt_co: string | null
          name: string
          name_norm: string
          notes: string | null
          phone: string | null
          public_arc_url: string | null
          qualifications: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          contact_name?: string | null
          county?: string | null
          created_at?: string
          email?: string | null
          id?: string
          mgmt_co?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          public_arc_url?: string | null
          qualifications?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          contact_name?: string | null
          county?: string | null
          email?: string | null
          mgmt_co?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          public_arc_url?: string | null
          qualifications?: string | null
        }
        Relationships: []
      }
      hoas: {
        Row: {
          address: string | null
          contact_name: string | null
          created_at: string | null
          email: string | null
          id: string
          mgmt_co: string | null
          name: string
          notes: string | null
          org_id: string
          phone: string | null
          qualifications: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          contact_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          mgmt_co?: string | null
          name: string
          notes?: string | null
          org_id: string
          phone?: string | null
          qualifications?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          contact_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          mgmt_co?: string | null
          name?: string
          notes?: string | null
          org_id?: string
          phone?: string | null
          qualifications?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hoas_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      job_activity: {
        Row: {
          activity_type: string
          created_at: string
          id: string
          job_id: string
          message: string
          org_id: string
          user_id: string | null
        }
        Insert: {
          activity_type?: string
          created_at?: string
          id?: string
          job_id: string
          message: string
          org_id: string
          user_id?: string | null
        }
        Update: {
          activity_type?: string
          created_at?: string
          id?: string
          job_id?: string
          message?: string
          org_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_activity_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_activity_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      job_fees: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string | null
          id: string
          job_id: string
          jurisdiction: string | null
          notes: string | null
          org_id: string
          paid_date: string
          receipt_file_name: string | null
          receipt_mime_type: string | null
          receipt_size_bytes: number | null
          receipt_storage_path: string | null
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          created_by?: string | null
          id?: string
          job_id: string
          jurisdiction?: string | null
          notes?: string | null
          org_id: string
          paid_date?: string
          receipt_file_name?: string | null
          receipt_mime_type?: string | null
          receipt_size_bytes?: number | null
          receipt_storage_path?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          job_id?: string
          jurisdiction?: string | null
          notes?: string | null
          org_id?: string
          paid_date?: string
          receipt_file_name?: string | null
          receipt_mime_type?: string | null
          receipt_size_bytes?: number | null
          receipt_storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_fees_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_fees_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      job_files: {
        Row: {
          category: string | null
          file_name: string
          id: string
          job_id: string
          org_id: string
          size_bytes: number | null
          storage_path: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          category?: string | null
          file_name: string
          id?: string
          job_id: string
          org_id: string
          size_bytes?: number | null
          storage_path: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          category?: string | null
          file_name?: string
          id?: string
          job_id?: string
          org_id?: string
          size_bytes?: number | null
          storage_path?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_files_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_files_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      job_noa_annotations: {
                Row: {
                            annotated_by: string | null
                            created_at: string
                            id: string
                            job_id: string
                            noa_library_id: string
                            org_id: string
                            storage_path: string
                            updated_at: string
                }
                Insert: {
                            annotated_by?: string | null
                            created_at?: string
                            id?: string
                            job_id: string
                            noa_library_id: string
                            org_id: string
                            storage_path: string
                            updated_at?: string
                }
                Update: {
                            annotated_by?: string | null
                            created_at?: string
                            id?: string
                            job_id?: string
                            noa_library_id?: string
                            org_id?: string
                            storage_path?: string
                            updated_at?: string
                }
                Relationships: [
                  {
                                foreignKeyName: "job_noa_annotations_job_id_fkey"
                                columns: ["job_id"]
                                isOneToOne: false
                                referencedRelation: "jobs"
                                referencedColumns: ["id"]
                  },
                  {
                                foreignKeyName: "job_noa_annotations_noa_library_id_fkey"
                                columns: ["noa_library_id"]
                                isOneToOne: false
                                referencedRelation: "noa_library"
                                referencedColumns: ["id"]
                  },
                  {
                                foreignKeyName: "job_noa_annotations_org_id_fkey"
                                columns: ["org_id"]
                                isOneToOne: false
                                referencedRelation: "organizations"
                                referencedColumns: ["id"]
                  },
                          ]
      }
            job_permit_details: {
        Row: {
          architect_address: string | null
          architect_city: string | null
          architect_email: string | null
          architect_name: string | null
          architect_phone: string | null
          architect_state: string | null
          architect_zip: string | null
          bfe: string | null
          broward_tax_district_code: string | null
          building_use: string | null
          construction_type: string | null
          created_at: string
          description_of_work: string | null
          fee_simple_city: string | null
          fee_simple_state: string | null
          fee_simple_titleholder_name: string | null
          fee_simple_zip: string | null
          flood_zone: string | null
          floor_area: string | null
          id: string
          job_id: string
          legal_description: string | null
          license_exempted: boolean
          mortgage_city: string | null
          mortgage_lender_address: string | null
          mortgage_lender_name: string | null
          mortgage_state: string | null
          mortgage_zip: string | null
          occupancy_group: string | null
          org_id: string
          owner_authorized_private_provider: boolean
          owner_builder: boolean
          owner_email: string | null
          owner_phone: string | null
          present_use: string | null
          private_provider: boolean
          proposed_use: string | null
          unit: string | null
          updated_at: string
          work_type: string | null
          work_type_other: string | null
        }
        Insert: {
          architect_address?: string | null
          architect_city?: string | null
          architect_email?: string | null
          architect_name?: string | null
          architect_phone?: string | null
          architect_state?: string | null
          architect_zip?: string | null
          bfe?: string | null
          broward_tax_district_code?: string | null
          building_use?: string | null
          construction_type?: string | null
          created_at?: string
          description_of_work?: string | null
          fee_simple_city?: string | null
          fee_simple_state?: string | null
          fee_simple_titleholder_name?: string | null
          fee_simple_zip?: string | null
          flood_zone?: string | null
          floor_area?: string | null
          id?: string
          job_id: string
          legal_description?: string | null
          license_exempted?: boolean
          mortgage_city?: string | null
          mortgage_lender_address?: string | null
          mortgage_lender_name?: string | null
          mortgage_state?: string | null
          mortgage_zip?: string | null
          occupancy_group?: string | null
          org_id: string
          owner_authorized_private_provider?: boolean
          owner_builder?: boolean
          owner_email?: string | null
          owner_phone?: string | null
          present_use?: string | null
          private_provider?: boolean
          proposed_use?: string | null
          unit?: string | null
          updated_at?: string
          work_type?: string | null
          work_type_other?: string | null
        }
        Update: {
          architect_address?: string | null
          architect_city?: string | null
          architect_email?: string | null
          architect_name?: string | null
          architect_phone?: string | null
          architect_state?: string | null
          architect_zip?: string | null
          bfe?: string | null
          broward_tax_district_code?: string | null
          building_use?: string | null
          construction_type?: string | null
          created_at?: string
          description_of_work?: string | null
          fee_simple_city?: string | null
          fee_simple_state?: string | null
          fee_simple_titleholder_name?: string | null
          fee_simple_zip?: string | null
          flood_zone?: string | null
          floor_area?: string | null
          id?: string
          job_id?: string
          legal_description?: string | null
          license_exempted?: boolean
          mortgage_city?: string | null
          mortgage_lender_address?: string | null
          mortgage_lender_name?: string | null
          mortgage_state?: string | null
          mortgage_zip?: string | null
          occupancy_group?: string | null
          org_id?: string
          owner_authorized_private_provider?: boolean
          owner_builder?: boolean
          owner_email?: string | null
          owner_phone?: string | null
          present_use?: string | null
          private_provider?: boolean
          proposed_use?: string | null
          unit?: string | null
          updated_at?: string
          work_type?: string | null
          work_type_other?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_permit_details_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_permit_details_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      job_roofing_components: {
        Row: {
          component_type: string
          created_at: string
          id: string
          job_id: string
          manufacturer: string | null
          noa_number_hint: string | null
          org_id: string
          product: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          component_type: string
          created_at?: string
          id?: string
          job_id: string
          manufacturer?: string | null
          noa_number_hint?: string | null
          org_id: string
          product?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          component_type?: string
          created_at?: string
          id?: string
          job_id?: string
          manufacturer?: string | null
          noa_number_hint?: string | null
          org_id?: string
          product?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_roofing_components_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_roofing_components_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      job_roofing_details: {
        Row: {
          created_at: string
          id: string
          job_id: string
          mean_roof_height: string | null
          notes: string | null
          org_id: string
          roof_covering_type: string | null
          roof_shape: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          mean_roof_height?: string | null
          notes?: string | null
          org_id: string
          roof_covering_type?: string | null
          roof_shape?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          mean_roof_height?: string | null
          notes?: string | null
          org_id?: string
          roof_covering_type?: string | null
          roof_shape?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_roofing_details_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_roofing_details_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          address: string | null
          approved_date: string | null
          assigned_date: string | null
          city: string | null
          client_name: string
          contract_value: number | null
          created_at: string
          created_by: string | null
          folio_number: string | null
          hoa_tech: string
          id: string
          job_number: string
          jurisdiction: string | null
          material_eta: string | null
          noc_date: string | null
          noc_status: string
          notes: string | null
          ordered_date: string | null
          org_id: string
          permit_number: string | null
          permit_tech: string
          sale_date: string | null
          stage: string
          sub_status: string
          submitted_date: string | null
          trade_type: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          approved_date?: string | null
          assigned_date?: string | null
          city?: string | null
          client_name: string
          contract_value?: number | null
          created_at?: string
          created_by?: string | null
          folio_number?: string | null
          hoa_tech?: string
          id?: string
          job_number: string
          jurisdiction?: string | null
          material_eta?: string | null
          noc_date?: string | null
          noc_status?: string
          notes?: string | null
          ordered_date?: string | null
          org_id: string
          permit_number?: string | null
          permit_tech?: string
          sale_date?: string | null
          stage?: string
          sub_status?: string
          submitted_date?: string | null
          trade_type?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          approved_date?: string | null
          assigned_date?: string | null
          city?: string | null
          client_name?: string
          contract_value?: number | null
          created_at?: string
          created_by?: string | null
          folio_number?: string | null
          hoa_tech?: string
          id?: string
          job_number?: string
          jurisdiction?: string | null
          material_eta?: string | null
          noc_date?: string | null
          noc_status?: string
          notes?: string | null
          ordered_date?: string | null
          org_id?: string
          permit_number?: string | null
          permit_tech?: string
          sale_date?: string | null
          stage?: string
          sub_status?: string
          submitted_date?: string | null
          trade_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      noa_library: {
        Row: {
          created_at: string
          created_by: string | null
          effective_date: string | null
          expiration_date: string | null
          file_name: string | null
          id: string
          manufacturer: string
          model_number: string | null
          noa_number: string
          notes: string | null
          org_id: string
          owner_org_id: string | null
          pressure_neg: number | null
          pressure_pos: number | null
          series: string | null
          storage_path: string | null
          trade: string
          visibility: string
          window_type: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          effective_date?: string | null
          expiration_date?: string | null
          file_name?: string | null
          id?: string
          manufacturer: string
          model_number?: string | null
          noa_number: string
          notes?: string | null
          org_id: string
          owner_org_id?: string | null
          pressure_neg?: number | null
          pressure_pos?: number | null
          series?: string | null
          storage_path?: string | null
          trade?: string
          visibility?: string
          window_type?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          effective_date?: string | null
          expiration_date?: string | null
          file_name?: string | null
          id?: string
          manufacturer?: string
          model_number?: string | null
          noa_number?: string
          notes?: string | null
          org_id?: string
          owner_org_id?: string | null
          pressure_neg?: number | null
          pressure_pos?: number | null
          series?: string | null
          storage_path?: string | null
          trade?: string
          visibility?: string
          window_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "noa_library_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "noa_library_owner_org_id_fkey"
            columns: ["owner_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      noa_library_overrides: {
        Row: {
          created_at: string
          id: string
          noa_library_id: string
          notes: string | null
          org_id: string
          pressure_neg: number | null
          pressure_pos: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          noa_library_id: string
          notes?: string | null
          org_id: string
          pressure_neg?: number | null
          pressure_pos?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          noa_library_id?: string
          notes?: string | null
          org_id?: string
          pressure_neg?: number | null
          pressure_pos?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "noa_library_overrides_noa_library_id_fkey"
            columns: ["noa_library_id"]
            isOneToOne: false
            referencedRelation: "noa_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "noa_library_overrides_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_payment_links: {
        Row: {
          amount_cents: number | null
          created_at: string
          created_by: string | null
          currency: string
          id: string
          label: string
          last_sent_at: string | null
          last_sent_to: string | null
          notes: string | null
          org_id: string
          paid_at: string | null
          sent_count: number
          status: string
          url: string
        }
        Insert: {
          amount_cents?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          label: string
          last_sent_at?: string | null
          last_sent_to?: string | null
          notes?: string | null
          org_id: string
          paid_at?: string | null
          sent_count?: number
          status?: string
          url: string
        }
        Update: {
          amount_cents?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          label?: string
          last_sent_at?: string | null
          last_sent_to?: string | null
          notes?: string | null
          org_id?: string
          paid_at?: string | null
          sent_count?: number
          status?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_payment_links_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_tech_names: {
        Row: {
          display_name: string
          id: string
          kind: string
          org_id: string
          slot: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          display_name?: string
          id?: string
          kind: string
          org_id: string
          slot: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          display_name?: string
          id?: string
          kind?: string
          org_id?: string
          slot?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_tech_names_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          org_id: string
          revoked_at: string | null
          role: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          org_id: string
          revoked_at?: string | null
          role: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          org_id?: string
          revoked_at?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invites_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          hoa_tech_label: string | null
          id: string
          org_id: string
          permit_tech_label: string | null
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          hoa_tech_label?: string | null
          id?: string
          org_id: string
          permit_tech_label?: string | null
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          hoa_tech_label?: string | null
          id?: string
          org_id?: string
          permit_tech_label?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          billing_interval: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          onboarding_paid: boolean
          onboarding_tier: string | null
          plan: string
          slug: string
          stripe_checkout_session_id: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string
          subscription_tier: string | null
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          billing_interval?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          onboarding_paid?: boolean
          onboarding_tier?: string | null
          plan?: string
          slug: string
          stripe_checkout_session_id?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string
          subscription_tier?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          billing_interval?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          onboarding_paid?: boolean
          onboarding_tier?: string | null
          plan?: string
          slug?: string
          stripe_checkout_session_id?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string
          subscription_tier?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      permit_packages: {
        Row: {
          generated_at: string
          generated_by: string | null
          id: string
          job_id: string
          manifest: Json
          org_id: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          storage_path: string | null
          version: number
        }
        Insert: {
          generated_at?: string
          generated_by?: string | null
          id?: string
          job_id: string
          manifest?: Json
          org_id: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          storage_path?: string | null
          version?: number
        }
        Update: {
          generated_at?: string
          generated_by?: string | null
          id?: string
          job_id?: string
          manifest?: Json
          org_id?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          storage_path?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "permit_packages_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permit_packages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      permit_toolkit_leads: {
        Row: {
          created_at: string | null
          day3_sent_at: string | null
          day7_sent_at: string | null
          email: string
          first_tool: string | null
          id: string
          ip_hash: string | null
          referrer: string | null
          role: string | null
          source: string | null
          user_agent: string | null
          welcome_sent_at: string | null
        }
        Insert: {
          created_at?: string | null
          day3_sent_at?: string | null
          day7_sent_at?: string | null
          email: string
          first_tool?: string | null
          id?: string
          ip_hash?: string | null
          referrer?: string | null
          role?: string | null
          source?: string | null
          user_agent?: string | null
          welcome_sent_at?: string | null
        }
        Update: {
          created_at?: string | null
          day3_sent_at?: string | null
          day7_sent_at?: string | null
          email?: string
          first_tool?: string | null
          id?: string
          ip_hash?: string | null
          referrer?: string | null
          role?: string | null
          source?: string | null
          user_agent?: string | null
          welcome_sent_at?: string | null
        }
        Relationships: []
      }
      platform_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_leads: {
        Row: {
          admin_notes: string | null
          company: string | null
          created_at: string
          email: string
          id: string
          ip_hash: string | null
          message: string | null
          name: string
          phone: string | null
          plan_of_interest: string | null
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          company?: string | null
          created_at?: string
          email: string
          id?: string
          ip_hash?: string | null
          message?: string | null
          name: string
          phone?: string | null
          plan_of_interest?: string | null
          source?: string
          status?: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          company?: string | null
          created_at?: string
          email?: string
          id?: string
          ip_hash?: string | null
          message?: string | null
          name?: string
          phone?: string | null
          plan_of_interest?: string | null
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_approvals: {
        Row: {
          created_at: string
          id: number
          manufacturer: string
          neg: number | null
          noa: string | null
          org_id: string
          pos: number | null
          series: string
          trade: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: never
          manufacturer: string
          neg?: number | null
          noa?: string | null
          org_id: string
          pos?: number | null
          series: string
          trade?: string
          type: string
        }
        Update: {
          created_at?: string
          id?: never
          manufacturer?: string
          neg?: number | null
          noa?: string | null
          org_id?: string
          pos?: number | null
          series?: string
          trade?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_approvals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_platform_admin: boolean
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          is_platform_admin?: boolean
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_platform_admin?: boolean
        }
        Relationships: []
      }
      requirements_forms: {
        Row: {
          county: string | null
          created_at: string
          doc_type: string
          field_mapping: Json
          file_data: string | null
          file_name: string | null
          id: number
          jurisdiction: string
          jurisdiction_code: string | null
          notes: string | null
          org_id: string | null
          owner_org_id: string | null
          title: string
          trade: string
          visibility: string
        }
        Insert: {
          county?: string | null
          created_at?: string
          doc_type?: string
          field_mapping?: Json
          file_data?: string | null
          file_name?: string | null
          id?: never
          jurisdiction: string
          jurisdiction_code?: string | null
          notes?: string | null
          org_id?: string | null
          owner_org_id?: string | null
          title: string
          trade?: string
          visibility?: string
        }
        Update: {
          county?: string | null
          created_at?: string
          doc_type?: string
          field_mapping?: Json
          file_data?: string | null
          file_name?: string | null
          id?: never
          jurisdiction?: string
          jurisdiction_code?: string | null
          notes?: string | null
          org_id?: string | null
          owner_org_id?: string | null
          title?: string
          trade?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "requirements_forms_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requirements_forms_owner_org_id_fkey"
            columns: ["owner_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      stages: {
        Row: {
          name: string
          org_id: string
          sort_order: number
        }
        Insert: {
          name: string
          org_id: string
          sort_order: number
        }
        Update: {
          name?: string
          org_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "stages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      template_form_templates: {
        Row: {
          county: string
          description: string | null
          doc_type: string
          field_mapping: Json
          file_data: string | null
          file_name: string | null
          id: number
          jurisdiction_code: string | null
          jurisdiction_name: string | null
          sort_order: number
          title: string
          trade: string
        }
        Insert: {
          county: string
          description?: string | null
          doc_type?: string
          field_mapping?: Json
          file_data?: string | null
          file_name?: string | null
          id?: never
          jurisdiction_code?: string | null
          jurisdiction_name?: string | null
          sort_order?: number
          title: string
          trade?: string
        }
        Update: {
          county?: string
          description?: string | null
          doc_type?: string
          field_mapping?: Json
          file_data?: string | null
          file_name?: string | null
          id?: never
          jurisdiction_code?: string | null
          jurisdiction_name?: string | null
          sort_order?: number
          title?: string
          trade?: string
        }
        Relationships: []
      }
      template_hoas: {
        Row: {
          address: string | null
          contact_name: string | null
          email: string | null
          id: number
          mgmt_co: string | null
          name: string
          notes: string | null
          phone: string | null
          qualifications: string | null
        }
        Insert: {
          address?: string | null
          contact_name?: string | null
          email?: string | null
          id?: never
          mgmt_co?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          qualifications?: string | null
        }
        Update: {
          address?: string | null
          contact_name?: string | null
          email?: string | null
          id?: never
          mgmt_co?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          qualifications?: string | null
        }
        Relationships: []
      }
      template_product_approvals: {
        Row: {
          id: number
          manufacturer: string
          neg: number | null
          noa: string | null
          pos: number | null
          series: string
          trade: string
          type: string
        }
        Insert: {
          id?: never
          manufacturer: string
          neg?: number | null
          noa?: string | null
          pos?: number | null
          series: string
          trade?: string
          type: string
        }
        Update: {
          id?: never
          manufacturer?: string
          neg?: number | null
          noa?: string | null
          pos?: number | null
          series?: string
          trade?: string
          type?: string
        }
        Relationships: []
      }
      template_requirements_forms: {
        Row: {
          county: string | null
          doc_type: string
          field_mapping: Json
          file_data: string | null
          file_name: string | null
          id: number
          jurisdiction: string
          jurisdiction_code: string | null
          notes: string | null
          title: string
          trade: string
        }
        Insert: {
          county?: string | null
          doc_type?: string
          field_mapping?: Json
          file_data?: string | null
          file_name?: string | null
          id?: never
          jurisdiction: string
          jurisdiction_code?: string | null
          notes?: string | null
          title: string
          trade?: string
        }
        Update: {
          county?: string | null
          doc_type?: string
          field_mapping?: Json
          file_data?: string | null
          file_name?: string | null
          id?: never
          jurisdiction?: string
          jurisdiction_code?: string | null
          notes?: string | null
          title?: string
          trade?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      capture_permit_toolkit_lead: {
        Args: {
          p_email: string
          p_first_tool?: string
          p_referrer?: string
          p_role?: string
          p_source?: string
          p_user_agent?: string
        }
        Returns: Json
      }
      is_org_admin: { Args: { check_org_id: string }; Returns: boolean }
      is_org_member: { Args: { check_org_id: string }; Returns: boolean }
      is_platform_admin: { Args: { uid: string }; Returns: boolean }
      seed_default_stages: { Args: { target_org: string }; Returns: undefined }
      seed_org_reference_data: {
        Args: { p_org_id: string }
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
  public: {
    Enums: {},
  },
} as const
