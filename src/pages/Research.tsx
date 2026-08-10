import { useParams, useNavigate, Navigate } from "react-router-dom";
import ResearchProgress from "../components/research/ResearchProgress";
import { useResearch } from "../hooks/useResearch";
import { supabase } from "../lib/supabase";
import { SUPABASE_URL } from "../lib/constants";
import { AlertTriangle, ArrowLeft, RotateCcw, Trash2, Loader2 } from "lucide-react";
import { useState } from "react";

export default function ResearchPage() {
  const { id } = useParams<{ id: string }>();
  const { report, steps, loading } = useResearch(id);
  const navigate = useNavigate();
  const [restarting, setRestarting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isComplete = report?.status === "completed";
  const isFailed = report?.status === "failed";

  const handleRetry = async () => {
    if (!id || !report) return;
    setRestarting(true);

    try {
      const { data, error } = await supabase.functions.invoke("research", {
        body: { question: report.question },
      });

      if (error) throw error;
      navigate(`/research/${data.report_id}`, { replace: true });
    } catch (err) {
      console.error("Retry failed:", err);
      setRestarting(false);
    }
  };

  const handleDelete = async () => {
    if (!id || !report) return;
    if (!confirm(`Delete this report? This cannot be undone.`)) return;

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

  if (isComplete && id) {
    return <Navigate to={`/report/${id}`} replace />;
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
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

      {report && (
        <h2 className="font-heading text-lg font-semibold mb-6 leading-snug">
          {report.question}
        </h2>
      )}

      {loading || (report && report.status === "running") ? (
        <p className="text-sm text-muted-foreground mb-4">
          Researching — this takes about 30–60 seconds...
        </p>
      ) : null}

      <ResearchProgress steps={steps} />

      {isFailed && (
        <div className="mt-6 card p-5 border-destructive/30">
          <div className="flex items-start gap-3">
            <AlertTriangle
              size={20}
              className="text-destructive flex-shrink-0 mt-0.5"
            />
            <div>
              <p className="text-sm font-medium">Research failed</p>
              <p className="text-xs text-muted-foreground mt-1">
                Something went wrong during the research process. You can try
                again.
              </p>
              <button
                onClick={handleRetry}
                disabled={restarting}
                className="btn-primary !text-xs !px-3 !py-1.5 mt-3 gap-1.5"
              >
                <RotateCcw size={12} />
                {restarting ? "Starting…" : "Retry"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}