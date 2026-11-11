const User = require('../models/User');
const otp = require('../services/otp');
const publicUser = require('../utils/publicUser');
const { startSession } = require('../utils/session');
const { normalizePhone } = require('../utils/phone');

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/;
const fail = (res, status, code, message, extra = {}) => res.status(status).json({ success: false, code, message, ...extra });

exports.googleLogin = async (req, res) => {
  const credential = String(req.body.credential || '');
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return res.status(503).json({ success: false, message: 'Google Sign-In is not configured yet.' });
  if (!credential) return res.status(400).json({ success: false, message: 'Google credential is required.' });
  let payload;
  try {
    const verification = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`, { signal: AbortSignal.timeout(5000) });
    if (!verification.ok) throw new Error('Google token rejected');
    payload = await verification.json();
    if (payload.aud !== clientId || !['accounts.google.com', 'https://accounts.google.com'].includes(payload.iss) || Number(payload.exp) * 1000 <= Date.now()) throw new Error('Google token claims rejected');
  } catch (_) { return res.status(401).json({ success: false, message: 'Google credential is invalid, expired, or could not be verified.' }); }
  if (!payload?.sub || !payload.email || !['true', true].includes(payload.email_verified)) return res.status(401).json({ success: false, message: 'A verified Google email is required.' });
  const email = payload.email.toLowerCase();
  let user = await User.findOne({ googleSub: payload.sub }).select('+googleSub');
  if (!user) {
    user = await User.findOne({ email });
    if (user) {
      if (user.authProvider === 'local' && user.passwordHash) {
        // Do not silently link Google to an existing password account; require the user to sign in first.
        return res.status(409).json({ success: false, message: 'An account already uses this email. Sign in with your existing method before linking Google.' });
      }
      user.googleSub = payload.sub;
      user.authProvider = user.phoneVerified ? 'google_phone' : 'google';
      user.emailVerified = true;
      if (!user.name && payload.name) user.name = String(payload.name).slice(0, 80);
      await user.save();
    } else {
      user = await User.create({ name: String(payload.name || email.split('@')[0]).trim().slice(0, 80) || 'VASTRA Customer', email, emailVerified: true, googleSub: payload.sub, authProvider: 'google' });
    }
  }
  res.json({ success: true, user: publicUser(user), ...startSession(res, user), message: 'Google sign-in successful.' });
};


/* ------------------------------------------------------------------ mobile OTP ------------------------------------------------------------------
 * purpose=register : new account (name required, email optional) -> verified phone becomes the unique login ID
 * purpose=login    : existing account with a VERIFIED number
 * purpose=link     : signed-in legacy/email/Google account adds + verifies a mobile number (no merging of accounts)
 * Business rules live here, not in the browser. */

/** Validates the request for a purpose and returns the cleaned inputs (or sends the error response and returns null). */
async function prepare(req, res, purpose) {
  const p = normalizePhone(req.body.phone, req.body.countryCode);
  if (!p.ok) { fail(res, 400, 'INVALID_PHONE', p.reason); return null; }
  const phone = p.e164;
  const holder = await User.findOne({ phone, phoneVerified: true }).select('_id');
  const out = { phone, holder };

  if (purpose === 'register') {
    const name = String(req.body.name || '').trim();
    if (name.length < 2 || name.length > 80) { fail(res, 400, 'INVALID_NAME', 'Enter your full name (2 to 80 characters).'); return null; }
    out.name = name;
    const rawEmail = String(req.body.email || '').trim().toLowerCase();
    if (rawEmail) {
      if (!EMAIL_RE.test(rawEmail) || rawEmail.length > 254) { fail(res, 400, 'INVALID_EMAIL', 'Enter a valid email address or leave it empty.'); return null; }
      if (await User.exists({ email: rawEmail })) { fail(res, 409, 'EMAIL_EXISTS', 'This email already belongs to an account. Log in with it, or use a different email.'); return null; }
      out.email = rawEmail;
    }
    if (holder) { fail(res, 409, 'PHONE_EXISTS', 'This mobile number is already registered. Please log in.'); return null; }
    const extra = cleanExtras(req.body);
    if (extra.error) { fail(res, 400, 'INVALID_PROFILE', extra.error); return null; }
    out.extra = extra.value;
  } else if (purpose === 'login') {
    if (!holder) { fail(res, 404, 'NO_ACCOUNT', 'No account found for this mobile number. Please create an account.'); return null; }
  } else if (purpose === 'link') {
    if (req.user.phoneVerified && req.user.phone === phone) { fail(res, 400, 'ALREADY_VERIFIED', 'This number is already verified on your account.'); return null; }
    if (holder && String(holder._id) !== String(req.user._id)) { fail(res, 409, 'PHONE_EXISTS', 'This mobile number is already registered to another account.'); return null; }
  }
  return out;
}

function cleanExtras(body) {
  const v = {};
  if (body.gender) { if (!['Male', 'Female', 'Other'].includes(body.gender)) return { error: 'Invalid gender.' }; v.gender = body.gender; }
  if (body.dateOfBirth) {
    const d = new Date(body.dateOfBirth);
    if (Number.isNaN(d.getTime()) || d > new Date() || d.getFullYear() < 1900) return { error: 'Enter a valid date of birth.' };
    v.dateOfBirth = d;
  }
  if (body.address && typeof body.address === 'object') {
    const a = {};
    for (const k of ['line1', 'line2', 'city', 'state', 'postalCode']) if (body.address[k]) a[k] = String(body.address[k]).trim().slice(0, 120);
    if (a.postalCode && !/^\d{6}$/.test(a.postalCode)) return { error: 'PIN code must be 6 digits.' };
    if (Object.keys(a).length) v.address = a;
  }
  return { value: v };
}

const sendFor = purpose => async (req, res) => {
  const ctx = await prepare(req, res, purpose);
  if (!ctx) return;
  try { await otp.send(ctx.phone); }
  catch (e) {
    if (e instanceof otp.OtpError) { if (e.retryAfterSec) res.set('Retry-After', String(e.retryAfterSec)); return fail(res, e.status, e.code, e.message, e.retryAfterSec ? { retryAfterSec: e.retryAfterSec } : {}); }
    throw e;
  }
  res.json({ success: true, message: 'OTP sent to your mobile number.', resendAfterSec: Number(process.env.OTP_RESEND_COOLDOWN_SEC || 30) });
};

const verifyFor = purpose => async (req, res) => {
  const code = String(req.body.code || '').trim();
  if (!/^\d{4,8}$/.test(code)) return fail(res, 400, 'INVALID_OTP', 'Enter the OTP you received.');
  const ctx = await prepare(req, res, purpose);   // re-validated: never trust that send-otp ran first
  if (!ctx) return;
  let approved;
  try { approved = await otp.check(ctx.phone, code); }
  catch (e) { if (e instanceof otp.OtpError) return fail(res, e.status, e.code, e.message, e.retryAfterSec ? { retryAfterSec: e.retryAfterSec } : {}); throw e; }
  if (!approved) return fail(res, 401, 'OTP_INVALID', 'OTP is invalid or expired. Please try again.');

  // The number is verified only from this point on.
  if (purpose === 'login') {
    const user = ctx.holder && await User.findById(ctx.holder._id);
    if (!user) return fail(res, 404, 'NO_ACCOUNT', 'No account found for this mobile number.');
    return res.json({ success: true, user: publicUser(user), ...startSession(res, user), message: 'Login successful.' });
  }
  if (purpose === 'register') {
    let user;
    try {
      user = await User.create({ name: ctx.name, ...(ctx.email ? { email: ctx.email } : {}), phone: ctx.phone, phoneVerified: true, phoneVerifiedAt: new Date(), authProvider: 'phone', ...ctx.extra,
        ...(ctx.extra.address ? { address: { country: 'India', ...ctx.extra.address } } : {}) });
    } catch (e) {
      if (e.code === 11000) {   // concurrent registration: the unique indexes are the source of truth
        const field = Object.keys(e.keyPattern || {})[0];
        if (field === 'email') return fail(res, 409, 'EMAIL_EXISTS', 'This email was just registered by another account. Use a different email or leave it empty.');
        return fail(res, 409, 'PHONE_EXISTS', 'This mobile number is already registered. Please log in.');
      }
      throw e;
    }
    return res.status(201).json({ success: true, user: publicUser(user), ...startSession(res, user), message: 'Account created. Welcome to VASTRA!' });
  }
  // link
  req.user.phone = ctx.phone; req.user.phoneVerified = true; req.user.phoneVerifiedAt = new Date();
  if (req.user.authProvider === 'google') req.user.authProvider = 'google_phone';
  try { await req.user.save(); }
  catch (e) { if (e.code === 11000) return fail(res, 409, 'PHONE_EXISTS', 'This mobile number is already registered to another account.'); throw e; }
  res.json({ success: true, user: publicUser(req.user), message: 'Mobile number verified and linked to your account.' });
};

const purposeOf = req => (['login', 'register'].includes(req.body.purpose) ? req.body.purpose : 'login');
exports.sendPhoneOtp = (req, res) => sendFor(purposeOf(req))(req, res);       // POST /auth/phone/send-otp   {phone,countryCode?,purpose,name?,email?}
exports.verifyPhoneOtp = (req, res) => verifyFor(purposeOf(req))(req, res);   // POST /auth/phone/verify-otp {…, code}
exports.sendLinkOtp = sendFor('link');                                          // POST /auth/phone/link/send-otp   (signed in)
exports.verifyLinkOtp = verifyFor('link');                                      // POST /auth/phone/link/verify-otp (signed in)
