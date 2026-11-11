/* VASTRA mobile-first auth: OTP signup, OTP login, mobile verification for existing accounts, optional Google.
 * Sessions are HttpOnly cookies set by the API; nothing secret is stored in the browser (see js/script.js).
 * Configure only the PUBLIC Google Web Client ID below (never a client secret). */
(() => {
  'use strict';
  const GOOGLE_CLIENT_ID = ''; // Paste the Google OAuth Web Client ID here (not a client secret).
  const COUNTRIES = [['IN', '🇮🇳 +91'], ['US', '🇺🇸 +1'], ['CA', '🇨🇦 +1'], ['GB', '🇬🇧 +44'], ['AE', '🇦🇪 +971'], ['SA', '🇸🇦 +966'], ['QA', '🇶🇦 +974'], ['SG', '🇸🇬 +65'], ['MY', '🇲🇾 +60'], ['AU', '🇦🇺 +61'], ['NP', '🇳🇵 +977'], ['BD', '🇧🇩 +880'], ['LK', '🇱🇰 +94']];
  const $ = id => document.getElementById(id);
  const V = () => window.VASTRA;           // exposed by script.js
  const message = (text, ok = false) => { const el = $('alternateAuthMessage'); if (el) { el.textContent = text; el.className = `form-message ${ok ? 'success' : 'error'}`; } };

  const mode = () => $('mobileSignupForm') ? 'register' : $('otpLoginPanel') ? 'login' : $('phoneVerifyPanel') ? 'link' : null;
  const numberInput = () => $('signupPhone') || $('phoneLoginNumber');
  const endpoint = (m, step) => m === 'link' ? `/auth/phone/link/${step}-otp` : `/auth/phone/${step}-otp`;

  function payload(m) {
    const base = { phone: numberInput().value.trim(), countryCode: $('otpCountry').value, purpose: m };
    if (m !== 'register') return base;
    const addr = { line1: $('signupAddress').value.trim(), city: $('signupCity').value.trim(), state: $('signupState').value.trim(), postalCode: $('signupPincode').value.trim() };
    return { ...base, name: $('signupName').value.trim(), email: $('signupEmail').value.trim(),
      dateOfBirth: $('signupDob').value || undefined, gender: $('signupGender').value || undefined, ...(Object.values(addr).some(Boolean) ? { address: addr } : {}) };
  }
  function clientValidate(m) {
    if (m === 'register' && $('signupName').value.trim().length < 2) return 'Enter your full name.';
    if (!numberInput().value.trim()) return 'Enter your mobile number.';
    if (m === 'register') { const e = $('signupEmail').value.trim(); if (e && !/^\S+@\S+\.\S{2,}$/.test(e)) return 'Enter a valid email address or leave it empty.'; }
    return '';   // authoritative validation is on the server
  }

  let timer;
  function startCooldown(sec) {
    const btn = $('resendOtp'); if (!btn) return; clearInterval(timer);
    let left = Math.max(0, Math.ceil(sec));
    const tick = () => { btn.disabled = left > 0; btn.textContent = left > 0 ? `Resend OTP in ${left}s` : 'Resend OTP'; left -= 1; if (left < -1) clearInterval(timer); };
    tick(); timer = setInterval(tick, 1000);
  }
  const lockInputs = locked => { ['otpCountry'].concat(['signupName', 'signupPhone', 'phoneLoginNumber', 'signupEmail']).forEach(id => { const el = $(id); if (el) el.disabled = locked; }); };

  async function sendOtp() {
    const m = mode(), button = $('sendPhoneOtp');
    const problem = clientValidate(m); if (problem) return message(problem);
    button.disabled = true; message('Sending OTP…', true);
    try {
      const data = await V().request(endpoint(m, 'send'), { method: 'POST', body: JSON.stringify(payload(m)) });
      $('otpVerifyGroup').hidden = false; button.hidden = true; lockInputs(true);
      message(data.message || 'OTP sent. Check your messages.', true); startCooldown(data.resendAfterSec || 30); $('phoneLoginOtp').focus();
    } catch (e) {
      button.disabled = false;
      if (e.code === 'PHONE_EXISTS' && m === 'register') return message('This mobile number is already registered. Please log in instead.');
      if (e.code === 'NO_ACCOUNT' && m === 'login') return message('No account found for this number. Create one with “Create your account”.');
      if (e.retryAfterSec) startCooldown(e.retryAfterSec);
      message(e.message);
    }
  }
  async function resendOtp() {
    const m = mode(), btn = $('resendOtp'); btn.disabled = true; message('Sending a new OTP…', true);
    try { const d = await V().request(endpoint(m, 'send'), { method: 'POST', body: JSON.stringify(payload(m)) }); message(d.message, true); startCooldown(d.resendAfterSec || 30); }
    catch (e) { message(e.message); startCooldown(e.retryAfterSec || 5); }
  }
  function changeNumber() {
    clearInterval(timer); $('otpVerifyGroup').hidden = true; $('sendPhoneOtp').hidden = false; $('sendPhoneOtp').disabled = false;
    $('phoneLoginOtp').value = ''; lockInputs(false); message(''); numberInput().focus();
  }
  async function verifyOtp() {
    const m = mode(), button = $('verifyPhoneOtp'), code = $('phoneLoginOtp').value.trim();
    if (!/^\d{4,8}$/.test(code)) return message('Enter the OTP you received.');
    button.disabled = true; message('Verifying OTP…', true);
    try {
      const data = await V().request(endpoint(m, 'verify'), { method: 'POST', body: JSON.stringify({ ...payload(m), code }) });
      if (m === 'link') { message('Mobile number verified.', true); V().setAuth({ ...data, csrfToken: undefined }); setTimeout(() => location.reload(), 900); return; }
      if (data.user.role === 'admin') { await V().request('/auth/logout', { method: 'POST' }).catch(() => {}); V().clearAuth(); throw new Error('Please use Admin Login for administrator accounts.'); }
      V().setAuth(data); await V().migrateGuestCart();
      message(m === 'register' ? 'Account created. Redirecting…' : 'Login successful. Redirecting…', true);
      const next = sessionStorage.getItem('vastraReturnTo') || 'profile.html'; sessionStorage.removeItem('vastraReturnTo');
      location.href = /^[\w./?=&-]+$/.test(next) && !/^\/\//.test(next) ? next : 'profile.html';   // same-site relative targets only
    } catch (e) {
      button.disabled = false; message(e.message);
      if (e.code === 'OTP_LOCKED') { startCooldown(e.retryAfterSec || 60); }
    }
  }

  function onGoogleCredential(response) {
    message('Signing in with Google…', true);
    V().request('/auth/google', { method: 'POST', body: JSON.stringify({ credential: response.credential }) })
      .then(async data => { if (data.user.role === 'admin') throw new Error('Please use Admin Login for administrator accounts.'); V().setAuth(data); await V().migrateGuestCart(); location.href = sessionStorage.getItem('vastraReturnTo') || 'profile.html'; })
      .catch(error => message(error.message));
  }
  function setupGoogle() {
    const slot = $('googleSignIn'); if (!slot) return;
    if (!GOOGLE_CLIENT_ID) { slot.setAttribute('data-setup-required', 'true'); return; }
    const script = document.createElement('script'); script.src = 'https://accounts.google.com/gsi/client'; script.async = true; script.defer = true;
    script.onload = () => {
      if (!window.google?.accounts?.id) return message('Google Sign-In could not load. Try another login method.');
      window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: onGoogleCredential });
      window.google.accounts.id.renderButton(slot, { theme: 'outline', size: 'large', shape: 'rectangular', text: 'continue_with', width: 280 });
    };
    script.onerror = () => message('Google Sign-In script could not load. Check your connection.');
    document.head.appendChild(script);
  }

  /* Profile page: show verification state for the signed-in account (legacy email accounts can add a verified mobile). */
  async function setupProfileVerification() {
    const panel = $('phoneVerifyPanel'); if (!panel) return;
    try {
      const { user } = await V().request('/auth/me');
      const status = $('profilePhoneStatus'), input = $('profilePhone');
      if (user.phoneVerified) { panel.hidden = true; if (input) { input.value = user.phone; input.readOnly = true; } if (status) status.textContent = '✓ Verified'; }
      else { panel.hidden = false; if (status) status.textContent = user.phone ? 'Not verified' : ''; }
    } catch { /* script.js already shows the sign-in prompt */ }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const sel = $('otpCountry');
    if (sel) sel.innerHTML = COUNTRIES.map(([iso, label]) => `<option value="${iso}">${label}</option>`).join('');
    $('sendPhoneOtp')?.addEventListener('click', sendOtp);
    $('verifyPhoneOtp')?.addEventListener('click', verifyOtp);
    $('resendOtp')?.addEventListener('click', resendOtp);
    $('changeNumber')?.addEventListener('click', changeNumber);
    $('phoneLoginOtp')?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); verifyOtp(); } });
    numberInput()?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); sendOtp(); } });
    $('mobileSignupForm')?.addEventListener('submit', e => { e.preventDefault(); ($('otpVerifyGroup').hidden ? sendOtp : verifyOtp)(); });
    setupGoogle(); setupProfileVerification();
  });
})();
