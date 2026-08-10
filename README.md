# Research-AI

Research Agent — Vite+React frontend with a Supabase edge function that uses OpenRouter to generate sourced research reports.

Author: moeez4316

## Quick description

This repo contains a Vite + React frontend (`src/`) and a Supabase Edge Function at `supabase/functions/research/index.ts` which calls OpenRouter to perform multi-step research (break down, gather, cross-check, write) and stores results in Supabase.

## Quickstart (PowerShell)

1. Install deps and run locally

```powershell
npm install
$env:OPENROUTER_API_KEY="<your_openrouter_key>"
$env:OPENROUTER_MODELS="openai/gpt-3.5-turbo"
npm run dev
# Open http://localhost:5173
```

2. Create GitHub repo and push (use your GitHub account)

If you have GitHub CLI installed:

```powershell
git add .
git commit -m "Initial commit"
gh repo create moeez4316/Research-AI --public --description "Research Agent — Vite+React + Supabase function" --source=. --remote=origin --push
```

Manual method (web UI):

```powershell
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/moeez4316/Research-AI.git
git push -u origin main
```

3. Deploy Supabase function

```powershell
npm i -g supabase
supabase login
# Set project ref in an env or use dashboard
supabase functions deploy research --project-ref <PROJECT_REF>
```

In Supabase dashboard, set Environment Variables for the function:
- `OPENROUTER_API_KEY` = your key
- `OPENROUTER_MODELS` = openai/gpt-3.5-turbo  (optional)
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (if needed)

4. Deploy frontend (Vercel quick steps)

- Import the GitHub repo in Vercel (https://vercel.com/new)
- Build command: `npm run build` (auto-detected)
- Output directory: `dist`
- Add environment variables in Project Settings (only public keys for frontend): `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (adjust names if your code expects different names)

Or use the Vercel CLI:

```powershell
npm i -g vercel
vercel login
vercel --prod
```

5. Example cURL to trigger research (replace URL and token):

```powershell
curl.exe -X POST "https://<your-supabase-function-url>/" -H "Authorization: Bearer <user-jwt-or-apikey>" -H "Content-Type: application/json" -d '{"question":"What are recent advances in renewable energy storage?"}'
```

## Notes and grading tips
- The backend uses OpenRouter and requires `OPENROUTER_API_KEY` to run research steps.
- I changed the default fallback models to `openai/gpt-3.5-turbo` to avoid paid-only models; you can override with `OPENROUTER_MODELS`.
- Provide a short demo script in your README for graders: open app, run a sample query, show DB rows and final report.

## Files to check
- `supabase/functions/research/index.ts` — backend pipeline and OpenRouter integration
- `src/pages/Research.tsx`, `src/components/research/ReportView.tsx` — frontend interaction

## License
MIT
