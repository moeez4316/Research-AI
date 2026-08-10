import { useParams, useNavigate } from "react-router-dom";
import ReportView from "../components/research/ReportView";
import { useResearch } from "../hooks/useResearch";
import { supabase } from "../lib/supabase";
import { SUPABASE_URL } from "../lib/constants";
import { ArrowLeft, Trash2, Loader2 } from "lucide-react";
import { useState } from "react";
import type { ReportContent } from "../lib/types";

export default function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const { report, steps, loading } = useResearch(id);
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!id || !report) return;
    if (!confirm(`Delete "${report.question}"? This cannot be undone.`)) return;

    setDeleting(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/research?id=${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          "Content-Type": "application/json",
        },
      });
      if (!res.ok) throw new Error(await res.text());
      navigate("/", { replace: true });
    } catch (err) {
      console.error("Delete failed:", err);
      alert("We couldn't delete this report — please try again.");
      setDeleting(false);
    }
  };

  const backBar = (
    <div className="flex items-center justify-between mb-6">
      <button
        onClick={() => navigate("/")}
        className="btn-secondary !text-xs !px-3 !py-1.5 gap-1.5"
      >
        <ArrowLeft size={14} />
        Back
      </button>

      {report && (
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="btn-secondary !text-xs !px-3 !py-1.5 gap-1.5 text-destructive hover:bg-destructive/10"
        >
          {deleting ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Trash2 size={14} />
          )}
          Delete
        </button>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        {backBar}
        <div className="space-y-4">
          <div className="skeleton h-8 w-3/4 rounded-lg" />
          <div className="skeleton h-48 rounded-lg" />
          <div className="skeleton h-32 rounded-lg" />
        </div>
      </div>
    );
  }

  if (!report || report.status !== "completed") {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        {backBar}
        <div className="card p-10 text-center">
          <p className="text-muted-foreground">
            {report?.status === "running"
              ? "Research is still in progress — check back shortly."
              : "Report not found."}
          </p>
        </div>
      </div>
    );
  }

  const reportContent = report.report_content as ReportContent | null;

  const completedSteps = steps.filter((s) => s.status === "completed");
  const duration =
    completedSteps.length > 0
      ? Math.round(
          (new Date(
            completedSteps[completedSteps.length - 1].updated_at,
          ).getTime() -
            new Date(completedSteps[0].created_at).getTime()) /
            1000,
        )
      : undefined;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {backBar}

      {reportContent ? (
        <ReportView
          content={reportContent}
          question={report.question}
          duration={duration}
        />
      ) : (
        <div className="card p-10 text-center">
          <p className="text-muted-foreground">
            Report content is not available.
          </p>
        </div>
      )}
    </div>
  );
}