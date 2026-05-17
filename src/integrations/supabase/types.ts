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
      agreements: {
        Row: {
          accepted_at: string
          agreement_id: string
          agreement_text: string
          beat_id: string
          beat_title: string
          created_at: string
          credits_used: number
          download_id: string | null
          file_type: string
          id: string
          license_type: string
          pdf_url: string | null
          producer_name: string
          user_email: string
          user_id: string
          user_name: string
        }
        Insert: {
          accepted_at?: string
          agreement_id: string
          agreement_text: string
          beat_id: string
          beat_title: string
          created_at?: string
          credits_used?: number
          download_id?: string | null
          file_type?: string
          id?: string
          license_type?: string
          pdf_url?: string | null
          producer_name?: string
          user_email: string
          user_id: string
          user_name: string
        }
        Update: {
          accepted_at?: string
          agreement_id?: string
          agreement_text?: string
          beat_id?: string
          beat_title?: string
          created_at?: string
          credits_used?: number
          download_id?: string | null
          file_type?: string
          id?: string
          license_type?: string
          pdf_url?: string | null
          producer_name?: string
          user_email?: string
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "agreements_beat_id_fkey"
            columns: ["beat_id"]
            isOneToOne: false
            referencedRelation: "beats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreements_download_id_fkey"
            columns: ["download_id"]
            isOneToOne: false
            referencedRelation: "downloads"
            referencedColumns: ["id"]
          },
        ]
      }
      beat_claims: {
        Row: {
          beat_id: string
          checkout_session_id: string | null
          created_at: string
          device_fingerprint: string | null
          email: string
          expires_at: string
          id: string
          ip_address: string | null
          purchased_at: string | null
          source: string | null
          token: string
          user_agent: string | null
        }
        Insert: {
          beat_id: string
          checkout_session_id?: string | null
          created_at?: string
          device_fingerprint?: string | null
          email: string
          expires_at?: string
          id?: string
          ip_address?: string | null
          purchased_at?: string | null
          source?: string | null
          token: string
          user_agent?: string | null
        }
        Update: {
          beat_id?: string
          checkout_session_id?: string | null
          created_at?: string
          device_fingerprint?: string | null
          email?: string
          expires_at?: string
          id?: string
          ip_address?: string | null
          purchased_at?: string | null
          source?: string | null
          token?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "beat_claims_beat_id_fkey"
            columns: ["beat_id"]
            isOneToOne: false
            referencedRelation: "beats"
            referencedColumns: ["id"]
          },
        ]
      }
      beat_funnel_leads: {
        Row: {
          captured_at: string
          email: string
          forward_error: string | null
          forwarded_at: string | null
          funnel_id: string
          id: string
          ip: string | null
          user_agent: string | null
        }
        Insert: {
          captured_at?: string
          email: string
          forward_error?: string | null
          forwarded_at?: string | null
          funnel_id: string
          id?: string
          ip?: string | null
          user_agent?: string | null
        }
        Update: {
          captured_at?: string
          email?: string
          forward_error?: string | null
          forwarded_at?: string | null
          funnel_id?: string
          id?: string
          ip?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "beat_funnel_leads_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: false
            referencedRelation: "beat_funnels"
            referencedColumns: ["id"]
          },
        ]
      }
      beat_funnels: {
        Row: {
          audio_url: string | null
          beat_id: string | null
          content: Json
          cover_url: string | null
          created_at: string
          download_url: string
          headline: string | null
          id: string
          is_active: boolean
          slug: string
          title: string
          updated_at: string
          video_url: string | null
          view_count: number
        }
        Insert: {
          audio_url?: string | null
          beat_id?: string | null
          content?: Json
          cover_url?: string | null
          created_at?: string
          download_url: string
          headline?: string | null
          id?: string
          is_active?: boolean
          slug: string
          title: string
          updated_at?: string
          video_url?: string | null
          view_count?: number
        }
        Update: {
          audio_url?: string | null
          beat_id?: string | null
          content?: Json
          cover_url?: string | null
          created_at?: string
          download_url?: string
          headline?: string | null
          id?: string
          is_active?: boolean
          slug?: string
          title?: string
          updated_at?: string
          video_url?: string | null
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "beat_funnels_beat_id_fkey"
            columns: ["beat_id"]
            isOneToOne: false
            referencedRelation: "beats"
            referencedColumns: ["id"]
          },
        ]
      }
      beat_requests: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          reference_artists: string | null
          status: string
          style: string | null
          tempo: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          reference_artists?: string | null
          status?: string
          style?: string | null
          tempo?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          reference_artists?: string | null
          status?: string
          style?: string | null
          tempo?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      beats: {
        Row: {
          audio_url: string | null
          audio_url_tagged: string | null
          audio_url_wav: string | null
          bpm: number
          cover_url: string | null
          created_at: string
          duration_seconds: number
          genre: string
          id: string
          is_member_only: boolean
          mood: string
          music_key: string
          producer_name: string
          release_at: string | null
          title: string
        }
        Insert: {
          audio_url?: string | null
          audio_url_tagged?: string | null
          audio_url_wav?: string | null
          bpm: number
          cover_url?: string | null
          created_at?: string
          duration_seconds: number
          genre: string
          id?: string
          is_member_only?: boolean
          mood: string
          music_key: string
          producer_name?: string
          release_at?: string | null
          title: string
        }
        Update: {
          audio_url?: string | null
          audio_url_tagged?: string | null
          audio_url_wav?: string | null
          bpm?: number
          cover_url?: string | null
          created_at?: string
          duration_seconds?: number
          genre?: string
          id?: string
          is_member_only?: boolean
          mood?: string
          music_key?: string
          producer_name?: string
          release_at?: string | null
          title?: string
        }
        Relationships: []
      }
      catalog_options: {
        Row: {
          created_at: string
          id: string
          sort_order: number
          type: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          sort_order?: number
          type: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          sort_order?: number
          type?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          audio_duration_seconds: number | null
          audio_mime: string | null
          audio_url: string | null
          body: string
          created_at: string
          id: string
          read_at: string | null
          sender_id: string
          sender_role: string
          thread_id: string
        }
        Insert: {
          audio_duration_seconds?: number | null
          audio_mime?: string | null
          audio_url?: string | null
          body: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id: string
          sender_role: string
          thread_id: string
        }
        Update: {
          audio_duration_seconds?: number | null
          audio_mime?: string | null
          audio_url?: string | null
          body?: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id?: string
          sender_role?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_threads: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          last_message_preview: string | null
          status: string
          unread_for_admin: number
          unread_for_user: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          last_message_preview?: string | null
          status?: string
          unread_for_admin?: number
          unread_for_user?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          last_message_preview?: string | null
          status?: string
          unread_for_admin?: number
          unread_for_user?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      courses: {
        Row: {
          created_at: string
          description: string | null
          id: string
          sort_order: number
          title: string
          updated_at: string
          video_url: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          sort_order?: number
          title: string
          updated_at?: string
          video_url: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          sort_order?: number
          title?: string
          updated_at?: string
          video_url?: string
        }
        Relationships: []
      }
      downloads: {
        Row: {
          beat_id: string
          created_at: string
          credits_used: number
          file_type: string
          id: string
          user_id: string
        }
        Insert: {
          beat_id: string
          created_at?: string
          credits_used?: number
          file_type?: string
          id?: string
          user_id: string
        }
        Update: {
          beat_id?: string
          created_at?: string
          credits_used?: number
          file_type?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "downloads_beat_id_fkey"
            columns: ["beat_id"]
            isOneToOne: false
            referencedRelation: "beats"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      exclusive_bids: {
        Row: {
          amount: number
          beat_id: string
          created_at: string
          id: string
          note: string | null
          request_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          beat_id: string
          created_at?: string
          id?: string
          note?: string | null
          request_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          beat_id?: string
          created_at?: string
          id?: string
          note?: string | null
          request_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exclusive_bids_beat_id_fkey"
            columns: ["beat_id"]
            isOneToOne: false
            referencedRelation: "beats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exclusive_bids_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "exclusive_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exclusive_bids_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exclusive_requests: {
        Row: {
          beat_id: string
          bid_deadline: string | null
          closed_at: string | null
          created_at: string
          id: string
          intended_use: string | null
          minimum_bid: number | null
          notes: string | null
          opened_at: string | null
          requested_amount: number | null
          requested_by: string
          status: string
          updated_at: string
        }
        Insert: {
          beat_id: string
          bid_deadline?: string | null
          closed_at?: string | null
          created_at?: string
          id?: string
          intended_use?: string | null
          minimum_bid?: number | null
          notes?: string | null
          opened_at?: string | null
          requested_amount?: number | null
          requested_by: string
          status?: string
          updated_at?: string
        }
        Update: {
          beat_id?: string
          bid_deadline?: string | null
          closed_at?: string | null
          created_at?: string
          id?: string
          intended_use?: string | null
          minimum_bid?: number | null
          notes?: string | null
          opened_at?: string | null
          requested_amount?: number | null
          requested_by?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exclusive_requests_beat_id_fkey"
            columns: ["beat_id"]
            isOneToOne: false
            referencedRelation: "beats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exclusive_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      homepage_settings: {
        Row: {
          hero_media_type: string
          hero_media_url: string | null
          id: string
          updated_at: string
        }
        Insert: {
          hero_media_type?: string
          hero_media_url?: string | null
          id?: string
          updated_at?: string
        }
        Update: {
          hero_media_type?: string
          hero_media_url?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      invites: {
        Row: {
          claimed_by_user_id: string | null
          created_at: string
          created_by: string | null
          email: string | null
          environment: string
          expires_at: string
          id: string
          revoked_at: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          tier: string
          token: string
          updated_at: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          claimed_by_user_id?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          environment?: string
          expires_at?: string
          id?: string
          revoked_at?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier?: string
          token: string
          updated_at?: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          claimed_by_user_id?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          environment?: string
          expires_at?: string
          id?: string
          revoked_at?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier?: string
          token?: string
          updated_at?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: []
      }
      notes: {
        Row: {
          beat_id: string | null
          content: string
          created_at: string
          id: string
          is_pinned: boolean
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          beat_id?: string | null
          content?: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          beat_id?: string | null
          content?: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_beat_id_fkey"
            columns: ["beat_id"]
            isOneToOne: false
            referencedRelation: "beats"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          is_read: boolean
          title: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          is_read?: boolean
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      offer_page_settings: {
        Row: {
          beat_title: string | null
          benefits: Json
          benefits_title: string | null
          checkout_copy: string | null
          eyebrow: string | null
          headline_template: string | null
          id: string
          intro_text: string | null
          price_display: string | null
          section_order: Json
          show_intro_text: boolean
          show_video_body: boolean
          show_video_cta: boolean
          subheadline: string | null
          updated_at: string
          video_body: string | null
          video_cta_text: string
          video_title: string | null
          video_url: string | null
        }
        Insert: {
          beat_title?: string | null
          benefits?: Json
          benefits_title?: string | null
          checkout_copy?: string | null
          eyebrow?: string | null
          headline_template?: string | null
          id?: string
          intro_text?: string | null
          price_display?: string | null
          section_order?: Json
          show_intro_text?: boolean
          show_video_body?: boolean
          show_video_cta?: boolean
          subheadline?: string | null
          updated_at?: string
          video_body?: string | null
          video_cta_text?: string
          video_title?: string | null
          video_url?: string | null
        }
        Update: {
          beat_title?: string | null
          benefits?: Json
          benefits_title?: string | null
          checkout_copy?: string | null
          eyebrow?: string | null
          headline_template?: string | null
          id?: string
          intro_text?: string | null
          price_display?: string | null
          section_order?: Json
          show_intro_text?: boolean
          show_video_body?: boolean
          show_video_cta?: boolean
          subheadline?: string | null
          updated_at?: string
          video_body?: string | null
          video_cta_text?: string
          video_title?: string | null
          video_url?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          birthday: string | null
          created_at: string
          credits_balance: number
          current_period_end: string | null
          display_name: string | null
          email: string | null
          full_name: string | null
          id: string
          music_link: string | null
          store_artwork_url: string | null
          store_bio: string | null
          store_buy_url: string | null
          store_donate_url: string | null
          store_name: string | null
          store_tracks: Json
          store_username: string | null
          stripe_customer_id: string | null
          subscription_status: string | null
          subscription_tier: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          birthday?: string | null
          created_at?: string
          credits_balance?: number
          current_period_end?: string | null
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          music_link?: string | null
          store_artwork_url?: string | null
          store_bio?: string | null
          store_buy_url?: string | null
          store_donate_url?: string | null
          store_name?: string | null
          store_tracks?: Json
          store_username?: string | null
          stripe_customer_id?: string | null
          subscription_status?: string | null
          subscription_tier?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          birthday?: string | null
          created_at?: string
          credits_balance?: number
          current_period_end?: string | null
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          music_link?: string | null
          store_artwork_url?: string | null
          store_bio?: string | null
          store_buy_url?: string | null
          store_donate_url?: string | null
          store_name?: string | null
          store_tracks?: Json
          store_username?: string | null
          stripe_customer_id?: string | null
          subscription_status?: string | null
          subscription_tier?: string
          updated_at?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          beat_id: string | null
          created_at: string
          credits_amount: number
          description: string | null
          id: string
          type: string
          user_id: string
        }
        Insert: {
          beat_id?: string | null
          created_at?: string
          credits_amount?: number
          description?: string | null
          id?: string
          type: string
          user_id: string
        }
        Update: {
          beat_id?: string | null
          created_at?: string
          credits_amount?: number
          description?: string | null
          id?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_beat_id_fkey"
            columns: ["beat_id"]
            isOneToOne: false
            referencedRelation: "beats"
            referencedColumns: ["id"]
          },
        ]
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
      whitelist_submissions: {
        Row: {
          admin_notes: string | null
          artist_name: string
          beat_id: string | null
          created_at: string
          id: string
          notes: string | null
          release_date: string | null
          status: string
          streaming_url: string
          track_title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          artist_name: string
          beat_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          release_date?: string | null
          status?: string
          streaming_url: string
          track_title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          artist_name?: string
          beat_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          release_date?: string | null
          status?: string
          streaming_url?: string
          track_title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_bulk_update_beats: {
        Args: {
          _bpm?: number
          _genre?: string
          _ids: string[]
          _is_member_only?: boolean
          _mood?: string
          _music_key?: string
        }
        Returns: number
      }
      admin_delete_beat_claim: { Args: { _id: string }; Returns: undefined }
      admin_delete_beat_request: { Args: { _id: string }; Returns: undefined }
      admin_gift_credits: {
        Args: { _amount: number; _note?: string; _user_id: string }
        Returns: Json
      }
      admin_import_beat: {
        Args: {
          _audio_url: string
          _bpm: number
          _cover_url: string
          _duration_seconds: number
          _genre: string
          _mood: string
          _music_key: string
          _producer_name: string
          _title: string
        }
        Returns: string
      }
      capture_funnel_lead: {
        Args: { _email: string; _ip?: string; _slug: string; _ua?: string }
        Returns: Json
      }
      claim_beat:
        | {
            Args: { _beat_id: string; _email: string; _source?: string }
            Returns: {
              beat_id: string
              expires_at: string
              reused: boolean
              token: string
            }[]
          }
        | {
            Args: {
              _beat_id: string
              _device_fingerprint?: string
              _email: string
              _ip_address?: string
              _source?: string
              _user_agent?: string
            }
            Returns: {
              beat_id: string
              expires_at: string
              reused: boolean
              token: string
            }[]
          }
      claim_invite: {
        Args: { _token: string; _user_id: string }
        Returns: Json
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      ensure_chat_thread: { Args: never; Returns: string }
      get_beat_offer: {
        Args: { _token: string }
        Returns: {
          audio_url: string
          audio_url_tagged: string
          beat_id: string
          bpm: number
          claim_id: string
          cover_url: string
          created_at: string
          duration_seconds: number
          email: string
          expires_at: string
          genre: string
          mood: string
          music_key: string
          producer_name: string
          purchased_at: string
          title: string
          token: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      list_claimable_beats: {
        Args: never
        Returns: {
          audio_url: string
          audio_url_tagged: string
          bpm: number
          cover_url: string
          created_at: string
          duration_seconds: number
          genre: string
          id: string
          mood: string
          music_key: string
          producer_name: string
          title: string
        }[]
      }
      list_my_exclusive_opportunities: {
        Args: never
        Returns: {
          beat_id: string
          beat_title: string
          bid_deadline: string
          bidder_count: number
          bpm: number
          cover_url: string
          current_high_bid: number
          genre: string
          minimum_bid: number
          my_bid: number
          request_id: string
          requested_amount: number
        }[]
      }
      make_beat_claim_token: { Args: never; Returns: string }
      mark_funnel_lead_forwarded: {
        Args: { _error?: string; _lead_id: string }
        Returns: undefined
      }
      mark_thread_read: {
        Args: { _as_admin?: boolean; _thread_id: string }
        Returns: undefined
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      place_exclusive_bid: {
        Args: { _amount: number; _note?: string; _request_id: string }
        Returns: Json
      }
      process_beat_download: {
        Args: { _beat_id: string; _file_type?: string }
        Returns: Json
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
