#!/usr/bin/env node
"use strict";

/**
 * Local mock of SMTP2GO's POST /v3/email/send, for testing the invite functions
 * without touching the real API (or its rate limits).
 *
 * !!!!!!!!!To TEST!!!!!!!!
 * Run:   node mock-smtp2go.js
 * Point: SMTP2GO_SEND_URL=http://127.0.0.1:4010/v3/email/send  (functions/.env.local)
 *        SMTP2GO_API_KEY=anything                               (functions/.secret.local)
 *
 * HOW TO PICK A BEHAVIOUR
 * Put a scenario token in the recipient's address. Plus-addressing keeps every
 * address unique, so you can seed hundreds of invitees and mix scenarios:
 *
 *   guest1@example.com                  -> success
 *   guest2+mock-reject@example.com      -> HTTP 400, request rejected
 *   guest3+mock-fail200@example.com     -> HTTP 200, but failure reported in body
 *   guest4+mock-429@example.com         -> HTTP 429
 *   guest5+mock-500@example.com         -> HTTP 500
 *   guest6+mock-slow@example.com        -> no reply for SLOW_MS (trips your timeout)
 *   guest7+mock-drop@example.com        -> connection destroyed mid-request
 *   guest8+mock-junk@example.com        -> HTTP 200 with a non-JSON body
 *
 * SETTINGS (environment variables)
 *   PORT                   listen port                                 (4010)
 *   LATENCY_MIN_MS/MAX_MS  random delay for normal replies             (200 / 1200)
 *   SLOW_MS                how long "mock-slow" stays silent           (35000)
 *   FAIL_RATE              0..1, extra random rejections for volume    (0)
 *   RATE_LIMIT_PER_SEC     429 above this many requests/sec, 0 = off   (0)
 *   RATE_LIMIT_PENALTY_MS  how long 429s continue once tripped         (60000)
 *   REQUIRE_API_KEY        "false" to skip the API-key header check    (true)
 *   LOG                    "1" to print one line per request           (off)
 *
 * CONTROL ENDPOINTS (not part of the real API)
 *   GET  /__stats   totals, peak concurrency, outcomes, duplicate recipients
 *   POST /__reset   clear all counters and stored emails
 *
 * NOT VERIFIED AGAINST THE REAL API: the exact shape of `failures` entries and
 * the error codes are made up (MOCK_*). The success shape (data.email_id,
 * succeeded, failed) follows SMTP2GO's docs.
 */

const http = require("node:http");
const crypto = require("node:crypto");

// you can set these with ex:"SLOW_MS=10" or whatever
const cfg = {
  port: Number(process.env.PORT || 4010),
  latencyMinMs: Number(process.env.LATENCY_MIN_MS || 200),
  latencyMaxMs: Number(process.env.LATENCY_MAX_MS || 1200),
  slowMs: Number(process.env.SLOW_MS || 35_000),
  failRate: Number(process.env.FAIL_RATE || 0),
  rateLimitPerSec: Number(process.env.RATE_LIMIT_PER_SEC || 0),
  rateLimitPenaltyMs: Number(process.env.RATE_LIMIT_PENALTY_MS || 60_000),
  requireApiKey: process.env.REQUIRE_API_KEY !== "false",
  log: process.env.LOG === "1",
};

// ---------------------------------------------------------------------------
// State. `emails` (email_id -> details) is deliberately kept: a future status
// lookup endpoint or webhook emitter needs to map an id back to an email.
// ---------------------------------------------------------------------------

const state = {};

function resetState() {
  state.total = 0;
  state.inflight = 0;
  state.peakInflight = 0;
  state.outcomes = {};
  state.recipientCounts = new Map();
  state.emails = new Map();
  state.firstAt = null;
  state.lastAt = null;
  state.recentRequests = []; // timestamps within the last second
  state.blockedUntil = 0;
}
resetState();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sendJson(res, status, body) {
  if (res.destroyed || res.writableEnded) return;
  res.writeHead(status, {"Content-Type": "application/json"});
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

/** Resolves true after `ms`, or false right away if the client hung up first. */
function sleep(ms, res) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(true), ms);
    res.once("close", () => {
      clearTimeout(timer);
      resolve(false);
    });
  });
}

function randomLatency() {
  const {latencyMinMs: lo, latencyMaxMs: hi} = cfg;
  return lo + Math.random() * Math.max(0, hi - lo);
}

/** "Name <a@b.com>" or "a@b.com" -> "a@b.com" (lowercased). */
function extractAddresses(payload) {
  const to = Array.isArray(payload.to) ? payload.to : [];
  return to.map((entry) => {
    const match = /<([^>]+)>/.exec(String(entry));
    return (match ? match[1] : String(entry)).trim().toLowerCase();
  });
}

const TOKENS = [
  ["mock-drop", "drop"],
  ["mock-junk", "junk"],
  ["mock-slow", "slow"],
  ["mock-429", "rate_limited"],
  ["mock-500", "server_error"],
  ["mock-fail200", "fail200"],
  ["mock-reject", "rejected"],
];

function scenarioFor(addresses) {
  const joined = addresses.join(",");
  for (const [token, name] of TOKENS) {
    if (joined.includes(token)) return name;
  }
  if (cfg.failRate > 0 && Math.random() < cfg.failRate) return "rejected";
  return "success";
}

/** Mimics "too many requests -> blocked for a while". Returns true if blocked. */
function isRateLimited() {
  if (!cfg.rateLimitPerSec) return false;
  const now = Date.now();
  if (now < state.blockedUntil) return true;

  state.recentRequests = state.recentRequests.filter((t) => now - t < 1000);
  state.recentRequests.push(now);
  if (state.recentRequests.length > cfg.rateLimitPerSec) {
    state.blockedUntil = now + cfg.rateLimitPenaltyMs;
    return true;
  }
  return false;
}

function stats() {
  const duplicates = [...state.recipientCounts.entries()]
      .filter(([, count]) => count > 1)
      .map(([address, count]) => ({address, count}));
  return {
    config: cfg,
    total: state.total,
    inflight: state.inflight,
    peakInflight: state.peakInflight,
    outcomes: state.outcomes,
    uniqueRecipients: state.recipientCounts.size,
    duplicates,
    firstRequestAt: state.firstAt && new Date(state.firstAt).toISOString(),
    lastRequestAt: state.lastAt && new Date(state.lastAt).toISOString(),
    spanMs: state.firstAt ? state.lastAt - state.firstAt : 0,
  };
}

// ---------------------------------------------------------------------------
// POST /v3/email/send
// ---------------------------------------------------------------------------

async function handleSend(req, res) {
  const requestId = crypto.randomUUID();
  const now = Date.now();
  state.firstAt = state.firstAt || now;
  state.lastAt = now;
  state.total++;
  state.inflight++;
  state.peakInflight = Math.max(state.peakInflight, state.inflight);
  // 'close' fires once per response, whether it finished or the client aborted.
  res.once("close", () => {
    state.inflight--;
  });

  const finish = (outcome, status, body, addresses = []) => {
    state.outcomes[outcome] = (state.outcomes[outcome] || 0) + 1;
    if (cfg.log) console.log(`${status} ${outcome} ${addresses.join(",")}`);
    sendJson(res, status, {request_id: requestId, ...body});
  };

  // Not part of the scenarios: these are protocol-level problems.
  if (cfg.requireApiKey && !req.headers["x-smtp2go-api-key"]) {
    return finish("no_api_key", 401, {
      data: {error: "Missing API key header", error_code: "MOCK_NO_API_KEY"},
    });
  }

  let payload;
  try {
    payload = JSON.parse(await readBody(req));
  } catch {
    return finish("bad_json", 400, {
      data: {error: "Body is not valid JSON", error_code: "MOCK_BAD_JSON"},
    });
  }

  const addresses = extractAddresses(payload);
  if (addresses.length === 0) {
    return finish("no_recipients", 400, {
      data: {error: "No recipients", error_code: "MOCK_NO_RECIPIENTS"},
    });
  }

  // Count every attempt per recipient: more than 1 means a duplicate send.
  for (const address of addresses) {
    state.recipientCounts.set(address, (state.recipientCounts.get(address) || 0) + 1);
  }

  if (isRateLimited()) {
    return finish("rate_limited", 429, {
      data: {error: "Too many requests", error_code: "MOCK_RATE_LIMITED"},
    }, addresses);
  }

  const scenario = scenarioFor(addresses);

  if (scenario === "slow") {
    // Stay silent past the caller's timeout. If they hang up, this returns.
    if (!(await sleep(cfg.slowMs, res))) {
      state.outcomes.slow_aborted = (state.outcomes.slow_aborted || 0) + 1;
      return;
    }
  } else if (!(await sleep(randomLatency(), res))) {
    return; // caller gave up while we were "working"
  }

  switch (scenario) {
    case "drop":
      state.outcomes.drop = (state.outcomes.drop || 0) + 1;
      return req.socket.destroy();

    case "junk":
      state.outcomes.junk = (state.outcomes.junk || 0) + 1;
      res.writeHead(200, {"Content-Type": "text/html"});
      return res.end("<html><body>definitely not json</body></html>");

    case "rate_limited":
      return finish("rate_limited", 429, {
        data: {error: "Too many requests", error_code: "MOCK_RATE_LIMITED"},
      }, addresses);

    case "server_error":
      return finish("server_error", 500, {
        data: {error: "Internal error", error_code: "MOCK_SERVER_ERROR"},
      }, addresses);

    case "fail200":
      // HTTP 200, but the body says it failed and there is no email_id.
      return finish("fail200", 200, {
        data: {succeeded: 0, failed: 1, failures: ["mock: recipient rejected"]},
      }, addresses);

    case "rejected":
      return finish("rejected", 400, {
        data: {error: "Recipient rejected", error_code: "MOCK_REJECTED"},
      }, addresses);

    default: {
      const emailId = crypto.randomUUID();
      state.emails.set(emailId, {
        to: addresses,
        subject: payload.subject,
        acceptedAt: new Date().toISOString(),
      });
      return finish("success", 200, {
        data: {succeeded: 1, failed: 0, failures: [], email_id: emailId},
      }, addresses);
    }
  }
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

const server = http.createServer((req, res) => {
  const {pathname} = new URL(req.url, "http://localhost");

  if (req.method === "GET" && pathname === "/__stats") {
    return sendJson(res, 200, stats());
  }
  if (req.method === "POST" && pathname === "/__reset") {
    resetState();
    return sendJson(res, 200, {ok: true});
  }
  if (req.method === "POST" && pathname === "/v3/email/send") {
    return handleSend(req, res).catch((err) => {
      console.error("Mock handler error:", err);
      sendJson(res, 500, {data: {error: "mock crashed", error_code: "MOCK_CRASH"}});
    });
  }
  sendJson(res, 404, {data: {error: "not found", error_code: "MOCK_NOT_FOUND"}});
});

server.listen(cfg.port, "127.0.0.1", () => {
  console.log(`Mock SMTP2GO listening on http://127.0.0.1:${cfg.port}`);
  console.log(`  send:  POST /v3/email/send`);
  console.log(`  stats: GET  /__stats    reset: POST /__reset`);
});