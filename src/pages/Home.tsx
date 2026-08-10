import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import SearchBar from "../components/research/SearchBar";
import { supabase } from "../lib/supabase";
import { SUPABASE_URL } from "../lib/constants";
import { Clock, ArrowRight, Trash2, Loader2 } from "lucide-react";
import type { Database } from "../lib/database.types";

type Report = Database["public"]["Tables"]["reports"]["Row"];

export default function Home() {
  const [recentReports, setRecentReports] = useState<Report[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Fetch recent completed reports
    supabase
      .from("reports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data }) => {
        if (data) setRecentReports(data);
      });
  }, []);

  const formatDate = (d: string) => {
    const date = new Date(d);
    const now = new Date();
    const diffMins = Math.floor((now.getTime() - date.getTime()) / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  const handleReportClick = (report: Report) => {
    if (report.status === "completed") {
      navigate(`/report/${report.id}`);
    } else {
      navigate(`/research/${report.id}`);
    }
  };

  const handleDelete = async (e: React.MouseEvent, report: Report) => {
    e.stopPropagation();
    if (!confirm(`Delete "${report.question}"? This cannot be undone.`)) return;

    setDeletingId(report.id);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/research?id=${report.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            "Content-Type": "application/json",
          },
        },
      );
      if (!res.ok) throw new Error(await res.text());
      setRecentReports((prev) => prev.filter((r) => r.id !== report.id));
    } catch (err) {
      console.error("Delete failed:", err);
      alert("We couldn't delete that report — please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] px-4 py-16">
      <div className="w-full max-w-2xl text-center mb-10">
        <h1 className="font-heading text-3xl font-bold tracking-tight mb-3">
          What would you like to research?
        </h1>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">
          Ask any question and get a thorough, sourced report. I break it down,
          search the web, cross-check sources, and write it up.
        </p>
      </div>

      <SearchBar />

      {/* How it works */}
      <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-xl text-center">
        {[
          { step: 1, label: "I search", desc: "Find relevant sources" },
          { step: 2, label: "I cross-check", desc: "Compare claims" },
          { step: 3, label: "I write", desc: "Synthesise the report" },
        ].map(({ step, label, desc }) => (
          <div key={step} className="flex flex-col items-center gap-1">
            <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
              {step}
            </div>
            <p className="text-sm font-medium">{label}</p>
            <p className="text-xs text-muted-foreground">{desc}</p>
          </div>
        ))}
      </div>

      {/* Recent reports */}
      {recentReports.length > 0 && (
        <div className="mt-12 w-full max-w-xl">
          <h2 className="font-heading text-sm font-semibold mb-3 flex items-center gap-2">
            <Clock size={14} />
            Recent reports
          </h2>
          <div className="space-y-1.5">
            {recentReports.map((report) => (
              <div
                key={report.id}
                className="group card relative overflow-hidden"
              >
                <button
                  onClick={() => handleReportClick(report)}
                  className="w-full text-left p-3 pr-12 flex items-center justify-between gap-3 hover:bg-muted transition-colors cursor-pointer"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {report.question}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(report.created_at)}
                    </p>
                  </div>
                  <ArrowRight size={14} className="flex-shrink-0 text-muted-foreground" />
                </button>

                <button
                  onClick={(e) => handleDelete(e, report)}
                  disabled={deletingId === report.id}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-all duration-150"
                  aria-label={`Delete report: ${report.question}`}
                >
                  {deletingId === report.id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Trash2 size={14} />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}