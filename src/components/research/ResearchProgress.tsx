import { CheckCircle2, Loader2, Circle, XCircle, type LucideIcon } from "lucide-react";
import type { Database } from "../../lib/database.types";

type Step = Database["public"]["Tables"]["research_steps"]["Row"];

const STEP_ICONS: Record<string, LucideIcon> = {
  running: Loader2,
  completed: CheckCircle2,
  failed: XCircle,
  pending: Circle,
};

const STEP_COLORS: Record<string, string> = {
  running: "text-primary",
  completed: "text-success",
  failed: "text-destructive",
  pending: "text-muted-foreground",
};

interface ResearchProgressProps {
  steps: Step[];
}

export default function ResearchProgress({ steps }: ResearchProgressProps) {
  if (steps.length === 0) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-16 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <ol className="space-y-3" role="list" aria-label="Research progress steps">
      {steps.map((step) => {
        const Icon = STEP_ICONS[step.status] || Circle;
        const color = STEP_COLORS[step.status] || "text-muted-foreground";
        const isActive = step.status === "running";
        const isPending = step.status === "pending";

        return (
          <li
            key={step.id}
            className={`card flex items-start gap-3 p-4 transition-all duration-300 ${
              isActive ? "glow-primary" : ""
            } ${isPending ? "opacity-50" : "opacity-100"}`}
          >
            <div className={`mt-0.5 flex-shrink-0 ${color}`}>
              <Icon
                size={20}
                className={isActive ? "animate-spin" : ""}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p
                className={`text-sm font-medium ${
                  isActive ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {step.label || step.step_type.replace(/_/g, " ")}
              </p>

              {/* Show detail content for completed steps */}
              {step.detail && step.status === "completed" && (
                <div className="mt-2 text-xs text-muted-foreground space-y-1">
                  {step.step_type === "break_down" &&
                    Array.isArray(
                      (step.detail as { sub_questions?: string[] })
                        ?.sub_questions,
                    ) && (
                      <ul className="list-disc list-inside space-y-0.5">
                        {(step.detail as { sub_questions: string[] }).sub_questions.map(
                          (sq, i) => (
                            <li key={i}>{sq}</li>
                          ),
                        )}
                      </ul>
                    )}
                  {step.step_type === "gather" && (
                    <div>
                      <span>
                        Searched{" "}
                        {(step.detail as { source_count?: number })
                          ?.source_count ?? 0}{" "}
                        sources
                      </span>
                      {(step.detail as { answers?: { sub_question: string }[] })
                        ?.answers?.length ? (
                        <ul className="list-disc list-inside mt-1 space-y-0.5">
                          {(step.detail as { answers: { sub_question: string; answer: string }[] }).answers.map((a, i) => (
                            <li key={i}>
                              <span className="font-medium">{a.sub_question}</span>
                              <span className="block ml-5 italic line-clamp-2">
                                {a.answer.slice(0, 120)}…
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  )}
                  {step.step_type === "cross_check" && (
                    <div>
                      <span>Claims compared across sources</span>
                      {(step.detail as { confidence_notes?: string[] })
                        ?.confidence_notes?.length ? (
                        <ul className="list-disc list-inside mt-1 space-y-0.5">
                          {(step.detail as { confidence_notes: string[] }).confidence_notes.map(
                            (note, i) => (
                              <li key={i}>{note}</li>
                            ),
                          )}
                        </ul>
                      ) : null}
                    </div>
                  )}
                  {step.step_type === "write" && <span>Report written</span>}
                </div>
              )}

              {step.status === "failed" && (
                <p className="mt-1 text-xs text-destructive">
                  {(step.detail as { message?: string })?.message ??
                    "Something went wrong"}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}