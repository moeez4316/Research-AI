import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { POLL_INTERVAL_MS } from "../lib/constants";
import type { Database } from "../lib/database.types";

type Report = Database["public"]["Tables"]["reports"]["Row"];
type Step = Database["public"]["Tables"]["research_steps"]["Row"];

export interface ResearchState {
  report: Report | null;
  steps: Step[];
  loading: boolean;
}

export function useResearch(reportId: string | undefined) {
  const [state, setState] = useState<ResearchState>({
    report: null,
    steps: [],
    loading: true,
  });
  const pollingRef = useRef<number | null>(null);

  const fetchReport = useCallback(async () => {
    if (!reportId) return;
    try {
      const { data: report, error: reportError } = await supabase
        .from("reports")
        .select("*")
        .eq("id", reportId)
        .single();

      if (reportError) throw reportError;

      const { data: steps, error: stepsError } = await supabase
        .from("research_steps")
        .select("*")
        .eq("report_id", reportId)
        .order("step_order", { ascending: true });

      if (stepsError) throw stepsError;

      setState({ report, steps: steps ?? [], loading: false });

      // Stop polling if report is in a terminal state
      if (report?.status === "completed" || report?.status === "failed") {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      }
    } catch (err) {
      console.error("Failed to fetch research state:", err);
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, [reportId]);

  useEffect(() => {
    if (!reportId) {
      setState({ report: null, steps: [], loading: false });
      return;
    }

    // Fetch immediately
    fetchReport();

    // Start polling
    pollingRef.current = window.setInterval(fetchReport, POLL_INTERVAL_MS);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [reportId, fetchReport]);

  return state;
}