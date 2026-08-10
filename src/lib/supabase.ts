import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const supabaseUrl = "https://zlnqahvhpqetlcuanfyq.supabase.co";
const publishableKey =
  "sb_publishable_YIvOPocZuoIOTS43my33GA_E88OKEEt";

export const supabase = createClient<Database>(supabaseUrl, publishableKey, {
  auth: {
    flowType: "implicit",
    autoRefreshToken: true,
    persistSession: true,
  },
});