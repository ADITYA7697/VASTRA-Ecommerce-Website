const bcrypt = require("bcryptjs");
const User = require("../models/User");
const publicUser = require("../utils/publicUser");
const { startSession, endSession } = require("../utils/session");
const { normalizePhone } = require("../utils/phone");
const { csrfFor } = require("../utils/cookies");

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/;
// Hash of a random string, built lazily: compared when the account is unknown/passwordless so response time
// does not reveal which emails exist. Generated (not hard-coded) so it is always a valid bcrypt hash.
let dummyHash; const getDummyHash = () => dummyHash || (dummyHash = bcrypt.hashSync(require("crypto").randomBytes(16).toString("hex"), 12));

exports.register = async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password || !String(req.body.phone || "").trim()) return res.status(400).json({ success: false, message: "Name, email, mobile number and password are required." });
  if (String(password).length < 8 || String(password).length > 128) return res.status(400).json({ success: false, message: "Password must be 8 to 128 characters." });
  const normalized = String(email).trim().toLowerCase();
  const cleanName = String(name).trim();
  if (cleanName.length < 2 || cleanName.length > 80 || normalized.length > 254 || !EMAIL_RE.test(normalized)) return res.status(400).json({ success: false, message: "Enter a valid name and email address." });
  const doc = { name: cleanName, email: normalized, passwordHash: await bcrypt.hash(String(password), 12) };
  {
    const p = normalizePhone(req.body.phone, req.body.countryCode);
    if (!p.ok) return res.status(400).json({ success: false, message: p.reason || "Enter a valid mobile number." });
    doc.phone = p.e164; // required at signup; mobile/password login requires the number to be verified
  }
  const existingPhone = await User.findOne({ phone: doc.phone });
  if (existingPhone) return res.status(409).json({ success: false, code: "PHONE_EXISTS", message: "Mobile number already linked to an account." });
  let user;
  try { user = await User.create(doc); }
  catch (e) { if (e.code === 11000) return res.status(409).json({ success: false, code: "EMAIL_EXISTS", message: "Email already registered." }); throw e; }
  const session = startSession(res, user);
  res.status(201).json({ success: true, user: publicUser(user), ...session, message: "Account created." });
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ success: false, message: "Email and password are required." });
  const user = await User.findOne({ email: String(email).trim().toLowerCase() }).select("+passwordHash");
  // Passwordless (mobile/Google) accounts have no hash: previously bcrypt.compare(…, undefined) threw -> HTTP 500.
  const ok = await bcrypt.compare(String(password), user?.passwordHash || getDummyHash()) && !!user?.passwordHash;
  if (!ok) return res.status(401).json({ success: false, message: "Invalid email or password. If you signed up with your mobile number, log in with OTP." });
  const session = startSession(res, user);
  res.json({ success: true, user: publicUser(user), ...session, message: "Login successful." });
};


exports.loginPhone = async (req, res) => {
  const { phone, password } = req.body;
  if (!phone || !password) return res.status(400).json({ success: false, message: "Mobile number and password are required." });
  const normalized = normalizePhone(String(phone));
  if (!normalized.ok) return res.status(400).json({ success: false, message: "Enter a valid mobile number with country code, e.g. +919876543210." });
  const user = await User.findOne({ phone: normalized.e164 }).select("+passwordHash");
  const ok = await bcrypt.compare(String(password), user?.passwordHash || getDummyHash()) && !!user?.passwordHash;
  if (!ok) return res.status(401).json({ success: false, message: "Invalid mobile number or password, or this number is not linked to an account." });
  const session = startSession(res, user);
  res.json({ success: true, user: publicUser(user), ...session, message: "Login successful." });
};
exports.logout = async (_req, res) => { endSession(res); res.json({ success: true, message: "Logged out." }); };
exports.logoutAll = async (req, res) => {
  req.user.tokenVersion = (req.user.tokenVersion || 0) + 1; await req.user.save();
  endSession(res); res.json({ success: true, message: "Logged out on all devices." });
};

exports.me = async (req, res) => res.json({ success: true, user: publicUser(req.user), csrfToken: req.session?.jti ? csrfFor(req.session.jti) : undefined });

exports.updateProfile = async (req, res) => {
  if (req.body.name !== undefined) {
    const name = String(req.body.name).trim();
    if (name.length < 2 || name.length > 80) return res.status(400).json({ success: false, message: "Name must be between 2 and 80 characters." });
    req.user.name = name;
  }
  if (req.body.phone !== undefined) {
    const raw = String(req.body.phone).trim();
    if (!raw) { if (req.user.phoneVerified) return res.status(400).json({ success: false, message: "Your verified mobile number cannot be removed." }); req.user.phone = ""; }
    else {
      const p = normalizePhone(raw, req.body.countryCode);
      if (!p.ok) return res.status(400).json({ success: false, message: p.reason });
      // A verified number is your login ID; changing it requires OTP verification (POST /auth/phone/link/*).
      if (req.user.phoneVerified && p.e164 !== req.user.phone) return res.status(400).json({ success: false, code: "PHONE_VERIFY_REQUIRED", message: "To change your verified mobile number, verify the new number with an OTP." });
      req.user.phone = p.e164;
    }
  }
  if (req.body.email !== undefined) {
    const e = String(req.body.email).trim().toLowerCase();
    if (e && !EMAIL_RE.test(e)) return res.status(400).json({ success: false, message: "Enter a valid email address." });
    if ((e || undefined) !== req.user.email) { req.user.email = e || undefined; req.user.emailVerified = false; }
  }
  if (req.body.gender !== undefined) {
    const g = String(req.body.gender);
    if (!["", "Male", "Female", "Other"].includes(g)) return res.status(400).json({ success: false, message: "Invalid gender selection." });
    req.user.gender = g;
  }
  if (req.body.dateOfBirth !== undefined) {
    if (!req.body.dateOfBirth) req.user.dateOfBirth = undefined;
    else { const d = new Date(req.body.dateOfBirth); if (isNaN(d) || d > new Date() || d.getFullYear() < 1900) return res.status(400).json({ success: false, message: "Enter a valid date of birth." }); req.user.dateOfBirth = d; }
  }
  if (req.body.address && typeof req.body.address === "object") {
    for (const key of ["line1", "line2", "city", "state", "postalCode", "country"]) {
      if (req.body.address[key] !== undefined) req.user.address[key] = String(req.body.address[key]).trim().slice(0, 120);
    }
  }
  try { await req.user.save(); }
  catch (e) { if (e.code === 11000) return res.status(409).json({ success: false, code: "EMAIL_EXISTS", message: "That email is already used by another account." }); throw e; }
  res.json({ success: true, user: publicUser(req.user) });
};

exports.toggleWishlist = async (req, res) => {
  const Product = require("../models/Product");
  const product = await Product.findOne({ _id: req.params.productId, active: true });
  if (!product) return res.status(404).json({ success: false, message: "Product not found." });
  const id = product._id.toString();
  const has = req.user.wishlist.some(x => x.toString() === id);
  req.user.wishlist = has ? req.user.wishlist.filter(x => x.toString() !== id) : [...req.user.wishlist, product._id];
  await req.user.save();
  res.json({ success: true, wishlist: req.user.wishlist });
};

const crypto = require("crypto");
exports.forgotPassword = async (req,res) => {
 const email=String(req.body.email||"").trim().toLowerCase(); if(!email.includes("@"))return res.status(400).json({success:false,message:"Enter a valid email address."});
 const user=await User.findOne({email}); const generic={success:true,message:"If an account exists for this email, password reset instructions will be available."};
 if(!user)return res.json(generic); const raw=crypto.randomBytes(32).toString("hex");user.passwordResetHash=crypto.createHash("sha256").update(raw).digest("hex");user.passwordResetExpires=Date.now()+15*60*1000;await user.save();
 // Production must configure an email provider before exposing reset links. Token is only returned in development.
 if(process.env.NODE_ENV!=="production") return res.json({...generic,developmentResetToken:raw,resetExpiresInMinutes:15});
 console.warn("Password reset requested; configure a mail provider to deliver the reset token.");return res.json(generic);
};
exports.resetPassword = async (req,res) => {
 const token=String(req.body.token||""),password=String(req.body.password||"");if(token.length<32||password.length<8)return res.status(400).json({success:false,message:"A valid reset token and password of at least 8 characters are required."});
 const hash=crypto.createHash("sha256").update(token).digest("hex");const user=await User.findOne({passwordResetHash:hash,passwordResetExpires:{$gt:Date.now()}}).select("+passwordResetHash +passwordResetExpires +passwordHash");if(!user)return res.status(400).json({success:false,message:"Reset token is invalid or expired."});user.passwordHash=await bcrypt.hash(password,12);user.tokenVersion=(user.tokenVersion||0)+1;user.passwordResetHash=undefined;user.passwordResetExpires=undefined;await user.save();res.json({success:true,message:"Password updated. Please log in."});
};

exports.adminUsers = async (_req,res) => { const users=await User.find().select("name email phone phoneVerified role createdAt").sort({createdAt:-1}).limit(500);res.json({success:true,users}); };
