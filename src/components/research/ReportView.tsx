import { ExternalLink, AlertTriangle, BookOpen } from "lucide-react";
import type { ReportContent } from "../../lib/types";

interface ReportViewProps {
  content: ReportContent;
  question: string;
  duration?: number;
}

export default function ReportView({
  content,
  question,
  duration,
}: ReportViewProps) {
  return (
    <article className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="font-heading text-2xl font-bold leading-tight">
          {question}
        </h2>
        {duration !== undefined && (
          <p className="mt-1 text-sm text-muted-foreground">
            Research completed in {duration}s
          </p>
        )}
      </div>

      {/* Executive Summary */}
      <section>
        <h3 className="font-heading text-lg font-semibold mb-3 flex items-center gap-2">
          <BookOpen size={18} className="text-primary" />
          Executive Summary
        </h3>
        <div className="card p-5">
          <p className="text-sm leading-relaxed">{content.summary}</p>
        </div>
      </section>

      {/* Key Findings */}
      <section>
        <h3 className="font-heading text-lg font-semibold mb-4">
          Key Findings
        </h3>
        <div className="space-y-4">
          {content.findings.map((finding, i) => (
            <div key={i} className="card p-5">
              <h4 className="font-heading font-medium text-base mb-2">
                {finding.sub_question}
              </h4>
              <ul className="space-y-1.5">
                {finding.points.map((point, j) => (
                  <li
                    key={j}
                    className="text-sm leading-relaxed flex gap-2"
                  >
                    <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                    <span>
                      {point}
                      {finding.citations.length > 0 && (
                        <sup className="ml-0.5 text-xs text-primary">
                          [{finding.citations.join(", ")}]
                        </sup>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Sources */}
      <section>
        <h3 className="font-heading text-lg font-semibold mb-4">Sources</h3>
        <div className="space-y-2">
          {content.sources.map((source, i) => (
            <div key={i} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    <span className="text-muted-foreground mr-1">
                      [{i + 1}]
                    </span>
                    {source.title}
                  </p>
                  {source.note && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {source.note}
                    </p>
                  )}
                </div>
                {source.url && (
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 text-primary hover:text-primary/80 transition-colors"
                    aria-label={`Open source ${i + 1}: ${source.title}`}
                  >
                    <ExternalLink size={14} />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Confidence Notes */}
      {content.confidence_notes.length > 0 && (
        <section>
          <h3 className="font-heading text-lg font-semibold mb-3 flex items-center gap-2">
            <AlertTriangle size={18} className="text-warning" />
            Confidence Notes
          </h3>
          <div className="card p-5 border-warning/30">
            <ul className="space-y-2">
              {content.confidence_notes.map((note, i) => (
                <li
                  key={i}
                  className="flex gap-2 text-sm leading-relaxed"
                >
                  <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-warning" />
                  {note}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </article>
  );
}