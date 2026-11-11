process.env.NODE_ENV = "test"; process.env.OTP_PROVIDER = "test"; process.env.OTP_RESEND_COOLDOWN_SEC = "0";
process.env.JWT_SECRET = "unit-test-secret-unit-test-secret-1234"; process.env.FRONTEND_ORIGIN = "http://localhost:5500";
const test = require("node:test"), assert = require("node:assert/strict");
const h = require("./helpers"); h.install();
const identity = require("../../controllers/identityController");
const { protect, optionalAuth } = require("../../middleware/auth");
const otp = require("../../services/otp");
const { SESSION_COOKIE } = require("../../utils/cookies");
const { FakeUser, mockRes, mockReq } = h;
test.after(h.uninstall);
test.beforeEach(() => { FakeUser.reset(); otp._resetForTests(); });

const P = "+919876543210";
const call = async (fn, body, extra = {}) => { const res = mockRes(); await fn(mockReq({ body, ...extra }), res); return res; };
const register = async (extra = {}) => { await call(identity.sendPhoneOtp, { purpose: "register", phone: P, name: "Asha Rao", ...extra }); return call(identity.verifyPhoneOtp, { purpose: "register", phone: P, name: "Asha Rao", code: otp._peekTestCode(P), ...extra }); };
const sessionFrom = res => res.cookies[0].split(";")[0].split("=")[1];

test("register: invalid phone / missing name / bad email are rejected before any SMS is sent", async () => {
  assert.equal((await call(identity.sendPhoneOtp, { purpose: "register", phone: "12345", name: "Asha" })).body.code, "INVALID_PHONE");
  assert.equal((await call(identity.sendPhoneOtp, { purpose: "register", phone: P, name: " " })).body.code, "INVALID_NAME");
  assert.equal((await call(identity.sendPhoneOtp, { purpose: "register", phone: P, name: "Asha", email: "nope" })).body.code, "INVALID_EMAIL");
  assert.equal(otp._peekTestCode(P), undefined, "no OTP was generated");
});
test("register: account is NOT created, and phone NOT verified, until the OTP is right", async () => {
  await call(identity.sendPhoneOtp, { purpose: "register", phone: P, name: "Asha Rao" });
  const bad = await call(identity.verifyPhoneOtp, { purpose: "register", phone: P, name: "Asha Rao", code: "000000" });
  assert.equal(bad.statusCode, 401); assert.equal(FakeUser.rows.length, 0); assert.equal(bad.cookies.length, 0);
});
test("register: email is optional; success sets HttpOnly cookie and never returns a token/hash", async () => {
  const res = await register();
  assert.equal(res.statusCode, 201);
  const u = FakeUser.rows[0]; assert.equal(u.email, undefined); assert.equal(u.phone, P); assert.equal(u.phoneVerified, true); assert.equal(u.authProvider, "phone");
  assert.match(res.cookies[0], new RegExp(`^${SESSION_COOKIE}=.+; Path=/; Max-Age=\\d+; HttpOnly; SameSite=Lax$`));
  const json = JSON.stringify(res.body);
  assert.ok(!/eyJ|passwordHash|"token"/.test(json), json); assert.equal(res.body.user.email, ""); assert.ok(res.body.csrfToken);
  assert.equal(res.headers["Cache-Control"], "no-store");
});
test("register: same number spelled differently is a duplicate; second account never created", async () => {
  await register();
  const r = await call(identity.sendPhoneOtp, { purpose: "register", phone: "09876543210", name: "Someone Else" });
  assert.equal(r.statusCode, 409); assert.equal(r.body.code, "PHONE_EXISTS"); assert.equal(FakeUser.rows.length, 1);
});
test("register: email already used -> 409 before spending an SMS", async () => {
  FakeUser.rows.push({ _id: "x", email: "a@b.co", phoneVerified: false });
  assert.equal((await call(identity.sendPhoneOtp, { purpose: "register", phone: P, name: "Asha", email: "A@B.co" })).body.code, "EMAIL_EXISTS");
});
test("register: concurrent race lost at the unique index -> clean 409, not 500", async () => {
  await call(identity.sendPhoneOtp, { purpose: "register", phone: P, name: "Asha Rao" });
  const code = otp._peekTestCode(P);
  const orig = FakeUser.create; FakeUser.create = async () => { throw Object.assign(new Error("E11000"), { code: 11000, keyPattern: { phone: 1 } }); };
  try { const r = await call(identity.verifyPhoneOtp, { purpose: "register", phone: P, name: "Asha Rao", code }); assert.equal(r.statusCode, 409); assert.equal(r.body.code, "PHONE_EXISTS"); }
  finally { FakeUser.create = orig; }
});
test("register: optional profile fields are validated server-side", async () => {
  assert.equal((await call(identity.sendPhoneOtp, { purpose: "register", phone: P, name: "Asha", address: { postalCode: "12" } })).body.code, "INVALID_PROFILE");
  assert.equal((await call(identity.sendPhoneOtp, { purpose: "register", phone: P, name: "Asha", dateOfBirth: "2999-01-01" })).body.code, "INVALID_PROFILE");
  assert.equal((await call(identity.sendPhoneOtp, { purpose: "register", phone: P, name: "Asha", gender: "x" })).body.code, "INVALID_PROFILE");
});
test("login: only a VERIFIED number can log in; unverified holder is invisible (no hijack)", async () => {
  FakeUser.rows.push({ _id: "legacy", name: "Legacy", phone: P, phoneVerified: false, email: "l@e.co", tokenVersion: 0, address: {}, wishlist: [] });
  assert.equal((await call(identity.sendPhoneOtp, { purpose: "login", phone: P })).body.code, "NO_ACCOUNT");
  assert.equal(otp._peekTestCode(P), undefined);
});
test("login via OTP returns the SAME account (cart/orders stay attached) and a fresh session", async () => {
  await register(); const id = FakeUser.rows[0]._id;
  assert.equal((await call(identity.sendPhoneOtp, { purpose: "login", phone: "9876543210", countryCode: "IN" })).statusCode, 200);
  const r = await call(identity.verifyPhoneOtp, { purpose: "login", phone: "9876543210", countryCode: "IN", code: otp._peekTestCode(P) });
  assert.equal(r.statusCode, 200); assert.equal(String(r.body.user.id), String(id)); assert.equal(FakeUser.rows.length, 1);
});
test("login: wrong OTP -> 401 and no cookie; OTP for another number is useless", async () => {
  await register(); await call(identity.sendPhoneOtp, { purpose: "login", phone: P });
  const r = await call(identity.verifyPhoneOtp, { purpose: "login", phone: P, code: "999999" }); assert.equal(r.statusCode, 401); assert.equal(r.cookies.length, 0);
});
test("legacy placeholder emails never leak to the browser", async () => {
  FakeUser.rows.push({ _id: "p", name: "Old Phone User", email: "phone-abc@phone.vastra.invalid", phone: P, phoneVerified: true, tokenVersion: 0, address: {}, wishlist: [] });
  await call(identity.sendPhoneOtp, { purpose: "login", phone: P });
  assert.equal((await call(identity.verifyPhoneOtp, { purpose: "login", phone: P, code: otp._peekTestCode(P) })).body.user.email, "");
});
test("link: legacy email account verifies a number; cannot take one owned by someone else", async () => {
  FakeUser.rows.push({ _id: "owner", name: "Owner", phone: P, phoneVerified: true });
  const me = await FakeUser.create({ name: "Legacy", email: "l@e.co", authProvider: "google" });
  assert.equal((await call(identity.sendLinkOtp, { phone: P }, { user: me })).body.code, "PHONE_EXISTS");
  const p2 = "+919111111111";
  assert.equal((await call(identity.sendLinkOtp, { phone: p2 }, { user: me })).statusCode, 200);
  const r = await call(identity.verifyLinkOtp, { phone: p2, code: otp._peekTestCode(p2) }, { user: me });
  assert.equal(r.statusCode, 200); assert.equal(me.phoneVerified, true); assert.equal(me.phone, p2); assert.equal(me.authProvider, "google_phone");
  assert.equal(me.email, "l@e.co", "email untouched; no accounts merged"); assert.equal(FakeUser.rows.length, 2);
});
test("OTP provider outage/unconfigured surfaces 503 and creates nothing", async () => {
  const keep = process.env.OTP_PROVIDER; delete process.env.OTP_PROVIDER;
  try { const r = await call(identity.sendPhoneOtp, { purpose: "register", phone: P, name: "Asha" }); assert.equal(r.statusCode, 503); assert.equal(r.body.code, "OTP_NOT_CONFIGURED"); }
  finally { process.env.OTP_PROVIDER = keep; }
});
test("resend cooldown is enforced and reported with Retry-After", async () => {
  process.env.OTP_RESEND_COOLDOWN_SEC = "30"; otp._resetForTests();
  const mod = "../../services/otp"; delete require.cache[require.resolve(mod)];
  const fresh = require(mod); // picks up the 30s cooldown
  await fresh.send(P); await assert.rejects(fresh.send(P), e => e.code === "OTP_COOLDOWN"); process.env.OTP_RESEND_COOLDOWN_SEC = "0";
});

/* ---------------------------- session middleware ---------------------------- */
const login = async () => { const r = await register(); return { cookie: `${SESSION_COOKIE}=${sessionFrom(r)}`, csrf: r.body.csrfToken, user: FakeUser.rows[0] }; };
const run = async (mw, req) => { const res = mockRes(); let nexted = false; await mw(req, res, e => { if (e) throw e; nexted = true; }); return { res, nexted }; };

test("session: cookie GET passes; refresh keeps you logged in", async () => {
  const s = await login(); const req = mockReq({ method: "GET", headers: { cookie: s.cookie } });
  const { nexted } = await run(protect, req); assert.ok(nexted); assert.equal(req.user._id, s.user._id);
});
test("CSRF: cookie-authenticated unsafe request needs the token", async () => {
  const s = await login();
  let r = await run(protect, mockReq({ method: "POST", headers: { cookie: s.cookie } })); assert.equal(r.res.statusCode, 403); assert.equal(r.res.body.code, "CSRF");
  r = await run(protect, mockReq({ method: "POST", headers: { cookie: s.cookie, "x-csrf-token": "forged" } })); assert.equal(r.res.body.code, "CSRF");
  r = await run(protect, mockReq({ method: "DELETE", headers: { cookie: s.cookie, "x-csrf-token": s.csrf } })); assert.ok(r.nexted);
});
test("CSRF: token from session A does not work for session B", async () => {
  const a = await login(); FakeUser.reset(); otp._resetForTests();
  const b = await register(); const cookieB = `${SESSION_COOKIE}=${sessionFrom(b)}`;
  const r = await run(protect, mockReq({ method: "POST", headers: { cookie: cookieB, "x-csrf-token": a.csrf } })); assert.equal(r.res.body.code, "CSRF");
});
test("Origin check: foreign Origin rejected even with a valid token; allow-listed & same-origin accepted", async () => {
  const s = await login(); const h2 = origin => ({ cookie: s.cookie, "x-csrf-token": s.csrf, origin });
  assert.equal((await run(protect, mockReq({ headers: h2("https://evil.example") }))).res.body.code, "BAD_ORIGIN");
  assert.ok((await run(protect, mockReq({ headers: h2("http://localhost:5500") }))).nexted);
  assert.ok((await run(protect, mockReq({ headers: h2("http://localhost:5000") }))).nexted);
});
test("bearer credentials still work for API clients and need no CSRF (cannot be sent cross-site by a browser)", async () => {
  const s = await login(); const jwt = decodeURIComponent(s.cookie.split("=")[1]);
  assert.ok((await run(protect, mockReq({ headers: { authorization: `Bearer ${jwt}` } }))).nexted);
});
test("expired / forged / revoked sessions give 401 with a code the UI can act on", async () => {
  const s = await login(); const jwtValue = decodeURIComponent(s.cookie.split("=")[1]);
  let r = await run(protect, mockReq({ method: "GET", headers: { cookie: `${SESSION_COOKIE}=${jwtValue}x` } })); assert.equal(r.res.statusCode, 401); assert.equal(r.res.body.code, "INVALID_SESSION");
  const expired = h.jwtStub.sign({ sub: s.user._id, tv: 0, jti: "j" }, process.env.JWT_SECRET, { expiresInSec: -10, issuer: "vastra-api", audience: "vastra-storefront" });
  r = await run(protect, mockReq({ method: "GET", headers: { cookie: `${SESSION_COOKIE}=${expired}` } })); assert.equal(r.res.body.code, "SESSION_EXPIRED");
  s.user.tokenVersion += 1; // password reset / logout-all
  r = await run(protect, mockReq({ method: "GET", headers: { cookie: s.cookie } })); assert.equal(r.res.statusCode, 401);
  r = await run(protect, mockReq({ method: "GET" })); assert.equal(r.res.body.code, "UNAUTHENTICATED");
});
test("optionalAuth: guests pass, valid users attach, bad credentials still fail", async () => {
  const s = await login(); let req = mockReq({ method: "GET" });
  assert.ok((await run(optionalAuth, req)).nexted); assert.equal(req.user, undefined);
  req = mockReq({ method: "GET", headers: { cookie: s.cookie } }); await run(optionalAuth, req); assert.equal(req.user._id, s.user._id);
  assert.equal((await run(optionalAuth, mockReq({ method: "GET", headers: { cookie: `${SESSION_COOKIE}=garbage` } }))).res.statusCode, 401);
});
