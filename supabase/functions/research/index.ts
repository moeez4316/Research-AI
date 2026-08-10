import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// ─── Env ─────────────────────────────────────────────

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
// ─── OpenRouter model pool ─────────────────────────
// Primary model + fallbacks guarantee resilience when one provider is throttled.
// OpenRouter tries them in order until one succeeds.
// NOTE: OpenRouter caps the `models` array at 3 entries — keep this at 3 or fewer.
const OPENROUTER_MODELS_OVERRIDE = Deno.env.get("OPENROUTER_MODELS") ?? "";
// Prefer free / lower-cost models by default. If you need a different
// provider or model, set the `OPENROUTER_MODELS` env var (comma-separated,
// up to 3 entries) to override this list.
const FALLBACK_MODELS: string[] = [
  // Default to a single, lower-cost/free-tier model to avoid paid-only
  // providers. To use a different free model, set `OPENROUTER_MODELS`.
  "openai/gpt-3.5-turbo",
];

const OPENROUTER_MODELS: string[] = OPENROUTER_MODELS_OVERRIDE.trim()
  ? OPENROUTER_MODELS_OVERRIDE.split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 5)
      .slice(0, 3)
  : FALLBACK_MODELS;

// ─── CORS ────────────────────────────────────────────

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Authorization, apikey, Content-Type, x-client-info",
  "Access-Control-Max-Age": "86400",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

// ─── Auth ────────────────────────────────────────────

async function authenticate(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) throw new Error("Missing Authorization header");

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Unauthorized");
  return data.user;
}

// ─── DB helpers ─────────────────────────────────────

function admin() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
}

async function updateStep(
  db: ReturnType<typeof createClient>,
  stepId: string,
  status: string,
  detail?: unknown,
) {
  const update: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (detail !== undefined) update.detail = detail;
  await db.from("research_steps").update(update).eq("id", stepId);
}

// ─── OpenRouter helpers ─────────────────────────────

interface OpenRouterMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface OpenRouterPlugin {
  id: string;
  // engine: "firecrawl" uses the user's Firecrawl free-credit pool (10k on signup)
  // instead of the default Exa engine, which bills OpenRouter credits (~$0.007/search).
  engine?: "native" | "exa" | "firecrawl" | "parallel" | "perplexity";
  max_results?: number;
}

interface OpenRouterOptions {
  messages: OpenRouterMessage[];
  temperature?: number;
  response_format?: { type: "json_object" | "text" } | undefined;
  plugins?: OpenRouterPlugin[];
}

interface Citation {
  url: string;
  title: string;
  content: string;
  start_index?: number;
  end_index?: number;
}

interface OpenRouterResult {
  content: string;
  annotations: Citation[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Bounded retries: 429 (shared free pool / provider throttling) and 5xx are
// transient — back off and try again instead of failing the whole pipeline.
const MAX_ATTEMPTS = 3;
const MAX_RETRY_WAIT_MS = 15_000;
// OpenRouter + Firecrawl web searches can stall indefinitely without a timeout.
// 120 s gives the free-tier pool enough time for long web searches while
// preventing a single hung fetch from blocking the entire pipeline.
const FETCH_TIMEOUT_MS = 120_000;

// Best-effort parse of how long to wait before retrying, from either the
// Retry-After header or OpenRouter's error body (retry_after_seconds).
function parseRetryAfterMs(res: Response, bodyText: string): number | null {
  const header = res.headers.get("Retry-After");
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(seconds * 1000, MAX_RETRY_WAIT_MS);
    }
  }
  try {
    const body = JSON.parse(bodyText);
    const meta = body?.error?.metadata;
    const seconds = meta?.retry_after_seconds ?? meta?.retry_after_seconds_raw;
    if (typeof seconds === "number" && Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(seconds * 1000, MAX_RETRY_WAIT_MS);
    }
  } catch {
    // body isn't JSON — fall through
  }
  return null;
}

function backoffMs(attempt: number) {
  // Exponential: 1s, 2s, 4s… capped
  return Math.min(1000 * 2 ** (attempt - 1), MAX_RETRY_WAIT_MS);
}

async function callOpenRouter(
  opts: OpenRouterOptions,
): Promise<OpenRouterResult> {
  if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not set");

  // Send the whole free-tier pool: OpenRouter tries each model in order and
  // falls back automatically when one provider is rate-limited upstream.
  const body: Record<string, unknown> = {
    models: OPENROUTER_MODELS,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.6,
  };

  if (opts.response_format !== undefined) {
    body.response_format = opts.response_format;
  }

  if (opts.plugins && opts.plugins.length > 0) {
    body.plugins = opts.plugins;
  }

  let lastError: Error = new Error("OpenRouter request failed");

  // `res` MUST be declared outside the loop: it is read after the loop (for
  // response-body parsing), and a `let` inside the loop body is block-scoped
  // to that iteration — referencing it afterwards throws
  // "ReferenceError: res is not defined".
  let res: Response | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      try {
        res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            "HTTP-Referer": SUPABASE_URL,
            "X-OpenRouter-Title": "Personal Research Agent",
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
    } catch (err) {
      // Network hiccup (including AbortController timeout) — retryable
      const isTimeout =
        err instanceof DOMException && err.name === "AbortError";
      lastError = new Error(
        isTimeout
          ? `OpenRouter request timed out after ${FETCH_TIMEOUT_MS / 1000}s`
          : `OpenRouter network error: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
      if (attempt < MAX_ATTEMPTS) {
        const wait = backoffMs(attempt);
        console.warn(
          `OpenRouter network error (attempt ${attempt}/${MAX_ATTEMPTS}), retrying in ${wait}ms`,
        );
        await sleep(wait);
        continue;
      }
      throw lastError;
    }

    if (res.ok) break;

    const text = await res.text();

    // If json_object format is rejected by the model, retry without it
    if (
      opts.response_format?.type === "json_object" &&
      (res.status === 400 || res.status === 422)
    ) {
      return callOpenRouter({ ...opts, response_format: undefined });
    }

    // Rate limited (429) or transient server error (5xx) → back off and retry.
    // OpenRouter's shared free pool regularly 429s; the error body tells us
    // exactly how long to wait, and the models array handles provider routing.
    if ((res.status === 429 || res.status >= 500) && attempt < MAX_ATTEMPTS) {
      const wait = parseRetryAfterMs(res, text) ?? backoffMs(attempt);
      console.warn(
        `OpenRouter ${res.status} (attempt ${attempt}/${MAX_ATTEMPTS}), retrying in ${wait}ms: ${text.slice(0, 200)}`,
      );
      await sleep(wait);
      continue;
    }

    lastError = new Error(`OpenRouter error ${res.status}: ${text}`);
    throw lastError;
  }

  // Loop exited without a usable response (only reachable if every path
  // above somehow fell through) — surface the last error instead of crashing.
  if (!res) throw lastError;

  const responseBody = await res.json();
  const message = responseBody.choices?.[0]?.message;

  const rawAnnotations = message?.annotations ?? [];
  const annotations: Citation[] = rawAnnotations.map(
    (a: Record<string, unknown>) => {
      const uc = (a.url_citation as Record<string, unknown> | undefined) ?? a;
      return {
        url: String(uc.url ?? ""),
        title: String(uc.title ?? ""),
        content: String(uc.content ?? ""),
        start_index: Number(uc.start_index ?? -1),
        end_index: Number(uc.end_index ?? -1),
      };
    },
  ).filter((c: Citation) => c.url.length > 0);

  return {
    content: message?.content ?? "",
    annotations,
  };
}

async function jsonOrText(
  messages: OpenRouterMessage[],
): Promise<string> {
  const result = await callOpenRouter({
    messages,
    temperature: 0.6,
    response_format: { type: "json_object" },
  });
  return result.content;
}

// ─── Pipeline steps ─────────────────────────────────

interface SubQuestionAnswer {
  sub_question: string;
  answer: string;
  citations: Citation[];
}

interface BuildSourcesResult {
  sources: SourceItem[];
  findingsInput: FindingInput[];
}

interface SourceItem {
  title: string;
  url: string;
  note: string;
}

interface FindingInput {
  sub_question: string;
  answer: string;
  citations: number[];
}

function buildSourcesFromAnswers(
  answers: SubQuestionAnswer[],
): BuildSourcesResult {
  const sources: SourceItem[] = [];
  const urlToIdx = new Map<string, number>();
  const findingsInput: FindingInput[] = [];

  for (const a of answers) {
    const citationIndices: number[] = [];
    for (const c of a.citations) {
      const key = c.url;
      let idx = urlToIdx.get(key);
      if (idx === undefined) {
        idx = sources.length;
        urlToIdx.set(key, idx);
        sources.push({
          title: c.title || c.url,
          url: c.url,
          note: `Cited in: ${a.sub_question}`,
        });
      }
      citationIndices.push(idx);
    }
    findingsInput.push({
      sub_question: a.sub_question,
      answer: a.answer,
      citations: citationIndices,
    });
  }

  return { sources, findingsInput };
}

async function runPipeline(
  reportId: string,
  question: string,
) {
  const db = admin();

  const { data: steps } = await db
    .from("research_steps")
    .select("id, step_type")
    .eq("report_id", reportId)
    .order("step_order", { ascending: true });

  if (!steps || steps.length === 0) {
    await db.from("reports").update({ status: "failed" }).eq("id", reportId);
    return;
  }

  const stepMap = new Map(steps.map((s) => [s.step_type, s.id]));

  try {
    // ── Step 0: break_down ──────────────────────────
    const breakId = stepMap.get("break_down")!;
    await updateStep(db, breakId, "running");

    const subPrompt: OpenRouterMessage[] = [
      {
        role: "system",
        content:
          "You are a research assistant. Break the following question into exactly 3–4 focused sub-questions. " +
          'Return a JSON object with a "sub_questions" field containing an array of 3–4 strings, each one a clear, self-contained sub-question.',
      },
      { role: "user", content: question },
    ];

    const subResult = await jsonOrText(subPrompt);
    const parsed = JSON.parse(subResult);
    const subQuestions: string[] = (parsed.sub_questions ?? []).slice(0, 4);

    await updateStep(db, breakId, "completed", {
      sub_questions: subQuestions,
    });

    // ── Step 1: gather (search + answer per sub-question) ──
    const gatherId = stepMap.get("gather")!;
    await updateStep(db, gatherId, "running");

    const answers: SubQuestionAnswer[] = [];

    for (const sq of subQuestions) {
      try {
        const webResult = await callOpenRouter({
          messages: [
            {
              role: "user",
              content:
                `Research this question thoroughly and provide a factual, well-cited answer: ${sq}`,
            },
          ],
          temperature: 0.4,
          response_format: undefined,
          plugins: [{ id: "web", max_results: 5 }],
        });

        answers.push({
          sub_question: sq,
          answer: webResult.content,
          citations: webResult.annotations,
        });
      } catch (err) {
        answers.push({
          sub_question: sq,
          answer:
            `Could not research this sub-question: ${err instanceof Error ? err.message : "Unknown error"}`,
          citations: [],
        });
      }
    }

    const totalSources = answers.reduce(
      (sum, a) => sum + a.citations.length,
      0,
    );

    await updateStep(db, gatherId, "completed", {
      answers: answers.map((a) => ({
        sub_question: a.sub_question,
        answer: a.answer,
        citations: a.citations.map((c) => ({
          title: c.title,
          url: c.url,
          content: c.content.substring(0, 200),
        })),
      })),
      source_count: totalSources,
    });

    // ── Step 2: cross_check ──────────────────────────
    const crossId = stepMap.get("cross_check")!;
    await updateStep(db, crossId, "running");

    const crossPrompt: OpenRouterMessage[] = [
      {
        role: "system",
        content:
          "You are a fact-checker. Analyse the following research answers for conflicting claims, " +
          "weak evidence, or low-confidence areas across sub-questions. " +
          'Return a JSON object with a "notes" field containing an array of strings describing any contradictions, gaps, or issues found.',
      },
      {
        role: "user",
        content: JSON.stringify(
          answers.map((a) => ({
            sub_question: a.sub_question,
            answer: a.answer,
          })),
        ),
      },
    ];

    const crossResult = await jsonOrText(crossPrompt);
    const crossParsed = JSON.parse(crossResult);
    const confidenceNotes: string[] = crossParsed.notes ?? [];

    await updateStep(db, crossId, "completed", {
      confidence_notes: confidenceNotes,
    });

    // ── Step 3: write ────────────────────────────────
    const writeId = stepMap.get("write")!;
    await updateStep(db, writeId, "running");

    // Build deduplicated sources and citation mappings
    const { sources, findingsInput } = buildSourcesFromAnswers(answers);

    const writePrompt: OpenRouterMessage[] = [
      {
        role: "system",
        content:
          "You are a report writer. Synthesise the following research into a well-structured, professional report. " +
          "Return a JSON object with this exact structure:\n" +
          "{\n" +
          '  "summary": "2–3 paragraph executive summary covering the main conclusions",\n' +
          '  "findings": [\n' +
          "    {\n" +
          '      "sub_question": "the sub-question",\n' +
          '      "points": ["concise bullet point synthesising the answer. Do NOT include citation markers in the text."],\n' +
          '      "citations": [0, 1]  // only integer indices into the Sources list below\n' +
          "    }\n" +
          "  ],\n" +
          '  "confidence_notes": ["list of contradictions, gaps, or caveats from the cross-checking"]\n' +
          "}\n\n" +
          "Rules:\n" +
          "- Each finding's citations array must contain only integer indices from the provided Sources list.\n" +
          "- Do NOT add citation markers like [1] or (source) in the points text — the citations array is the authoritative reference.\n" +
          "- The points should be 2–4 clear, standalone sentences per sub-question.\n" +
          "- The summary should concisely answer the original question, referencing key findings.\n" +
          "- The confidence_notes should incorporate the cross-check notes where applicable.",
      },
      {
        role: "user",
        content: JSON.stringify({
          question,
          sub_question_answers: findingsInput.map((fi) => ({
            sub_question: fi.sub_question,
            answer: fi.answer,
            citations: fi.citations,
          })),
          sources: sources.map((s, i) => ({
            index: i,
            title: s.title,
            url: s.url,
          })),
          cross_check_notes: confidenceNotes,
        }),
      },
    ];

    const writeResult = await jsonOrText(writePrompt);
    const writeParsed = JSON.parse(writeResult);

    // Ensure findings use only valid source indices
    const validIndices = new Set(sources.map((_, i) => i));
    const findings = (writeParsed.findings ?? []).map(
      (f: { sub_question?: string; points?: string[]; citations?: number[] }) => ({
        sub_question: f.sub_question ?? "",
        points: f.points ?? [],
        citations: (f.citations ?? []).filter((c: number) => validIndices.has(c)),
      }),
    );

    await updateStep(db, writeId, "completed", { message: "Report written" });

    // Mark report as completed
    const reportContent = {
      summary: writeParsed.summary ?? "",
      findings,
      sources: sources.map((s) => ({
        title: s.title,
        url: s.url,
        note: s.note,
      })),
      confidence_notes: writeParsed.confidence_notes ?? confidenceNotes,
    };

    await db
      .from("reports")
      .update({
        status: "completed",
        summary: reportContent.summary,
        report_content: reportContent,
        updated_at: new Date().toISOString(),
      })
      .eq("id", reportId);
  } catch (err) {
    console.error("Pipeline failed:", err);

    for (const [, sid] of stepMap) {
      const { data: step } = await db
        .from("research_steps")
        .select("status")
        .eq("id", sid)
        .single();

      if (step && step.status === "running") {
        await updateStep(db, sid, "failed", {
          message: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    await db
      .from("reports")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("id", reportId);
  }
}

// ─── Handlers ────────────────────────────────────────

async function handlePost(req: Request, userId: string) {
  const { question } = await req.json();
  if (!question || typeof question !== "string" || !question.trim()) {
    return json({ error: "Question is required" }, 400);
  }

  const db = admin();

  const { data: report, error: reportError } = await db
    .from("reports")
    .insert({ user_id: userId, question: question.trim(), status: "running" })
    .select()
    .single();

  if (reportError) return json({ error: reportError.message }, 500);

  const stepDefs = [
    {
      step_order: 0,
      step_type: "break_down",
      label: "Decomposing question…",
      status: "pending",
    },
    {
      step_order: 1,
      step_type: "gather",
      label: "Searching & analysing sources…",
      status: "pending",
    },
    {
      step_order: 2,
      step_type: "cross_check",
      label: "Cross-checking answers…",
      status: "pending",
    },
    {
      step_order: 3,
      step_type: "write",
      label: "Synthesising report…",
      status: "pending",
    },
  ];

  const { error: stepsError } = await db
    .from("research_steps")
    .insert(stepDefs.map((s) => ({ ...s, report_id: report.id })));

  if (stepsError) return json({ error: stepsError.message }, 500);

  EdgeRuntime.waitUntil(runPipeline(report.id, question.trim()));

  return json({ report_id: report.id }, 202);
}

async function handleDelete(req: Request, userId: string) {
  const url = new URL(req.url);
  const reportId = url.searchParams.get("id");
  if (!reportId) return json({ error: "Missing id query param" }, 400);

  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Verify the report belongs to this user before deleting
  const { data: report, error: findError } = await db
    .from("reports")
    .select("id")
    .eq("id", reportId)
    .eq("user_id", userId)
    .single();

  if (findError || !report) {
    return json({ error: "Report not found" }, 404);
  }

  const { error: deleteError } = await db
    .from("reports")
    .delete()
    .eq("id", reportId);

  if (deleteError) return json({ error: deleteError.message }, 500);

  return json({ success: true });
}

async function handleGet(req: Request, userId: string) {
  const url = new URL(req.url);
  const reportId = url.searchParams.get("id");
  if (!reportId) return json({ error: "Missing id query param" }, 400);

  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: report, error: reportError } = await db
    .from("reports")
    .select("*")
    .eq("id", reportId)
    .eq("user_id", userId)
    .single();

  if (reportError) return json({ error: "Report not found" }, 404);

  const { data: steps, error: stepsError } = await db
    .from("research_steps")
    .select("*")
    .eq("report_id", reportId)
    .order("step_order", { ascending: true });

  if (stepsError) return json({ error: stepsError.message }, 500);

  return json({ report, steps });
}

// ─── Main handler ────────────────────────────────────

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: CORS_HEADERS,
      status: 204,
    });
  }

  try {
    const user = await authenticate(req);

    if (req.method === "POST") {
      return handlePost(req, user.id);
    }

    if (req.method === "GET") {
      return handleGet(req, user.id);
    }

    if (req.method === "DELETE") {
      return handleDelete(req, user.id);
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    const status =
      msg === "Unauthorized" || msg === "Missing Authorization header"
        ? 401
        : 500;
    return json({ error: msg }, status);
  }
});