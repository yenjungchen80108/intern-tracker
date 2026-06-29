# Emily's Intern Prep HQ

A personal dashboard to plan your Summer 2027 SDE / Systems / Cloud internship search (Jul 2026 – Dec 2026):

- **Today** — overview stats + your half-year plan
- **LeetCode** — pre-loaded with your Top-125 list & progress from your Google Sheet (as of 6/28)
- **AlgoMonster** — pattern checklist mirroring algo.monster's curriculum (Two Pointers, DFS, Backtracking, Graph, DP, etc.)
- **CS 570 Topics** — chapter/topic checklist mapped from Jeff Erickson's *Algorithms* textbook, to sync with your USC CS570 audit
- **Applications** — a simple ATS-style pipeline tracker (saved → applied → interview → offer/rejected)
- **Job Boards** — one-click deep-link searches for SDE/Systems/Cloud intern roles on LinkedIn, Indeed, Handshake, Glassdoor, plus the community-maintained [SimplifyJobs Summer2027-Internships](https://github.com/SimplifyJobs/Summer2027-Internships) repo, which is the closest thing to a real "auto-fetch" feed (LinkedIn/Indeed/Handshake don't allow scraping without their official, paid APIs, so true auto-fetching isn't possible — the deep links + that repo are the practical substitute)

All progress is saved in your browser's `localStorage` — nothing leaves your machine. If you want the data to sync across devices, you'd need to add a small database (e.g. Vercel Postgres or Supabase) — not included here to keep this simple and free to host.

## Run locally

```bash
npm install
npm run dev
```

Visit http://localhost:3000

## Deploy to Vercel

**Option A — Vercel CLI**
```bash
npm i -g vercel
vercel
```
Follow the prompts (link/create a project, accept defaults). It'll give you a live URL.

**Option B — GitHub + Vercel dashboard**
1. Push this folder to a new GitHub repo.
2. Go to https://vercel.com/new, import the repo, accept defaults (Framework: Next.js), Deploy.

## Persistent storage with MongoDB

This app now syncs all progress (LeetCode, AlgoMonster, CS570, Applications) to MongoDB instead of only your browser's localStorage — so it survives across devices/browsers, and localStorage is just used as an instant offline cache.

**How it's wired:**
- `lib/mongodb.js` — connects using a `MONGODB_URI` env var (never exposed to the browser)
- `pages/api/state.js` — a Next.js API route: `GET /api/state` reads the whole saved state, `POST /api/state` saves one field (`leet`, `am`, `cs570`, or `jobs`)
- All data lives in **one document** in a `state` collection (this is a single-user app, so no auth/multi-user logic is needed)

**Setup:**
1. Copy `.env.local.example` to `.env.local` and paste in your real MongoDB connection string:
   ```
   MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
   MONGODB_DB=intern_tracker
   ```
2. If using MongoDB Atlas: make sure your current IP (or `0.0.0.0/0` for simplicity, since there's no sensitive personal data beyond your own job search notes) is allow-listed under Network Access.
3. `npm install` (pulls in the `mongodb` driver), then `npm run dev`.
4. Open the app — it'll read/write to your real database now. Check Atlas's "Collections" view and you should see a `state` document appear in the `intern_tracker` database after you check off your first item.

**Deploying to Vercel with MongoDB:**
- In your Vercel project settings → Environment Variables, add `MONGODB_URI` (and `MONGODB_DB` if you changed it from the default) — same values as your `.env.local`.
- Never commit `.env.local` to git (it's already in `.gitignore`).


- `data/leetcode125.json` — add/edit problems, mark `"done": true` and a `"date"` to mark solved.
- `data/algomonster.json` — edit the pattern checklist sections/items.
- `data/cs570.json` — edit chapters/topics to match your actual CS570 syllabus once you have it.

Edits to these files are just the **seed/default** data — once you check things off in the browser, your live progress lives in localStorage and won't be overwritten by re-editing the JSON (unless you clear browser storage).
