import { useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useNavigate } from "react-router-dom";

export default function SearchBar() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setError(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke(
        "research",
        {
          body: { question: trimmed },
        },
      );

      if (invokeError) throw new Error(invokeError.message);

      const reportId = data?.report_id;
      if (!reportId) throw new Error("No report ID returned");

      navigate(`/research/${reportId}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to start research",
      );
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
      <div className="relative">
        <Search
          size={18}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask any research question…"
          disabled={loading}
          className="input !pl-11 !pr-14 !py-3.5 !text-base"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 btn-primary !py-1.5 !px-3 !text-xs"
        >
          {loading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            "Research"
          )}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}