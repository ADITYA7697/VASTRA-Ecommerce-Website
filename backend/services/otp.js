"use strict";
/**
 * SMS OTP service. Providers:
 *   - twilio : Twilio Verify. Twilio generates, stores, expires and attempt-limits the code,
 *              so VASTRA never sees or stores an OTP.
 *   - test   : in-memory, ONLY when NODE_ENV=test (never selectable in production/development).
 * Adds per-number cooldown and hourly send cap on top of the provider's own limits.
 * (Counters are in-process; for multiple instances move them to Redis/Mongo.)
 */
const RESEND_COOLDOWN_MS = Number(process.env.OTP_RESEND_COOLDOWN_SEC || 30) * 1000;
const MAX_SENDS_PER_HOUR = Number(process.env.OTP_MAX_SENDS_PER_HOUR || 5);
const MAX_CHECK_FAILS = Number(process.env.OTP_MAX_FAILED_CHECKS || 5);
const HOUR = 3600 * 1000;

const sends = new Map();   // phone -> [timestamps]
const fails = new Map();   // phone -> {count, resetAt}

class OtpError extends Error {
  constructor(status, code, message, retryAfterSec) { super(message); this.status = status; this.code = code; this.retryAfterSec = retryAfterSec; }
}

const testStore = new Map(); // phone -> code (test provider only)
const providerName = () => (process.env.NODE_ENV === "test" && process.env.OTP_PROVIDER === "test") ? "test" : "twilio";

function twilioEnv() {
  const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token, TWILIO_VERIFY_SERVICE_SID: service } = process.env;
  const placeholder = v => !v || /^your-|replace/i.test(v);
  return (placeholder(sid) || placeholder(token) || placeholder(service)) ? null : { sid, token, service };
}
const isConfigured = () => providerName() === "test" || !!twilioEnv();

async function twilioCall(path, params) {
  const t = twilioEnv();
  const res = await fetch(`https://verify.twilio.com/v2/Services/${encodeURIComponent(t.service)}/${path}`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${t.sid}:${t.token}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params), signal: AbortSignal.timeout(10000),
  });
  return { ok: res.ok, status: res.status, data: await res.json().catch(() => ({})) };
}

function guardSend(phone, now) {
  const list = (sends.get(phone) || []).filter(t => now - t < HOUR);
  const last = list[list.length - 1];
  if (last && now - last < RESEND_COOLDOWN_MS) throw new OtpError(429, "OTP_COOLDOWN", "Please wait before requesting another OTP.", Math.ceil((RESEND_COOLDOWN_MS - (now - last)) / 1000));
  if (list.length >= MAX_SENDS_PER_HOUR) throw new OtpError(429, "OTP_LIMIT", "Too many OTP requests for this number. Try again later.", Math.ceil((HOUR - (now - list[0])) / 1000));
  sends.set(phone, list);
  return list;
}

async function send(phone, now = Date.now()) {
  if (!isConfigured()) throw new OtpError(503, "OTP_NOT_CONFIGURED", "Mobile OTP is not configured on this server yet.");
  const list = guardSend(phone, now);
  if (providerName() === "test") {
    testStore.set(phone, String(100000 + Math.floor(Math.random() * 900000)));
  } else {
    const r = await twilioCall("Verifications", { To: phone, Channel: "sms" });
    if (!r.ok) {
      console.error(`OTP provider rejected send (HTTP ${r.status}, code ${r.data.code || "n/a"})`); // never log the number or secrets
      throw new OtpError(502, "OTP_PROVIDER", r.status === 429 ? "Too many attempts. Please try again later." : "We could not send the OTP. Please check the number and try again.");
    }
  }
  list.push(now); sends.set(phone, list);
}

/** @returns {Promise<boolean>} true only when the provider approves the code. */
async function check(phone, code, now = Date.now()) {
  if (!isConfigured()) throw new OtpError(503, "OTP_NOT_CONFIGURED", "Mobile OTP is not configured on this server yet.");
  const f = fails.get(phone);
  if (f && f.resetAt > now && f.count >= MAX_CHECK_FAILS) throw new OtpError(429, "OTP_LOCKED", "Too many wrong attempts. Request a new OTP later.", Math.ceil((f.resetAt - now) / 1000));
  let approved;
  if (providerName() === "test") {
    approved = testStore.get(phone) === code;
    if (approved) testStore.delete(phone);
  } else {
    const r = await twilioCall("VerificationCheck", { To: phone, Code: code });
    approved = r.ok && r.data.status === "approved";
  }
  if (approved) { fails.delete(phone); return true; }
  const cur = f && f.resetAt > now ? f : { count: 0, resetAt: now + 15 * 60 * 1000 };
  cur.count += 1; fails.set(phone, cur);
  return false;
}

function _resetForTests() { sends.clear(); fails.clear(); testStore.clear(); }
// Test-provider helper; refuses to work outside NODE_ENV=test.
function _peekTestCode(phone) { if (providerName() !== "test") throw new Error("test provider inactive"); return testStore.get(phone); }

module.exports = { send, check, isConfigured, OtpError, _resetForTests, _peekTestCode };
