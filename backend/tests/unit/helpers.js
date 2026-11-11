// Test doubles so controller/middleware LOGIC can be exercised without MongoDB/npm packages.
// (The integration suite covers the real stack.) Never loaded by production code.
const Module = require("module"), crypto = require("crypto"), path = require("path");

const b64 = o => Buffer.from(typeof o === "string" ? o : JSON.stringify(o)).toString("base64url");
const jwtStub = {
  sign(payload, secret, o = {}) {
    const now = Math.floor(Date.now() / 1000);
    const body = { ...payload, iat: now, exp: now + (o.expiresInSec ?? 7 * 86400), iss: o.issuer, aud: o.audience };
    const head = `${b64({ alg: "HS256", typ: "JWT" })}.${b64(body)}`;
    return `${head}.${crypto.createHmac("sha256", secret).update(head).digest("base64url")}`;
  },
  decode: t => JSON.parse(Buffer.from(t.split(".")[1], "base64url")),
  verify(t, secret) {
    const [h, p, s] = String(t).split(".");
    if (!s || crypto.createHmac("sha256", secret).update(`${h}.${p}`).digest("base64url") !== s) throw Object.assign(new Error("invalid signature"), { name: "JsonWebTokenError" });
    const d = JSON.parse(Buffer.from(p, "base64url"));
    if (d.exp * 1000 < Date.now()) throw Object.assign(new Error("jwt expired"), { name: "TokenExpiredError" });
    return d;
  },
};
// jsonwebtoken's real API takes expiresIn as "7d"; the stub accepts it but defaults to 7 days.
const realSign = jwtStub.sign; jwtStub.sign = (p, s, o = {}) => realSign(p, s, { ...o, expiresInSec: o.expiresInSec ?? (o.expiresIn === "1s" ? 1 : 7 * 86400) });

class FakeUser {
  static rows = [];
  static reset() { FakeUser.rows = []; FakeUser.seq = 0; }
  static _match(q) { return FakeUser.rows.find(r => Object.entries(q).every(([k, v]) => r[k] === v)); }
  static findOne(q) { const hit = FakeUser._match(q); const p = Promise.resolve(hit || null); p.select = () => p; return p; }
  static async exists(q) { return FakeUser._match(q) ? { _id: FakeUser._match(q)._id } : null; }
  static async findById(id) { return FakeUser.rows.find(r => String(r._id) === String(id)) || null; }
  static async create(doc) {
    const dupe = (f, ok) => ok && FakeUser.rows.find(r => r[f] === doc[f] && (f !== "phone" || r.phoneVerified));
    if (dupe("email", doc.email)) throw Object.assign(new Error("E11000"), { code: 11000, keyPattern: { email: 1 } });
    if (dupe("phone", doc.phoneVerified && doc.phone)) throw Object.assign(new Error("E11000"), { code: 11000, keyPattern: { phone: 1 } });
    const row = { _id: `u${++FakeUser.seq}`, role: "customer", tokenVersion: 0, wishlist: [], address: {}, emailVerified: false, phoneVerified: false, phone: "", ...doc,
      async save() { const o = FakeUser.rows.find(r => r !== this && this.phoneVerified && r.phoneVerified && r.phone === this.phone); if (o) throw Object.assign(new Error("E11000"), { code: 11000, keyPattern: { phone: 1 } }); } };
    FakeUser.rows.push(row); return row;
  }
}

const origLoad = Module._load;
function install() {
  const userPath = path.resolve(__dirname, "../../models/User.js");
  Module._load = function (req, parent, ...rest) {
    if (req === "jsonwebtoken") return jwtStub;
    if (req === "bcryptjs") return { hashSync: () => "x", hash: async () => "x", compare: async () => false };
    if (parent && !req.startsWith("node:") && req.startsWith(".") && path.resolve(path.dirname(parent.filename), req) === userPath.replace(/\.js$/, "")) return FakeUser;
    return origLoad.call(this, req, parent, ...rest);
  };
  for (const k of Object.keys(require.cache)) if (/VASTRA\/backend\/(controllers|middleware|utils\/session)/.test(k)) delete require.cache[k];
}
const uninstall = () => { Module._load = origLoad; };

function mockRes() {
  const res = { statusCode: 200, headers: {}, cookies: [], body: undefined,
    status(c) { res.statusCode = c; return res; }, json(b) { res.body = b; return res; },
    set(k, v) { res.headers[k] = v; return res; }, append(k, v) { if (k === "Set-Cookie") res.cookies.push(v); return res; } };
  return res;
}
const mockReq = (o = {}) => ({ body: {}, headers: {}, method: "POST", protocol: "http", get(h) { return { host: "localhost:5000", ...Object.fromEntries(Object.entries(this.headers).map(([k, v]) => [k.toLowerCase(), v])) }[h.toLowerCase()]; }, ...o });
module.exports = { install, uninstall, FakeUser, mockRes, mockReq, jwtStub };
