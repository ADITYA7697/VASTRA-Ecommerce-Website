const User = require("../models/User");
const { SESSION_COOKIE, parseCookies, csrfValid } = require("../utils/cookies");
const { verify } = require("../utils/session");
const origins = require("../config/origins");

const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);
const deny = (res, status, code, message) => res.status(status).json({ success: false, code, message });

/** Defence in depth for cookie sessions: a present Origin must be us or an allow-listed frontend. */
function originAllowed(req) {
  const o = req.headers.origin;
  if (!o) return true;
  return o === `${req.protocol}://${req.get("host")}` || origins.list().includes(o);
}

/**
 * Resolves the caller. Session = HttpOnly cookie (browser) or `Authorization: Bearer` (API clients/legacy).
 * Cookie sessions must also pass CSRF checks on unsafe methods; bearer requests cannot be forged cross-site.
 * @returns {Promise<null|{user,payload,via}>}  throws {status,code,message} on a bad credential
 */
async function resolve(req) {
  const [scheme, bearer] = (req.headers.authorization || "").split(" ");
  const cookie = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  const via = scheme === "Bearer" && bearer ? "bearer" : cookie ? "cookie" : null;
  if (!via) return null;
  let payload;
  try { payload = verify(via === "bearer" ? bearer : cookie); }
  catch (e) { throw { status: 401, code: e.name === "TokenExpiredError" ? "SESSION_EXPIRED" : "INVALID_SESSION", message: e.name === "TokenExpiredError" ? "Your session has expired. Please log in again." : "Invalid session. Please log in again." }; }
  if (via === "cookie" && !SAFE.has(req.method)) {
    if (!originAllowed(req)) throw { status: 403, code: "BAD_ORIGIN", message: "Request origin not allowed." };
    if (!csrfValid(payload.jti, req.get("x-csrf-token"))) throw { status: 403, code: "CSRF", message: "Security check failed. Refresh the page and try again." };
  }
  const user = await User.findById(payload.sub);
  if (!user || (user.tokenVersion || 0) !== (payload.tv || 0)) throw { status: 401, code: "INVALID_SESSION", message: "Session is no longer valid. Please log in again." };
  return { user, payload, via };
}

async function protect(req, res, next) {
  try {
    const r = await resolve(req);
    if (!r) return deny(res, 401, "UNAUTHENTICATED", "Please log in.");
    req.user = r.user; req.session = r.payload; req.authVia = r.via;
    next();
  } catch (e) {
    if (e && e.status) return deny(res, e.status, e.code, e.message);
    next(e);
  }
}
/** Like protect, but anonymous callers pass through (e.g. guest support tickets). A *bad* credential still fails. */
async function optionalAuth(req, res, next) {
  try {
    const r = await resolve(req);
    if (r) { req.user = r.user; req.session = r.payload; req.authVia = r.via; }
    next();
  } catch (e) {
    if (e && e.status) return deny(res, e.status, e.code, e.message);
    next(e);
  }
}
function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== "admin") return deny(res, 403, "FORBIDDEN", "Admin access required.");
  next();
}
module.exports = { protect, optionalAuth, adminOnly };
