"use strict";
/**
 * Mobile-number normalisation to E.164 with per-country validation.
 *
 * Dependency-free on purpose. The table covers the main markets for VASTRA;
 * add a row to support another country. For worldwide coverage swap this module
 * for `libphonenumber-js` (same exported shape) — see README "Phone numbers".
 *
 * `nsn` = national significant number (digits after the country calling code,
 * no trunk "0"), validated against the mobile numbering plan of that country.
 */
const COUNTRIES = {
  IN: { dial: "91",  name: "India",          nsn: /^[6-9]\d{9}$/ },
  US: { dial: "1",   name: "United States",  nsn: /^[2-9]\d{2}[2-9]\d{6}$/ },
  CA: { dial: "1",   name: "Canada",         nsn: /^[2-9]\d{2}[2-9]\d{6}$/ },
  GB: { dial: "44",  name: "United Kingdom", nsn: /^7[1-9]\d{8}$/ },
  AE: { dial: "971", name: "UAE",            nsn: /^5[024568]\d{7}$/ },
  SA: { dial: "966", name: "Saudi Arabia",   nsn: /^5\d{8}$/ },
  QA: { dial: "974", name: "Qatar",          nsn: /^[3567]\d{7}$/ },
  SG: { dial: "65",  name: "Singapore",      nsn: /^[89]\d{7}$/ },
  MY: { dial: "60",  name: "Malaysia",       nsn: /^1\d{8,9}$/ },
  AU: { dial: "61",  name: "Australia",      nsn: /^4\d{8}$/ },
  NP: { dial: "977", name: "Nepal",          nsn: /^9[78]\d{8}$/ },
  BD: { dial: "880", name: "Bangladesh",     nsn: /^1[3-9]\d{8}$/ },
  LK: { dial: "94",  name: "Sri Lanka",      nsn: /^7\d{8}$/ },
};

// Dial codes sorted longest-first so "+971…" is never read as "+97…".
const DIALS = [...new Set(Object.values(COUNTRIES).map(c => c.dial))].sort((a, b) => b.length - a.length);
const DEFAULT_COUNTRY = "IN";

const fail = (reason) => ({ ok: false, reason });

/** Resolve a country selector ("IN", "+91", "91") to a table entry key list. */
function resolveCountry(selector) {
  const s = String(selector ?? "").trim().toUpperCase();
  if (!s) return { iso: DEFAULT_COUNTRY };
  if (COUNTRIES[s]) return { iso: s };
  const digits = s.replace(/^\+/, "");
  if (/^\d{1,3}$/.test(digits)) {
    const matches = Object.keys(COUNTRIES).filter(k => COUNTRIES[k].dial === digits);
    if (matches.length) return { dial: digits, candidates: matches };
  }
  return null;
}

/**
 * @param {string} input   "+919876543210", "98765 43210", "09876543210" …
 * @param {string} [countryCode]  "IN" | "+91" | "91" — used when `input` has no "+"
 * @returns {{ok:true,e164:string,country:string,dial:string,national:string}|{ok:false,reason:string}}
 */
function normalizePhone(input, countryCode) {
  if (typeof input !== "string" && typeof input !== "number") return fail("Enter a mobile number.");
  let raw = String(input).trim();
  if (raw.length > 25) return fail("Mobile number is too long.");
  if (/[^\d\s()+\-.]/.test(raw)) return fail("Mobile number may contain only digits, spaces and + ( ) - .");
  raw = raw.replace(/^[\s(]+/, ""); // tolerate "(+91) …"
  const hasPlus = raw.startsWith("+");
  if (raw.indexOf("+") > 0 || raw.lastIndexOf("+") > 0) return fail("The + sign is only allowed at the start.");
  raw = raw.replace(/[\s()+\-.]/g, "");
  if (!raw) return fail("Enter a mobile number.");

  let dial, candidates, nsn;
  if (hasPlus) {
    dial = DIALS.find(d => raw.startsWith(d));
    if (!dial) return fail("This country code is not supported yet.");
    candidates = Object.keys(COUNTRIES).filter(k => COUNTRIES[k].dial === dial);
    nsn = raw.slice(dial.length);
  } else {
    const sel = resolveCountry(countryCode);
    if (!sel) return fail("This country code is not supported yet.");
    if (sel.iso) { dial = COUNTRIES[sel.iso].dial; candidates = [sel.iso]; }
    else { dial = sel.dial; candidates = sel.candidates; }
    nsn = raw.replace(/^0+/, ""); // national trunk prefix, e.g. 098765… -> 98765…
    // A user who typed the country code without "+" ("919876543210" with +91 selected).
    if (nsn.startsWith(dial) && candidates.some(k => COUNTRIES[k].nsn.test(nsn.slice(dial.length)))) nsn = nsn.slice(dial.length);
  }
  if (!/^\d+$/.test(nsn)) return fail("Enter a valid mobile number.");
  const iso = candidates.find(k => COUNTRIES[k].nsn.test(nsn));
  if (!iso) return fail(`Enter a valid ${COUNTRIES[candidates[0]].name} mobile number.`);
  return { ok: true, e164: `+${dial}${nsn}`, country: iso, dial, national: nsn };
}

/** Last four digits only — safe for logs and UI hints. */
const maskPhone = (e164) => (e164 ? `${String(e164).slice(0, 3)}${"•".repeat(Math.max(0, String(e164).length - 7))}${String(e164).slice(-4)}` : "");

module.exports = { normalizePhone, maskPhone, COUNTRIES, DEFAULT_COUNTRY };
