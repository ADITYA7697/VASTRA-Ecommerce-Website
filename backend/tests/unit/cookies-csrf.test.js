const test = require("node:test");
const assert = require("node:assert/strict");
const { parseCookies, serializeCookie, cookieOptions, csrfFor, csrfValid, SESSION_COOKIE } = require("../../utils/cookies");
const S = "x".repeat(40);

test("serializeCookie sets HttpOnly/SameSite/Secure/Max-Age", () => {
  const c = serializeCookie(SESSION_COOKIE, "a b;c", { maxAgeSec: 60.9, secure: true, sameSite: "Strict" });
  assert.match(c, /^vastra_session=a%20b%3Bc; Path=\/; Max-Age=60; HttpOnly; Secure; SameSite=Strict$/);
  assert.ok(!/Secure/.test(serializeCookie("n", "v", {})));
});
test("parseCookies decodes, ignores malformed, first value wins", () => {
  const r = parseCookies("a=1; vastra_session=a%20b; bad=%E0%A4%A; a=2");
  assert.equal(r.a, "1"); assert.equal(r.vastra_session, "a b"); assert.equal("bad" in r, false);
  assert.deepEqual(parseCookies(undefined), {});
});
test("cookieOptions: secure in production, SameSite=None needs Secure", () => {
  assert.equal(cookieOptions({ NODE_ENV: "production" }).secure, true);
  assert.equal(cookieOptions({ NODE_ENV: "development" }).secure, false);
  assert.equal(cookieOptions({}).sameSite, "Lax");
  assert.throws(() => cookieOptions({ COOKIE_SAMESITE: "none", COOKIE_SECURE: "false" }));
  assert.equal(cookieOptions({ COOKIE_SAMESITE: "none", COOKIE_SECURE: "true" }).sameSite, "None");
});
test("CSRF token is bound to the session and secret", () => {
  const t = csrfFor("jti-1", S);
  assert.equal(csrfValid("jti-1", t, S), true);
  assert.equal(csrfValid("jti-2", t, S), false);
  assert.equal(csrfValid("jti-1", t, "y".repeat(40)), false);
  assert.equal(csrfValid("jti-1", "", S), false);
  assert.equal(csrfValid("jti-1", undefined, S), false);
  assert.equal(csrfValid("jti-1", t.slice(0, -1), S), false);
});
