const PLACEHOLDER_EMAIL = /@phone\.vastra\.invalid$/i; // created by the previous phone-login implementation

/** The only user shape ever sent to a browser. Never add secrets/hashes/tokens here. */
module.exports = u => ({
  id: u._id,
  name: u.name,
  email: u.email && !PLACEHOLDER_EMAIL.test(u.email) ? u.email : "",
  emailVerified: !!u.emailVerified,
  phone: u.phone || "",
  phoneVerified: !!u.phoneVerified,
  role: u.role,
  authProvider: u.authProvider,
  gender: u.gender || "",
  dateOfBirth: u.dateOfBirth || null,
  address: u.address || {},
  wishlist: u.wishlist || []
});
module.exports.PLACEHOLDER_EMAIL = PLACEHOLDER_EMAIL;
