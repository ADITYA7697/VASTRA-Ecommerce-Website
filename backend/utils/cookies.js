"use strict";
const crypto = require("crypto");

const SESSION_COOKIE = "vastra_session";

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of String(header).split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (!k || k in out) continue;
    try { out[k] = decodeURIComponent(part.slice(i + 1).trim()); } catch { /* ignore malformed */ }
  }
  return out;
}

function serializeCookie(name, value, o = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${o.path || "/"}`];
  if (o.maxAgeSec !== undefined) parts.push(`Max-Age=${Math.max(0, Math.floor(o.maxAgeSec))}`);
  if (o.expires) parts.push(`Expires=${o.expires.toUTCString()}`);
  if (o.httpOnly !== false) parts.push("HttpOnly");
  if (o.secure) parts.push("Secure");
  parts.push(`SameSite=${o.sameSite || "Lax"}`);
  return parts.join("; ");
}

/** Cookie attributes come from env so production can use Secure / SameSite=None across sites. */
function cookieOptions(env = process.env) {
  const production = env.NODE_ENV === "production";
  const sameSite = ({ lax: "Lax", strict: "Strict", none: "None" })[String(env.COOKIE_SAMESITE || "lax").toLowerCase()] || "Lax";
  const secure = env.COOKIE_SECURE !== undefined ? env.COOKIE_SECURE === "true" : production;
  if (sameSite === "None" && !secure) throw new Error("COOKIE_SAMESITE=none requires COOKIE_SECURE=true.");
  return { sameSite, secure, httpOnly: true, path: "/" };
}

/** Stateless CSRF token bound to the session id (jti): HMAC(secret, "csrf:"+jti). */
function csrfFor(jti, secret = process.env.JWT_SECRET) {
  return crypto.createHmac("sha256", secret).update(`csrf:${jti}`).digest("base64url");
}
function csrfValid(jti, supplied, secret = process.env.JWT_SECRET) {
  if (!jti || typeof supplied !== "string" || !supplied) return false;
  const a = Buffer.from(csrfFor(jti, secret)), b = Buffer.from(supplied);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { SESSION_COOKIE, parseCookies, serializeCookie, cookieOptions, csrfFor, csrfValid };
