export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      reports: {
        Row: {
          id: string;
          user_id: string;
          question: string;
          status: "running" | "completed" | "failed";
          summary: string | null;
          report_content: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          question: string;
          status?: "running" | "completed" | "failed";
          summary?: string | null;
          report_content?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          question?: string;
          status?: "running" | "completed" | "failed";
          summary?: string | null;
          report_content?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      research_steps: {
        Row: {
          id: string;
          report_id: string;
          step_order: number;
          step_type: string;
          label: string | null;
          status: "pending" | "running" | "completed" | "failed";
          detail: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          report_id: string;
          step_order: number;
          step_type: string;
          label?: string | null;
          status?: "pending" | "running" | "completed" | "failed";
          detail?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          report_id?: string;
          step_order?: number;
          step_type?: string;
          label?: string | null;
          status?: "pending" | "running" | "completed" | "failed";
          detail?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "research_steps_report_id_fkey";
            columns: ["report_id"];
            isOneToOne: false;
            referencedRelation: "reports";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}