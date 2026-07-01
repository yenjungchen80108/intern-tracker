import { useEffect, useMemo, useState } from "react";
import leetSeed from "../data/leetcode125.json";
import amSeed from "../data/algomonster.json";
import cs570Seed from "../data/cs570.json";

const LS_KEYS = {
  leet: "intern_leet_v1",
  am: "intern_am_v1",
  cs570: "intern_cs570_v1",
  jobs: "intern_jobs_v1",
  tab: "intern_tab_v1",
};

// One shared GET so we don't fire 4 separate requests on load.
let _remoteStatePromise = null;
function fetchRemoteStateOnce() {
  if (!_remoteStatePromise) {
    _remoteStatePromise = fetch("/api/state")
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}));
  }
  return _remoteStatePromise;
}

// Synced state: tries MongoDB (via /api/state) first, falls back to
// localStorage cache, falls back to seed data. Writes go to both
// localStorage (instant, offline-safe) and MongoDB (debounced).
function useSyncedState(key, seedFactory, migrate) {
  const [state, setState] = useState(seedFactory);
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useState({ current: null })[0];
  const apply = (v) => (migrate ? migrate(v, seedFactory()) : v);

  useEffect(() => {
    let cancelled = false;

    // 1. instant local cache so UI isn't empty while we wait on network
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) setState(apply(JSON.parse(raw)));
    } catch (e) {}

    // 2. then check MongoDB for the source of truth
    fetchRemoteStateOnce().then((remote) => {
      if (cancelled) return;
      if (remote && remote[key] !== undefined) {
        setState(apply(remote[key]));
      }
      setLoaded(true);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(state));
    } catch (e) {}

    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch("/api/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value: state }),
      }).catch(() => {
        /* offline — localStorage cache still has it */
      });
    }, 600); // debounce so rapid checkbox clicks don't spam the API

    return () => clearTimeout(saveTimer.current);
  }, [state, loaded, key, saveTimer]);

  return [state, setState, loaded];
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

const JOB_BOARDS = [
  {
    title: "LinkedIn Jobs",
    desc: "SWE / SDE intern Summer 2027, posted last 24h",
    url: "https://www.linkedin.com/jobs/search/?keywords=Software%20Engineer%20Intern%20Summer%202027&f_TPR=r86400&sortBy=DD",
  },
  {
    title: "Indeed",
    desc: "Software engineer intern 2027, last 24h",
    url: "https://www.indeed.com/jobs?q=software+engineer+intern+2027&fromage=1&sort=date",
  },
  {
    title: "Handshake",
    desc: "Search SWE/SRE/Cloud internships (USC account)",
    url: "https://app.joinhandshake.com/job_search/new?query=software%20engineer%20intern%202027",
  },
  {
    title: "SimplifyJobs Summer2027-Internships (GitHub)",
    desc: 'Community-maintained, auto-updated list of new SWE internship postings — closest thing to an "auto-fetch" feed',
    url: "https://github.com/SimplifyJobs/Summer2027-Internships",
  },
  {
    title: "Glassdoor",
    desc: "Software engineer intern 2027",
    url: "https://www.glassdoor.com/Job/united-states-software-engineer-intern-2027-jobs-SRCH_IL.0,13_IN1_KO14,40.htm",
  },
  {
    title: "LinkedIn — Cloud/SRE intern",
    desc: "Cloud, DevOps, SRE intern Summer 2027",
    url: "https://www.linkedin.com/jobs/search/?keywords=Cloud%20Engineer%20Intern%20Summer%202027&f_TPR=r86400&sortBy=DD",
  },
  {
    title: "LinkedIn — Systems intern",
    desc: "Systems / distributed systems / infra intern Summer 2027",
    url: "https://www.linkedin.com/jobs/search/?keywords=Systems%20Engineer%20Intern%20Summer%202027&f_TPR=r86400&sortBy=DD",
  },
  {
    title: "USC Viterbi Career Connections (Handshake SSO)",
    desc: "School-specific postings, often higher response rate",
    url: "https://viterbicareers.usc.edu/",
  },
];

const STATUS_OPTS = ["saved", "applied", "interview", "offer", "rejected"];

function migrateCs570(saved, freshSeed) {
  if (!Array.isArray(saved)) return freshSeed;
  const doneByTitle = {};
  saved.forEach((ch) =>
    (ch.topics || []).forEach((t) => {
      doneByTitle[t.title] = t.done;
    }),
  );
  return freshSeed.map((ch) => ({
    ...ch,
    topics: ch.topics.map((t) => ({ ...t, done: !!doneByTitle[t.title] })),
  }));
}

export default function Home() {
  const [tab, setTab] = useState("today");
  const [leet, setLeet] = useSyncedState(LS_KEYS.leet, () => leetSeed);
  const [am, setAm] = useSyncedState(LS_KEYS.am, () =>
    amSeed.map((sec) => ({
      ...sec,
      items: sec.items.map((t) => ({ title: t, done: false })),
    })),
  );
  const [cs570, setCs570] = useSyncedState(
    LS_KEYS.cs570,
    () =>
      cs570Seed.map((ch) => ({
        ...ch,
        topics: ch.topics.map((t) => ({ title: t, done: false })),
      })),
    migrateCs570,
  );
  const [jobs, setJobs] = useSyncedState(LS_KEYS.jobs, () => []);
  const [jobForm, setJobForm] = useState({
    company: "",
    role: "",
    status: "saved",
    date: todayStr(),
    link: "",
    notes: "",
  });
  const [leetFilter, setLeetFilter] = useState("all");
  const [newLeetTitle, setNewLeetTitle] = useState("");

  useEffect(() => {
    try {
      const t = window.localStorage.getItem(LS_KEYS.tab);
      if (t) setTab(t);
    } catch (e) {}
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem(LS_KEYS.tab, tab);
    } catch (e) {}
  }, [tab]);

  const leetDone = leet.filter((x) => x.done).length;
  const amTotal = am.reduce((a, s) => a + s.items.length, 0);
  const amDone = am.reduce(
    (a, s) => a + s.items.filter((i) => i.done).length,
    0,
  );
  const cs570Total = cs570.reduce((a, c) => a + c.topics.length, 0);
  const cs570Done = cs570.reduce(
    (a, c) => a + c.topics.filter((t) => t.done).length,
    0,
  );

  const jobStats = useMemo(() => {
    const out = { saved: 0, applied: 0, interview: 0, offer: 0, rejected: 0 };
    jobs.forEach((j) => {
      out[j.status] = (out[j.status] || 0) + 1;
    });
    return out;
  }, [jobs]);

  function toggleLeet(id) {
    setLeet((prev) =>
      prev.map((x) =>
        x.id === id
          ? {
              ...x,
              done: !x.done,
              date: !x.done ? x.date || todayStr() : x.date,
            }
          : x,
      ),
    );
  }
  function setLeetDate(id, date) {
    setLeet((prev) => prev.map((x) => (x.id === id ? { ...x, date } : x)));
  }
  function setLeetDesc(id, description) {
    setLeet((prev) =>
      prev.map((x) => (x.id === id ? { ...x, description } : x)),
    );
  }
  function addLeetProblem(title) {
    if (!title.trim()) return;
    setLeet((prev) => {
      const nextId = prev.length ? Math.max(...prev.map((x) => x.id)) + 1 : 1;
      return [
        ...prev,
        { id: nextId, title: title.trim(), date: null, done: false },
      ];
    });
  }
  function deleteLeetProblem(id) {
    setLeet((prev) => prev.filter((x) => x.id !== id));
  }
  function toggleAm(secIdx, itemIdx) {
    setAm((prev) => {
      const next = prev.map((s) => ({
        ...s,
        items: s.items.map((i) => ({ ...i })),
      }));
      next[secIdx].items[itemIdx].done = !next[secIdx].items[itemIdx].done;
      return next;
    });
  }
  function toggleCs570(chIdx, tIdx) {
    setCs570((prev) => {
      const next = prev.map((c) => ({
        ...c,
        topics: c.topics.map((t) => ({ ...t })),
      }));
      next[chIdx].topics[tIdx].done = !next[chIdx].topics[tIdx].done;
      return next;
    });
  }
  function addJob(e) {
    e.preventDefault();
    if (!jobForm.company.trim()) return;
    setJobs((prev) => [{ id: Date.now(), ...jobForm }, ...prev]);
    setJobForm({
      company: "",
      role: "",
      status: "saved",
      date: todayStr(),
      link: "",
      notes: "",
    });
  }
  function updateJobStatus(id, status) {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, status } : j)));
  }
  function deleteJob(id) {
    setJobs((prev) => prev.filter((j) => j.id !== id));
  }

  const visibleLeet = leet.filter((x) => {
    if (leetFilter === "all") return true;
    if (leetFilter === "done") return x.done;
    if (leetFilter === "todo") return !x.done;
    return true;
  });

  return (
    <div className="app">
      <div className="header">
        <div>
          <h1>Emily's Intern Prep HQ</h1>
          <div className="sub">
            Summer 2027 SDE / Systems / Cloud internship grind — LeetCode ·
            AlgoMonster · CS570 · Applications
          </div>
        </div>
        <div className="sub">{todayStr()}</div>
      </div>

      <div className="tabs">
        {[
          ["today", "Today"],
          ["leet", "LeetCode"],
          ["am", "AlgoMonster"],
          ["cs570", "CS 570 Topics"],
          ["jobs", "Applications"],
          ["boards", "Job Boards"],
        ].map(([key, label]) => (
          <div
            key={key}
            className={`tab ${tab === key ? "active" : ""}`}
            onClick={() => setTab(key)}
          >
            {label}
          </div>
        ))}
      </div>

      {tab === "today" && (
        <>
          <div className="card">
            <h2>Overview</h2>
            <div className="stats-row">
              <div className="stat">
                <div className="n">
                  {leetDone}/{leet.length}
                </div>
                <div className="l">LeetCode solved</div>
              </div>
              <div className="stat">
                <div className="n">
                  {amDone}/{amTotal}
                </div>
                <div className="l">AlgoMonster topics</div>
              </div>
              <div className="stat">
                <div className="n">
                  {cs570Done}/{cs570Total}
                </div>
                <div className="l">CS570 topics covered</div>
              </div>
              <div className="stat">
                <div className="n">{jobs.length}</div>
                <div className="l">Applications tracked</div>
              </div>
              <div className="stat">
                <div className="n">{jobStats.interview || 0}</div>
                <div className="l">In interview stage</div>
              </div>
              <div className="stat">
                <div className="n">{jobStats.offer || 0}</div>
                <div className="l">Offers</div>
              </div>
            </div>
          </div>

          <div className="card">
            <h2>Daily goal: solve ≥ 1 LeetCode problem</h2>
            <p className="sub" style={{ marginTop: -6 }}>
              Next unsolved problems from your Top-100/125 list:
            </p>
            <ul>
              {leet
                .filter((x) => !x.done)
                .slice(0, 5)
                .map((x) => (
                  <li key={x.id}>
                    <a
                      target="_blank"
                      rel="noreferrer"
                      href={`https://leetcode.com/problemset/all/?search=${encodeURIComponent(x.title)}`}
                    >
                      {x.id}. {x.title}
                    </a>
                  </li>
                ))}
            </ul>
            <p className="sub">
              Pair each problem with the matching AlgoMonster pattern page (see
              AlgoMonster tab) before/after solving.
            </p>
          </div>

          <div className="card">
            <h2>This half-year plan (Jul 1 – Dec 31, 2026)</h2>
            <ul>
              <li>
                <b>Jul–Aug:</b> Full-time grind — finish Top 125 + AlgoMonster
                core patterns; start applying as Fall postings open (most Summer
                2027 postings open Jul–Oct).
              </li>
              <li>
                <b>Late Aug:</b> USC CS 570 (Analysis of Algorithms) + CS 596
                begin — sync CS570 tab topics with weekly lectures.
              </li>
              <li>
                <b>Sep–Dec:</b> Maintain 1+ LeetCode/day, weekly mock interview,
                keep applying continuously; OAs season peaks Sep–Nov.
              </li>
              <li>
                <b>Ongoing:</b> Check Job Boards tab daily (2 min habit) + watch
                SimplifyJobs repo for new postings.
              </li>
            </ul>
          </div>
        </>
      )}

      {tab === "leet" && (
        <div className="card">
          <h2>
            LeetCode Tracker ({leetDone}/{leet.length})
          </h2>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${(leetDone / leet.length) * 100}%` }}
            />
          </div>
          <div className="toolbar">
            <button
              className={`btn ${leetFilter === "all" ? "" : "secondary"}`}
              onClick={() => setLeetFilter("all")}
            >
              All
            </button>
            <button
              className={`btn ${leetFilter === "todo" ? "" : "secondary"}`}
              onClick={() => setLeetFilter("todo")}
            >
              To-do
            </button>
            <button
              className={`btn ${leetFilter === "done" ? "" : "secondary"}`}
              onClick={() => setLeetFilter("done")}
            >
              Done
            </button>
          </div>
          <form
            className="toolbar"
            onSubmit={(e) => {
              e.preventDefault();
              addLeetProblem(newLeetTitle);
              setNewLeetTitle("");
            }}
          >
            <input
              type="text"
              placeholder="新增題目，例如：542. 01 Matrix｜BFS/矩陣"
              value={newLeetTitle}
              onChange={(e) => setNewLeetTitle(e.target.value)}
              style={{ minWidth: 320 }}
            />
            <button className="btn" type="submit">
              新增題目
            </button>
          </form>
          <table>
            <thead>
              <tr>
                <th></th>
                <th>#</th>
                <th>Problem</th>
                <th>Date</th>
                <th>Description（解法筆記）</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visibleLeet.map((x) => (
                <tr key={x.id} className={x.done ? "done" : ""}>
                  <td>
                    <input
                      type="checkbox"
                      checked={x.done}
                      onChange={() => toggleLeet(x.id)}
                    />
                  </td>
                  <td className="nostrike">{x.id}</td>
                  <td>
                    <a
                      target="_blank"
                      rel="noreferrer"
                      href={`https://leetcode.com/problemset/all/?search=${encodeURIComponent(x.title)}`}
                    >
                      {x.title}
                    </a>
                  </td>
                  <td>
                    <input
                      type="text"
                      placeholder="M/D"
                      value={x.date || ""}
                      onChange={(e) => setLeetDate(x.id, e.target.value)}
                      style={{ width: 64, padding: "3px 6px" }}
                    />
                  </td>
                  <td className="nostrike">
                    <textarea
                      placeholder=""
                      value={x.description || ""}
                      onChange={(e) => setLeetDesc(x.id, e.target.value)}
                      rows={3}
                      style={{
                        width: "100%",
                        minWidth: 240,
                        padding: "4px 8px",
                        resize: "vertical",
                        lineHeight: "1.5",
                      }}
                    />
                  </td>
                  <td className="nostrike">
                    <button
                      className="btn danger"
                      onClick={() => deleteLeetProblem(x.id)}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="sub">
            這份清單就是你的主要刷題進度紀錄了——直接在這裡勾選、編輯日期、新增/刪除題目即可,不用再回去維護
            Excel/Google Sheet。
          </p>
        </div>
      )}

      {tab === "am" && (
        <div className="card">
          <h2>
            AlgoMonster Pattern Coverage ({amDone}/{amTotal})
          </h2>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${(amDone / amTotal) * 100}%` }}
            />
          </div>
          <div className="grid-cols">
            {am.map((sec, si) => {
              const d = sec.items.filter((i) => i.done).length;
              return (
                <div
                  key={sec.section}
                  style={{
                    background: "#1a1d24",
                    border: "1px solid #2a2e38",
                    borderRadius: 10,
                    padding: 12,
                  }}
                >
                  <div className="section-title">
                    {sec.section} ({d}/{sec.items.length})
                  </div>
                  {sec.items.map((it, ii) => (
                    <div
                      key={ii}
                      className={`checklist-item ${it.done ? "done" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={it.done}
                        onChange={() => toggleAm(si, ii)}
                      />
                      <span>{it.title}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === "cs570" && (
        <div className="card">
          <h2>
            CS 570 — Erickson's Algorithms Topics ({cs570Done}/{cs570Total})
          </h2>
          <p className="sub" style={{ marginTop: -6 }}>
            已經依照建議複習順序排好（地基 → 跟刷題經驗銜接的 →
            沒碰過的硬骨頭最後留最多時間，圖論應用層放最後讀快）。Mapped from
            your handout (Algorithms, Jeff Erickson).
          </p>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${(cs570Done / cs570Total) * 100}%` }}
            />
          </div>
          <div className="grid-cols">
            {cs570.map((ch, ci) => {
              const d = ch.topics.filter((t) => t.done).length;
              const priLabel =
                { high: "🔴 重點優先", medium: "🟡 一般", low: "🟢 可讀快" }[
                  ch.priority
                ] || "";
              return (
                <div
                  key={ch.ch}
                  style={{
                    background: "#1a1d24",
                    border: "1px solid #2a2e38",
                    borderRadius: 10,
                    padding: 12,
                  }}
                >
                  <div
                    className="row-flex"
                    style={{ justifyContent: "space-between" }}
                  >
                    <div className="section-title" style={{ margin: 0 }}>
                      #{ci + 1} · Ch.{ch.ch} — {ch.title} ({d}/
                      {ch.topics.length})
                    </div>
                    <span className={`badge ${ch.priority}`}>{priLabel}</span>
                  </div>
                  {ch.note && (
                    <div className="sub" style={{ margin: "4px 0 8px" }}>
                      {ch.note}
                    </div>
                  )}
                  {ch.topics.map((t, ti) => (
                    <div
                      key={ti}
                      className={`checklist-item ${t.done ? "done" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={t.done}
                        onChange={() => toggleCs570(ci, ti)}
                      />
                      <span>{t.title}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === "jobs" && (
        <>
          <div className="card">
            <h2>Add application</h2>
            <form onSubmit={addJob} className="toolbar">
              <input
                type="text"
                placeholder="Company"
                value={jobForm.company}
                onChange={(e) =>
                  setJobForm({ ...jobForm, company: e.target.value })
                }
              />
              <input
                type="text"
                placeholder="Role"
                value={jobForm.role}
                onChange={(e) =>
                  setJobForm({ ...jobForm, role: e.target.value })
                }
              />
              <select
                value={jobForm.status}
                onChange={(e) =>
                  setJobForm({ ...jobForm, status: e.target.value })
                }
              >
                {STATUS_OPTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={jobForm.date}
                onChange={(e) =>
                  setJobForm({ ...jobForm, date: e.target.value })
                }
              />
              <input
                type="text"
                placeholder="Job link (optional)"
                value={jobForm.link}
                onChange={(e) =>
                  setJobForm({ ...jobForm, link: e.target.value })
                }
                style={{ minWidth: 200 }}
              />
              <button className="btn" type="submit">
                Add
              </button>
            </form>
          </div>

          <div className="card">
            <h2>Pipeline</h2>
            <div className="stats-row" style={{ marginBottom: 10 }}>
              {STATUS_OPTS.map((s) => (
                <div key={s} className="stat">
                  <div className="n">{jobStats[s] || 0}</div>
                  <div className="l">{s}</div>
                </div>
              ))}
            </div>
            <table>
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Link</th>
                  <th>Notes</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id}>
                    <td className="nostrike">{j.company}</td>
                    <td className="nostrike">{j.role}</td>
                    <td className="nostrike">
                      <select
                        value={j.status}
                        onChange={(e) => updateJobStatus(j.id, e.target.value)}
                      >
                        {STATUS_OPTS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="nostrike">{j.date}</td>
                    <td className="nostrike">
                      {j.link ? (
                        <a href={j.link} target="_blank" rel="noreferrer">
                          link
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="nostrike">{j.notes}</td>
                    <td className="nostrike">
                      <button
                        className="btn danger"
                        onClick={() => deleteJob(j.id)}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
                {jobs.length === 0 && (
                  <tr>
                    <td colSpan={7} className="sub">
                      No applications logged yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "boards" && (
        <div className="card">
          <h2>Daily job board check-in</h2>
          <p className="sub" style={{ marginTop: -6 }}>
            True auto-scraping of LinkedIn/Indeed/Handshake isn't possible
            (against their terms + needs login), so these are pre-filled,
            one-click search links for Summer 2027 SDE/Systems/Cloud intern
            roles, plus a community-maintained GitHub list that updates itself
            as new postings appear — open these daily, it takes ~2 minutes.
          </p>
          <div className="grid-cols">
            {JOB_BOARDS.map((b) => (
              <a
                className="linkcard"
                key={b.title}
                href={b.url}
                target="_blank"
                rel="noreferrer"
              >
                <div className="t">{b.title}</div>
                <div className="d">{b.desc}</div>
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <p className="sub" style={{ margin: 0 }}>
          All data is stored locally in your browser (localStorage) — nothing is
          sent to a server. To use across devices, deploy this to your own
          Vercel project (data stays per-browser unless you add a database).
        </p>
      </div>
    </div>
  );
}
