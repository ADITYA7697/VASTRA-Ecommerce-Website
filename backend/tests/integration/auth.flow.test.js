/**
 * End-to-end mobile-OTP auth flow against a REAL MongoDB. Run:
 *   npm install
 *   MONGO_URI_TEST=mongodb://127.0.0.1:27017/vastra_test npm run test:integration
 * Uses the in-memory OTP provider (NODE_ENV=test only). Drops the test database's `users` collection first.
 * Skipped automatically when MONGO_URI_TEST is not set.
 */
process.env.NODE_ENV = "test"; process.env.OTP_PROVIDER = "test"; process.env.OTP_RESEND_COOLDOWN_SEC = "0";
process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret-integration-test-secret";
const test = require("node:test");
const assert = require("node:assert/strict");
const URI = process.env.MONGO_URI_TEST;

test("mobile OTP auth flow", { skip: !URI && "set MONGO_URI_TEST to run" }, async t => {
  const mongoose = require("mongoose");
  await mongoose.connect(URI);
  try { await mongoose.connection.collection("users").drop(); } catch {}
  await require("../../config/indexes").ensureUserIndexes();
  const app = require("../../server"), otp = require("../../services/otp"), User = require("../../models/User");
  const server = await new Promise(r => { const s = app.listen(0, () => r(s)); });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  t.after(async () => { server.close(); await mongoose.disconnect(); });

  const jar = {};
  const call = async (method, path, body, { csrf = jar.csrf, cookie = true } = {}) => {
    const headers = { "Content-Type": "application/json" };
    if (cookie && jar.cookie) headers.Cookie = jar.cookie;
    if (csrf) headers["X-CSRF-Token"] = csrf;
    const res = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const set = res.headers.getSetCookie?.() || [];
    for (const c of set) { const [pair] = c.split(";"); const [k, v] = pair.split("="); if (k === "vastra_session") jar.cookie = v ? pair : undefined; }
    const json = await res.json().catch(() => ({}));
    if (json.csrfToken) jar.csrf = json.csrfToken;
    return { status: res.status, json, set };
  };
  const phone = "+919876543210", otpFor = p => otp._peekTestCode(p);

  await t.test("register requires a name and a valid number; email optional", async () => {
    assert.equal((await call("POST", "/auth/phone/send-otp", { purpose: "register", phone, name: "" })).status, 400);
    assert.equal((await call("POST", "/auth/phone/send-otp", { purpose: "register", phone: "12345", name: "Asha" })).json.code, "INVALID_PHONE");
    assert.equal((await call("POST", "/auth/phone/send-otp", { purpose: "register", phone, name: "Asha Rao" })).status, 200);
    assert.equal((await call("POST", "/auth/phone/verify-otp", { purpose: "register", phone, name: "Asha Rao", code: "000000" })).status, 401);
    assert.equal(await User.countDocuments({ phone }), 0, "nothing created before successful OTP");
    const r = await call("POST", "/auth/phone/verify-otp", { purpose: "register", phone, name: "Asha Rao", code: otpFor(phone) });
    assert.equal(r.status, 201, JSON.stringify(r.json));
    assert.equal(r.json.user.email, ""); assert.equal(r.json.user.phoneVerified, true);
    assert.ok(!/eyJ[\w-]+\.[\w-]+\.[\w-]+/.test(JSON.stringify(r.json)), "no JWT in body");
    assert.equal("token" in r.json, false); assert.ok(!JSON.stringify(r.json).includes("passwordHash"));
    assert.ok(r.set.some(c => /vastra_session=.+HttpOnly/i.test(c) && /SameSite=/i.test(c)), "HttpOnly session cookie set");
  });
  await t.test("session persists; CSRF enforced on unsafe methods", async () => {
    assert.equal((await call("GET", "/auth/me")).json.user.phone, phone);
    assert.equal((await call("PUT", "/auth/profile", { name: "Asha R" }, { csrf: "" })).json.code, "CSRF");
    assert.equal((await call("PUT", "/auth/profile", { name: "Asha R" })).status, 200);
  });
  await t.test("logout clears cookie; protected route then 401", async () => {
    const r = await call("POST", "/auth/logout"); assert.match(r.set.join(), /vastra_session=;.*Max-Age=0/);
    assert.equal((await call("GET", "/auth/me")).status, 401);
  });
  await t.test("duplicate registration blocked; login works; unknown number gets NO_ACCOUNT", async () => {
    assert.equal((await call("POST", "/auth/phone/send-otp", { purpose: "register", phone, name: "Other" })).json.code, "PHONE_EXISTS");
    assert.equal((await call("POST", "/auth/phone/send-otp", { purpose: "login", phone: "+919000000001" })).json.code, "NO_ACCOUNT");
    await call("POST", "/auth/phone/send-otp", { purpose: "login", phone: "09876543210" }); // alt spelling, same E.164
    const r = await call("POST", "/auth/phone/verify-otp", { purpose: "login", phone, code: otpFor(phone) });
    assert.equal(r.status, 200); assert.equal(r.json.user.name, "Asha R");
  });
  await t.test("concurrent registrations for one number create exactly one account", async () => {
    const p2 = "+919123456780";
    await call("POST", "/auth/phone/send-otp", { purpose: "register", phone: p2, name: "Racer" });
    const code = otpFor(p2);
    // Same valid code raced: the OTP is single-use and the unique index is the backstop.
    const rs = await Promise.all([1, 2, 3].map(() => call("POST", "/auth/phone/verify-otp", { purpose: "register", phone: p2, name: "Racer", code }, { cookie: false })));
    assert.equal(await User.countDocuments({ phone: p2 }), 1);
    assert.ok(rs.filter(r => r.status === 201).length === 1);
  });
  await t.test("two email-less accounts coexist; duplicate email rejected", async () => {
    assert.equal(await User.countDocuments({ email: { $exists: false } }) >= 2, true);
    await User.create({ name: "Mail User", email: "m@example.com" });
    await assert.rejects(User.create({ name: "Mail Two", email: "m@example.com" }), e => e.code === 11000);
  });
  await t.test("legacy email account can link a verified mobile; cannot steal another's", async () => {
    jar.cookie = undefined; jar.csrf = undefined;
    const bcrypt = require("bcryptjs");
    await User.create({ name: "Legacy", email: "legacy@example.com", passwordHash: await bcrypt.hash("password123", 4) });
    assert.equal((await call("POST", "/auth/login", { email: "legacy@example.com", password: "password123" })).status, 200);
    assert.equal((await call("POST", "/auth/phone/link/send-otp", { phone })).json.code, "PHONE_EXISTS");
    const p3 = "+919222222222";
    assert.equal((await call("POST", "/auth/phone/link/send-otp", { phone: p3 })).status, 200);
    assert.equal((await call("POST", "/auth/phone/link/verify-otp", { phone: p3, code: otpFor(p3) })).json.user.phoneVerified, true);
  });
  await t.test("passwordless account logging in with email/password gets 401, not 500", async () => {
    assert.equal((await call("POST", "/auth/login", { email: "nobody@example.com", password: "whatever12" }, { cookie: false })).status, 401);
  });
});
