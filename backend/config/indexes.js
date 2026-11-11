const mongoose = require("mongoose");

/**
 * Idempotent, non-destructive index upgrade for the users collection.
 * Old schema: unique non-partial `email_1` (allows only ONE account without an email, and the
 * required email forced placeholder addresses for phone users). We replace only that index;
 * no documents are modified or deleted.
 */
async function ensureUserIndexes() {
  const User = require("../models/User");
  const col = User.collection;
  let existing = [];
  try { existing = await col.indexes(); } catch (e) { if (e.codeName !== "NamespaceNotFound") throw e; }
  const old = existing.find(i => i.name === "email_1" && !i.partialFilterExpression);
  if (old) { await col.dropIndex("email_1"); console.log("Index upgrade: replaced legacy unique email_1 with a partial unique index."); }
  await User.createIndexes();
}
module.exports = { ensureUserIndexes };
