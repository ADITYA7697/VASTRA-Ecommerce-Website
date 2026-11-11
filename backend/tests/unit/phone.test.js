const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizePhone, maskPhone } = require("../../utils/phone");

const ok = (input, cc) => { const r = normalizePhone(input, cc); assert.equal(r.ok, true, JSON.stringify(r)); return r; };
const bad = (input, cc) => { const r = normalizePhone(input, cc); assert.equal(r.ok, false, `expected rejection of ${input}`); return r; };

test("Indian numbers normalise to the same E.164 in every common spelling", () => {
  for (const v of ["+919876543210", "+91 98765 43210", "98765 43210", "09876543210", "(+91) 98765-43210", "919876543210"]) {
    assert.equal(ok(v, v.startsWith("+") || v.startsWith("(") ? undefined : "IN").e164, "+919876543210", v);
  }
  assert.equal(ok("9876543210", "+91").e164, "+919876543210");
  assert.equal(ok("9876543210").e164, "+919876543210"); // default region IN (back-compat)
});
test("rejects invalid Indian mobiles", () => {
  bad("+915876543210"); bad("+91987654321"); bad("+9198765432101"); bad("1234567890", "IN");
});
test("rejects garbage and injection-ish input", () => {
  for (const v of ["", "   ", "abc", "98765x3210", "+91+9876543210", "9876543210; DROP", {}, null, undefined, "+", "0".repeat(30)]) bad(v);
});
test("unsupported country codes are rejected, not guessed", () => {
  assert.match(bad("+999123456789").reason, /not supported/);
  assert.match(bad("9876543210", "ZZ").reason, /not supported/);
});
test("other countries validate against their plan", () => {
  assert.equal(ok("+14155552671").e164, "+14155552671");
  assert.equal(ok("+447911123456").country, "GB");
  assert.equal(ok("+971501234567").country, "AE"); // +971 not misread as +97
  assert.equal(ok("+9779812345678").country, "NP");
  bad("+14155552671".replace("415", "115")); // US area code cannot start with 1
  bad("+447111"); bad("+971601234567");
});
test("+1 resolves to US or CA by plan, normalised identically", () => {
  assert.equal(ok("4155552671", "CA").e164, "+14155552671");
  assert.equal(ok("4155552671", "+1").e164, "+14155552671");
});
test("same number from two spellings is identical (uniqueness key)", () => {
  assert.equal(ok("+91 9876543210").e164, ok("09876543210", "IN").e164);
});
test("maskPhone hides the middle", () => { assert.equal(maskPhone("+919876543210"), "+91••••••3210"); assert.equal(maskPhone(""), ""); });
