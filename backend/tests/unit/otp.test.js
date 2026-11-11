process.env.NODE_ENV = "test"; process.env.OTP_PROVIDER = "test";
process.env.OTP_RESEND_COOLDOWN_SEC = "30"; process.env.OTP_MAX_SENDS_PER_HOUR = "3"; process.env.OTP_MAX_FAILED_CHECKS = "3";
const test = require("node:test");
const assert = require("node:assert/strict");
const otp = require("../../services/otp");
const P = "+919876543210", T0 = 1_000_000_000;
test.beforeEach(() => otp._resetForTests());

test("send then check approves the right code once, rejects reuse", async () => {
  await otp.send(P, T0);
  const code = otp._peekTestCode(P);
  assert.match(code, /^\d{6}$/);
  assert.equal(await otp.check(P, "000000", T0), false);
  assert.equal(await otp.check(P, code, T0), true);
  assert.equal(await otp.check(P, code, T0), false, "code must be single use");
});
test("a code for one number never verifies another", async () => {
  await otp.send(P, T0);
  assert.equal(await otp.check("+919876543211", otp._peekTestCode(P), T0), false);
});
test("resend cooldown and hourly cap", async () => {
  await otp.send(P, T0);
  await assert.rejects(otp.send(P, T0 + 5000), e => e.status === 429 && e.code === "OTP_COOLDOWN" && e.retryAfterSec === 25);
  await otp.send(P, T0 + 31000); await otp.send(P, T0 + 62000);
  await assert.rejects(otp.send(P, T0 + 93000), e => e.code === "OTP_LIMIT");
  await otp.send(P, T0 + 3600_000 + 1000); // window slides
});
test("wrong-guess lockout after N failures, even for the right code", async () => {
  await otp.send(P, T0); const code = otp._peekTestCode(P);
  for (let i = 0; i < 3; i++) assert.equal(await otp.check(P, "111111", T0), false);
  await assert.rejects(otp.check(P, code, T0 + 1000), e => e.status === 429 && e.code === "OTP_LOCKED");
  assert.equal(await otp.check(P, code, T0 + 16 * 60 * 1000), true, "lock expires");
});
test("unconfigured provider reports 503 instead of pretending", async () => {
  const saved = { ...process.env }; delete process.env.OTP_PROVIDER; for (const k of ["TWILIO_ACCOUNT_SID","TWILIO_AUTH_TOKEN","TWILIO_VERIFY_SERVICE_SID"]) delete process.env[k];
  try { assert.equal(otp.isConfigured(), false); await assert.rejects(otp.send(P), e => e.status === 503); }
  finally { Object.assign(process.env, saved); }
});
test("placeholder .env.example values count as unconfigured", () => {
  const saved = { ...process.env }; delete process.env.OTP_PROVIDER;
  Object.assign(process.env, { TWILIO_ACCOUNT_SID: "your-twilio-account-sid", TWILIO_AUTH_TOKEN: "your-twilio-auth-token", TWILIO_VERIFY_SERVICE_SID: "your-twilio-verify-service-sid" });
  try { assert.equal(otp.isConfigured(), false); } finally { Object.assign(process.env, saved); }
});
test("test provider is unreachable outside NODE_ENV=test", () => {
  const saved = process.env.NODE_ENV; process.env.NODE_ENV = "production";
  try { assert.throws(() => otp._peekTestCode(P)); } finally { process.env.NODE_ENV = saved; }
});
