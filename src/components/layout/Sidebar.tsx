import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { SUPABASE_URL } from "../../lib/constants";
import { FileText, Loader2, X, Trash2 } from "lucide-react";
import type { Database } from "../../lib/database.types";

type Report = Database["public"]["Tables"]["reports"]["Row"];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  currentReportId?: string;
}

export default function Sidebar({ open, onClose, currentReportId }: SidebarProps) {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchReports();

    const sub = supabase
      .channel("reports_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reports" },
        () => fetchReports(),
      )
      .subscribe();

    return () => {
      sub.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchReports() {
    const { data, error } = await supabase
      .from("reports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);

    if (!error && data) {
      setReports(data);
    }
    setLoading(false);
  }

  const handleClick = (id: string) => {
    const report = reports.find((r) => r.id === id);
    if (report?.status === "completed") {
      navigate(`/report/${id}`);
    } else {
      navigate(`/research/${id}`);
    }
    onClose();
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Delete this report? This cannot be undone.")) return;

    setDeletingId(id);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/research?id=${id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            "Content-Type": "application/json",
          },
        },
      );

      // 404 means the report is already gone — treat as success
      if (res.status === 404) {
        setReports((prev) => prev.filter((r) => r.id !== id));
        return;
      }

      if (!res.ok) throw new Error(await res.text());
      setReports((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Failed to delete. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Drawer / desktop sidebar */}
      <aside
        className={`fixed md:sticky top-14 left-0 z-30 h-[calc(100vh-3.5rem)] w-72 border-r bg-background transition-transform duration-250 overflow-y-auto ${
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
        aria-label="Research history sidebar"
      >
        <div className="flex items-center justify-between p-4 pb-2">
          <h2 className="font-heading text-sm font-semibold tracking-tight">
            History
          </h2>
          <button
            onClick={onClose}
            className="btn-secondary !p-1.5 !rounded-full md:hidden"
            aria-label="Close sidebar"
          >
            <X size={14} />
          </button>
        </div>

        <div className="px-3 pb-4">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton h-16 rounded-lg" />
              ))}
            </div>
          ) : reports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText
                size={32}
                className="text-muted-foreground mb-3 opacity-40"
              />
              <p className="text-sm text-muted-foreground">
                No reports yet
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Your research history will appear here
              </p>
            </div>
          ) : (
            <ul className="space-y-1" role="list">
              {reports.map((report) => (
                <li key={report.id} className="group relative">
                  <button
                    onClick={() => handleClick(report.id)}
                    className={`w-full text-left rounded-lg px-3 py-2.5 pr-10 transition-colors hover:bg-muted ${
                      report.id === currentReportId
                        ? "bg-muted border border-border"
                        : ""
                    }`}
                  >
                    <p className="text-sm font-medium leading-snug line-clamp-2">
                      {report.question}
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      {report.status === "running" ? (
                        <Loader2 size={11} className="animate-spin text-primary" />
                      ) : report.status === "failed" ? (
                        <span className="h-2 w-2 rounded-full bg-destructive" />
                      ) : (
                        <span className="h-2 w-2 rounded-full bg-success" />
                      )}
                      <span>{formatDate(report.created_at)}</span>
                    </div>
                  </button>

                  {/* Delete button — visible on hover */}
                  <button
                    onClick={(e) => handleDelete(e, report.id)}
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
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </>
  );
}