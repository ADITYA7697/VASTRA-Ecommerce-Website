const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { SESSION_COOKIE, serializeCookie, cookieOptions, csrfFor } = require("./cookies");

const ISSUER = "vastra-api", AUDIENCE = "vastra-storefront";

function sign(user) {
  const jti = crypto.randomUUID();
  const token = jwt.sign({ sub: user._id.toString(), tv: user.tokenVersion || 0, jti }, process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d", issuer: ISSUER, audience: AUDIENCE, algorithm: "HS256" });
  const { exp } = jwt.decode(token);
  return { token, jti, exp };
}
function verify(token) {
  return jwt.verify(token, process.env.JWT_SECRET, { issuer: ISSUER, audience: AUDIENCE, algorithms: ["HS256"] });
}

/** Sets the HttpOnly session cookie. The JWT itself is NEVER put in a response body. */
function startSession(res, user) {
  const { token, jti, exp } = sign(user);
  res.append("Set-Cookie", serializeCookie(SESSION_COOKIE, token, { ...cookieOptions(), maxAgeSec: exp - Math.floor(Date.now() / 1000) }));
  res.set("Cache-Control", "no-store");
  return { csrfToken: csrfFor(jti), expiresAt: new Date(exp * 1000).toISOString() };
}
/** Clears with the same attributes it was set with, otherwise browsers keep the cookie. */
function endSession(res) {
  res.append("Set-Cookie", serializeCookie(SESSION_COOKIE, "", { ...cookieOptions(), maxAgeSec: 0, expires: new Date(0) }));
  res.set("Cache-Control", "no-store");
}
module.exports = { startSession, endSession, verify, sign };
