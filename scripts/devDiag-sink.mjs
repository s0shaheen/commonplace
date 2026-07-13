// devDiag-sink.mjs — DEV-ONLY diagnostics receiver. NEVER SHIPS (lives in scripts/, never in dist/).
//
// The dev-only client (src/devDiag.ts, compiled in ONLY under `npm run dev` via the `__DEV_DIAG__`
// define) fire-and-forget POSTs newline-delimited JSON diagnostic records to this HTTP sink. The sink
// APPENDS them to a rolling per-session file `./.dev-diag/run-<startTs>.jsonl` and decodes any base64
// screenshot payloads to `./.dev-diag/shots/<t>.<fmt>` (recording just the path in the jsonl). The
// controller triages a live capture run by reading/tailing that file — NO browser driving, NO
// chrome.debugger contention (the whole point: the extension already owns the tab's debugger for
// trusted-wheel scrolling; a second debugger client — claude-in-chrome — would fight it and break
// capture. This file-on-disk stream sidesteps that entirely).
//
// Resilience is a hard requirement: a bad record, a decode failure, or a port clash must NEVER crash
// the dev server (hot-reload is the primary function; diagnostics are strictly additive). Every path
// is wrapped; a port-in-use just disables diag with a warning.

import {
  mkdirSync,
  appendFileSync,
  writeFileSync,
  readdirSync,
  statSync,
  rmSync,
} from "node:fs";
import { createServer } from "node:http";
import { resolve, join } from "node:path";

const DEFAULT_PORT = 9013;
const KEEP_RUNS = 5; // rolling window: keep the last ~5 run files, prune older
const MAX_SHOTS = 240; // bounded shots dir (~4s cadence ⇒ ~16 min of a live run); prune oldest beyond

// Prune a directory to the newest `keep` entries matching `predicate`, deleting the rest. Best-effort.
function pruneDir(dir, keep, predicate) {
  try {
    const entries = readdirSync(dir)
      .filter(predicate)
      .map((name) => {
        const full = join(dir, name);
        let mtime = 0;
        try {
          mtime = statSync(full).mtimeMs;
        } catch {
          /* vanished — treat as oldest */
        }
        return { full, mtime };
      })
      .sort((a, b) => b.mtime - a.mtime);
    for (const { full } of entries.slice(keep)) {
      try {
        rmSync(full, { force: true });
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* dir missing — nothing to prune */
  }
}

/**
 * Start the diagnostics sink. Returns a `{ close }` handle (or null if it couldn't bind — diag then
 * stays off, dev-server unaffected). `rootDir` is the repo root; files land under `<rootDir>/.dev-diag/`.
 */
export function startDiagSink(rootDir, port = DEFAULT_PORT) {
  const diagDir = resolve(rootDir, ".dev-diag");
  const shotsDir = resolve(diagDir, "shots");
  const startTs = Date.now();
  const runFile = resolve(diagDir, `run-${startTs}.jsonl`);

  try {
    mkdirSync(shotsDir, { recursive: true });
  } catch (e) {
    console.error("[diag] could not create .dev-diag/ — diagnostics disabled:", e.message);
    return null;
  }

  // Fresh session: seed the run file so its path is valid immediately, and roll off old runs.
  try {
    writeFileSync(runFile, "");
  } catch {
    /* seed is best-effort */
  }
  pruneDir(diagDir, KEEP_RUNS, (n) => /^run-\d+\.jsonl$/.test(n));

  let firstRecordSeen = false;
  let shotCount = 0;

  // Process ONE record (already JSON.parsed). Screenshot payloads are decoded to a file; the jsonl
  // gets the lightweight path instead of the multi-KB base64. Returns the line to append (or null to skip).
  function processRecord(rec) {
    if (rec && rec.kind === "shot" && typeof rec.data === "string") {
      const fmt = typeof rec.fmt === "string" && /^[a-z0-9]{1,5}$/i.test(rec.fmt) ? rec.fmt : "jpg";
      const ts = Number.isFinite(rec.t) ? rec.t : Date.now();
      const rel = join("shots", `${ts}.${fmt}`);
      try {
        writeFileSync(resolve(diagDir, rel), Buffer.from(rec.data, "base64"));
        shotCount++;
        if (shotCount % 20 === 0) pruneDir(shotsDir, MAX_SHOTS, () => true);
      } catch {
        /* decode/write failed — drop the payload, keep a marker */
        return JSON.stringify({ kind: "shot", t: ts, shotPath: null, error: "decode_failed" });
      }
      return JSON.stringify({ kind: "shot", t: ts, shotPath: rel });
    }
    return JSON.stringify(rec);
  }

  function ingestBody(body) {
    const lines = body.split("\n");
    const out = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let rec;
      try {
        rec = JSON.parse(trimmed);
      } catch {
        continue; // a malformed line must never crash the sink — skip it
      }
      const emitted = processRecord(rec);
      if (emitted != null) out.push(emitted);
    }
    if (out.length === 0) return;
    try {
      appendFileSync(runFile, out.join("\n") + "\n");
    } catch {
      /* disk hiccup — best-effort */
    }
    if (!firstRecordSeen) {
      firstRecordSeen = true;
      console.log(`[diag] receiving capture diagnostics → ${runFile}`);
      console.log(`[diag] tail it:  tail -f ${runFile}`);
    }
  }

  const server = createServer((req, res) => {
    // Permissive CORS so a content-script POST (origin https://www.tiktok.com) is never blocked/noisy.
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "*");
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }
    if (req.method !== "POST") {
      res.writeHead(405);
      res.end();
      return;
    }
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
      // Hard cap a single request so a runaway client can't blow up memory (best-effort).
      if (body.length > 8 * 1024 * 1024) body = body.slice(-8 * 1024 * 1024);
    });
    req.on("end", () => {
      try {
        ingestBody(body);
      } catch (e) {
        console.error("[diag] record ingest error (non-fatal):", e.message);
      }
      res.writeHead(204);
      res.end();
    });
    req.on("error", () => {
      try {
        res.writeHead(400);
        res.end();
      } catch {
        /* ignore */
      }
    });
  });

  server.on("error", (err) => {
    if (err && err.code === "EADDRINUSE") {
      console.warn(`[diag] port ${port} in use — diagnostics sink disabled (hot-reload unaffected).`);
    } else {
      console.error("[diag] sink server error (non-fatal):", err.message);
    }
  });

  server.listen(port, "127.0.0.1", () => {
    console.log(`[diag] diagnostics sink on http://localhost:${port}/diag → ${runFile}`);
  });

  return {
    close() {
      try {
        server.close();
      } catch {
        /* ignore */
      }
    },
  };
}
