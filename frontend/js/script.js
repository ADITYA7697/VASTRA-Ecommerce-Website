/* VASTRA production-style frontend bridge: API-first with guest fallback. */
(() => {
  "use strict";
  const API_BASE = (localStorage.getItem("vastraApiBase") || "http://localhost:5000/api").replace(/\/$/, "");
  const $ = (id) => document.getElementById(id);
  const safe = (v) => String(v ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const money = (v) => Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  // Session = HttpOnly cookie set by the API (invisible to JS). `token()` only says "we believe we are signed in";
// the server stays the authority and answers 401 when the cookie is missing/expired.
const token = () => localStorage.getItem("vastraLoggedIn") === "true" ? "session" : "";
  const csrf = () => localStorage.getItem("vastraCsrf") || "";
  (() => { if (localStorage.getItem("vastraToken")) { ["vastraToken","vastraUser","vastraLoggedIn","vastraCsrf"].forEach(k => localStorage.removeItem(k)); } })(); // legacy bearer token from older builds: drop it, user signs in again
  const user = () => read("vastraUser", null);
  let catalog = Array.isArray(window.products) ? window.products.slice() : [];
  let cartItems = read("vastraGuestCart", []);
  let wishlist = read("vastraGuestWishlist", []);
  let currentProducts = [];
  let catalogReady = Promise.resolve();
  const request = async (path, options = {}) => {
    const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
    if (csrf() && !["GET", "HEAD", undefined].includes(options.method)) headers["X-CSRF-Token"] = csrf();
    let response;
    try { response = await fetch(`${API_BASE}${path}`, { ...options, headers, credentials: "include" }); }
    catch { throw Object.assign(new Error("Cannot reach the server. Check your connection and try again."), { network: true }); }
    let body = {};
    try { body = await response.json(); } catch {}
    if (!response.ok) {
      const loginCall = /^\/auth\/(login|register|signup|phone\/(send|verify)-otp|forgot-password|reset-password|google)/.test(path);
      if (response.status === 401 && !loginCall && token()) { clearAuth(); sessionExpired(); }   // cookie expired/revoked
      throw Object.assign(new Error(body.message || (response.status >= 500 ? "Something went wrong on our side. Please try again." : `Request failed (${response.status})`)), { status: response.status, code: body.code, retryAfterSec: body.retryAfterSec });
    }
    return body;
  };
  const notify = (message, error = false) => {
    let el = document.querySelector(".notification");
    if (el) el.remove();
    el = document.createElement("div"); el.className = "notification" + (error ? " error" : "");
    el.setAttribute("role", "status"); el.textContent = message; document.body.appendChild(el);
    setTimeout(() => el.remove(), 2800);
  };
  const getId = p => p._id || p.id;
  // All bundled image URLs are root-relative so they work identically from
  // Live Server, Express localhost:5000, and nested pages such as /product.html.
  // Resolve bundled assets correctly both from Express (localhost) and when opened as file://.
  // Keep all known catalog photography local; remote DB image URLs must not override it.
  const assetPath = file => `assets/${file}`;
  const PLACEHOLDER_IMAGE = assetPath("product-placeholder.svg");
  const localImageFor = p => {
    const n = String(p?.name || '').toLowerCase();
    if (n.includes('t-shirt') || n.includes('tshirt') || n.includes('tee')) return assetPath('product-tshirt.jpg');
    if (n.includes('hoodie') || n.includes('beanie')) return assetPath('product-hoodie.jpg');
    if (n.includes('jean')) return assetPath('product-jeans.jpg');
    if (n.includes('oxford') || n.includes('casual shirt')) return assetPath('product-shirt.jpg');
    if (n.includes('bomber') || n.includes('utility jacket') || n.includes('jacket')) return assetPath('product-bomber.jpg');
    if (n.includes('sweatshirt') || n.includes('crewneck')) return assetPath('product-sweatshirt.jpg');
    if (n.includes('linen') || n.includes('summer shirt')) return assetPath('product-linen-shirt.jpg');
    if (n.includes('trouser') || n.includes('pants')) return assetPath('product-trousers.jpg');
    if (n.includes('sneaker') || n.includes('shoe') || n.includes('trainer')) return n.includes('retro') ? assetPath('product-retro-sneakers.jpg') : assetPath('product-white-sneakers.jpg');
    if (n.includes('backpack') || n.includes('rucksack')) return assetPath('product-backpack.jpg');
    if (n.includes('crossbody') || n.includes('cross-body')) return assetPath('product-crossbody.jpg');
    if (n.includes('tote')) return assetPath('product-tote.jpg');
    if (n.includes('sunglass')) return assetPath('product-sunglasses.jpg');
    if (n.includes('optical') || n.includes('frame') || n.includes('eyeglass')) return assetPath('product-glasses.jpg');
    if (n.includes('belt')) return assetPath('product-belt.jpg');
    if (String(p?.category || '').toLowerCase().includes('shoe')) return assetPath('product-white-sneakers.jpg');
    if (String(p?.category || '').toLowerCase().includes('bag')) return assetPath('product-backpack.jpg');
    return PLACEHOLDER_IMAGE;
  };
  const normalizeImage = value => {
    if (!value || typeof value !== 'string') return '';
    const raw = value.trim();
    // Fix paths saved by Live Server / older project folders in MongoDB.
    if (/^\/?(?:\.\/)?(?:frontend\/)?assets\//i.test(raw)) return raw.replace(/^\/?(?:\.\/)?(?:frontend\/)?/i, '');
    if (/^file:/i.test(raw) || /^[a-z]:[\\/]/i.test(raw)) return '';
    return raw;
  };
  // Prefer bundled local product photography for known catalog items. Database image URLs
  // can point to old Live Server/file paths and break on localhost:5000.
  const imageOf = p => {
    const local = localImageFor(p);
    if (local && local !== PLACEHOLDER_IMAGE) return local;
    return normalizeImage(p.image) || normalizeImage(Array.isArray(p.images) ? p.images[0] : '') || PLACEHOLDER_IMAGE;
  };
  const imageErrorHandler = "const placeholder='assets/product-placeholder.svg';const fallback=this.dataset.fallback||placeholder;if(!this.dataset.fallbackTried&&this.src!==new URL(fallback,document.baseURI).href){this.dataset.fallbackTried='1';this.src=fallback;}else{this.onerror=null;if(!this.dataset.placeholderTried&&this.src!==new URL(placeholder,document.baseURI).href){this.dataset.placeholderTried='1';this.src=placeholder;}}";
  const productCard = p => `<article class="product-card">
    <div class="product-image-box"><a href="product.html?id=${encodeURIComponent(getId(p))}"><img src="${safe(imageOf(p))}" data-fallback="${safe(localImageFor(p))}" alt="${safe(p.name)}" loading="lazy" onerror="${imageErrorHandler}"></a>
    <button class="wishlist ${isWished(getId(p)) ? "is-wishlisted" : ""}" data-product-id="${safe(getId(p))}" aria-label="Toggle wishlist"><span>${isWished(getId(p)) ? "♥" : "♡"}</span></button></div>
    <div class="product-info"><span class="product-category">${safe(p.category)}</span><h3><a href="product.html?id=${encodeURIComponent(getId(p))}">${safe(p.name)}</a></h3>
    <p class="product-description">${safe(p.description || "")}</p><div class="product-bottom"><strong>₹${money(p.price)}</strong><button class="small-btn add-cart" data-id="${safe(getId(p))}">Add to Cart</button></div></div></article>`;
  function isWished(id) { return wishlist.some(x => String(x) === String(id)); }
  async function loadCatalog() {
    try {
      const data = await request("/products?limit=100&sort=newest");
      if (Array.isArray(data.products) && data.products.length) {
        // Prefer database products when available; keep the bundled catalog as a safe first-run fallback.
        catalog = data.products;
      }
    } catch (e) { console.warn("VASTRA API unavailable; using demo catalog:", e.message); }
    currentProducts = catalog;
    renderProducts();
    renderFeatured();
    renderProductDetail();
    renderWishlist();
    updateCartCount();
  }
  function renderProducts() {
    const grid = $("productGrid"); if (!grid) return;
    const search = ($("searchInput")?.value || "").trim().toLowerCase();
    const params = new URLSearchParams(location.search);
    const requested = (params.get("category") || "all").toLowerCase();
    const activeButton = document.querySelector(".filter-btn.active");
    const category = activeButton?.dataset.category || requested;
    const filtered = catalog.filter(p => {
      const text = `${p.name} ${p.category} ${p.description || ""}`.toLowerCase();
      const c = String(p.category || "").toLowerCase();
      const categoryOk = category === "all" || c === category ||
        (category === "fashion" && c === "clothing") ||
        (category === "clothing" && ["men","women","fashion"].includes(c));
      return categoryOk && text.includes(search);
    });
    grid.innerHTML = filtered.length ? filtered.map(productCard).join("") : `<div class="empty-products"><h2>No products found</h2><p>Try a different search or category.</p></div>`;
  }
  async function renderFeatured() {
    const grid = $("featuredProducts"); if (!grid) return;
    let featured = catalog.filter(p => p.featured);
    try { const data = await request("/products/featured"); if (data.products?.length) featured = data.products; } catch {}
    grid.innerHTML = (featured.length ? featured : catalog).slice(0, 6).map(productCard).join("");
  }
  function localCartSave() { localStorage.setItem("vastraGuestCart", JSON.stringify(cartItems)); }
  function localCartTotal() { return cartItems.reduce((s, i) => s + Number(i.price || 0) * Number(i.quantity || 1), 0); }
  async function getCartData() {
    if (token()) {
      try {
        const data = await request("/cart");
        return (data.cart?.items || []).map(i => {
          const product = i.product && typeof i.product === "object" ? i.product : {};
          const localProduct = catalog.find(p => String(getId(p)) === String(product._id || i.product));
          const name = product.name || localProduct?.name || "Product";
          return {
            id: i._id, productId: product._id || i.product, name,
            price: Number(product.price ?? localProduct?.price ?? 0),
            image: imageOf({ ...localProduct, ...product, name, image: product.image || localProduct?.image }),
            quantity: Number(i.quantity || 1), size: i.size || ""
          };
        });
      } catch (e) { if (/log in|token|account/i.test(e.message)) clearAuth(); }
    }
    return cartItems;
  }
  async function addToCart(id) {
    const p = catalog.find(x => String(getId(x)) === String(id));
    if (!p) return notify("Product not found. Refresh and try again.", true);
    if ((p.sizes || []).length && !document.querySelector("[name=productSize]")) {
      location.href = `product.html?id=${encodeURIComponent(getId(p))}#choose-size`;
      return;
    }
    const sizeSelect = document.querySelector("[name=productSize]");
    if (sizeSelect && !sizeSelect.value) { sizeSelect.focus(); return notify("Please select a size first.", true); }
    if (Number(p.stock) <= 0) return notify("This item is currently out of stock.", true);
    if (token() && p._id) {
      try { await request("/cart/items", { method: "POST", body: JSON.stringify({ productId: p._id, quantity: 1, size: document.querySelector("[name=productSize]")?.value || "" }) }); notify("Added to your account cart ✓"); updateCartCount(); return; }
      catch (e) { notify(e.message, true); return; }
    }
    const old = cartItems.find(i => String(i.id) === String(id));
    if (old) old.quantity = Math.min(20, Number(old.quantity) + 1);
    else cartItems.push({ id, name: p.name, price: Number(p.price), image: imageOf(p), quantity: 1, size: document.querySelector("[name=productSize]")?.value || "" });
    localCartSave(); notify("Added to cart ✓"); updateCartCount(); renderCart();
  }
  async function updateCartCount() {
    const el = $("cartCount"); if (!el) return;
    const items = await getCartData();
    el.textContent = items.reduce((s, i) => s + Number(i.quantity || 0), 0);
  }
  async function renderCart() {
    const container = $("cartItems"); if (!container) return;
    const items = await getCartData(); cartItems = items;
    if (!items.length) { container.innerHTML = `<div class="empty-cart"><div class="empty-cart-icon">🛒</div><h2>Your cart is empty</h2><p>Find something you love.</p><a href="products.html" class="btn">Start Shopping</a></div>`; updateTotals(0); syncCheckoutButton(); return; }
    container.innerHTML = items.map(i => {
      const product = catalog.find(p => String(getId(p)) === String(i.productId || i.id));
      const img = normalizeImage(i.image) || (product ? imageOf(product) : localImageFor({name:i.name})) || PLACEHOLDER_IMAGE;
      return `<article class="cart-product"><img src="${safe(img)}" data-fallback="${safe(localImageFor({name:i.name}))}" alt="${safe(i.name)}" loading="lazy" onerror="${imageErrorHandler}"><div class="cart-product-info"><h3>${safe(i.name)}</h3><p>₹${money(i.price)} ${i.size?`· Size ${safe(i.size)}`:""}</p></div><div class="quantity"><button data-cart-action="minus" data-id="${safe(i.id)}" aria-label="Decrease quantity">−</button><span>${i.quantity}</span><button data-cart-action="plus" data-id="${safe(i.id)}" aria-label="Increase quantity">+</button></div><strong class="cart-price">₹${money(i.price*i.quantity)}</strong><button class="remove-btn" data-cart-action="remove" data-id="${safe(i.id)}" aria-label="Remove">×</button></article>`;
    }).join("");
    updateTotals(items.reduce((s,i)=>s+Number(i.price)*Number(i.quantity),0)); syncCheckoutButton();
  }
  // Guests may fill the cart, but "Proceed to Checkout" only sends them to login until they sign in or register.
  function syncCheckoutButton() {
    const b = document.querySelector(".checkout-btn"); if (!b) return;
    const guest = !token();
    b.textContent = guest ? "Login to Proceed to Checkout" : "Proceed to Checkout";
    b.classList.toggle("is-locked", guest); b.setAttribute("aria-disabled", String(guest));
  }
  function updateTotals(total) { ["subtotal","total"].forEach(id => { if ($(id)) $(id).textContent = money(total); }); }
  async function cartAction(action, id) {
    if (token()) {
      try {
        const data = await request("/cart");
        const item = (data.cart?.items || []).find(i => String(i._id) === String(id));
        if (action === "remove" && item) await request(`/cart/items/${id}`, { method: "DELETE" });
        else if (item && action === "plus") await request(`/cart/items/${id}`, { method: "PATCH", body: JSON.stringify({ quantity: Math.min(20, item.quantity + 1) }) });
        else if (item && action === "minus") {
          if (item.quantity <= 1) await request(`/cart/items/${id}`, { method: "DELETE" });
          else await request(`/cart/items/${id}`, { method: "PATCH", body: JSON.stringify({ quantity: item.quantity - 1 }) });
        }
      } catch (e) { notify(e.message, true); }
    } else {
      const item = cartItems.find(i => String(i.id) === String(id));
      if (action === "remove") cartItems = cartItems.filter(i => String(i.id) !== String(id));
      else if (item && action === "plus") item.quantity = Math.min(20, item.quantity + 1);
      else if (item && action === "minus") { if (item.quantity <= 1) cartItems = cartItems.filter(i => i !== item); else item.quantity--; }
      localCartSave();
    }
    await renderCart(); await updateCartCount();
  }
  async function clearCart() {
    const button = document.querySelector(".clear-btn[onclick=\"clearCart()\"]");
    if (button) { button.disabled = true; button.textContent = "Clearing…"; }
    try {
      if (token()) {
        await request("/cart", { method: "DELETE" });
      }
      cartItems = [];
      localStorage.removeItem("vastraGuestCart");
      await renderCart();
      await updateCartCount();
      notify("Your cart has been cleared.");
    } catch (e) {
      notify(e.message || "Could not clear your cart. Please try again.", true);
    } finally {
      if (button) { button.disabled = false; button.textContent = "Clear Cart"; }
    }
  }
  async function toggleWishlist(id) {
    if (token()) {
      const p = catalog.find(x => String(getId(x)) === String(id));
      if (p?._id) {
        try { const data = await request(`/auth/wishlist/${p._id}`, { method: "POST" }); wishlist = (data.wishlist || []).map(String); }
        catch (e) { notify(e.message, true); return; }
      }
    } else {
      wishlist = isWished(id) ? wishlist.filter(x => String(x) !== String(id)) : [...wishlist, id];
      localStorage.setItem("vastraGuestWishlist", JSON.stringify(wishlist));
    }
    document.querySelectorAll(".wishlist").forEach(b => { const active = isWished(b.dataset.productId); b.classList.toggle("is-wishlisted",active); const s=b.querySelector("span"); if(s)s.textContent=active?"♥":"♡"; });
    renderWishlist(); const count=$("wishlistHeaderCount"); if(count) count.textContent=wishlist.length;
    notify(isWished(id) ? "Saved to wishlist ♥" : "Removed from wishlist");
  }
  async function renderWishlist() {
    const grid = $("wishlistGrid"); if (!grid) return;
    if (token()) { try { const me=await request("/auth/me"); wishlist=(me.user.wishlist||[]).map(x=>String(x._id||x)); } catch {} }
    const list = catalog.filter(p => isWished(getId(p)));
    grid.innerHTML = list.length ? list.map(productCard).join("") : `<div class="empty-products"><h2>Your wishlist is empty</h2><p>Tap the heart on a product to save it.</p><a class="btn" href="products.html">Explore Products</a></div>`;
    if ($("wishlistHeaderCount")) $("wishlistHeaderCount").textContent = wishlist.length;
  }
  async function renderProductDetail() {
    const box=$("productDetail"); if(!box)return;
    const id=new URLSearchParams(location.search).get("id");
    let p=catalog.find(x=>String(getId(x))===String(id));
    if(!p && id){try{const data=await request(`/products/${encodeURIComponent(id)}`);p=data.product;if(p)catalog=[...catalog.filter(x=>String(getId(x))!==String(getId(p))),p];}catch{}}
    if(!p){box.innerHTML=`<div class="empty-products"><h2>Product not found</h2><p>This item may have been removed or the store database is unavailable.</p><a class="btn" href="products.html">Back to shop</a></div>`;return;}
    box.innerHTML=`<div class="detail-image"><img src="${safe(imageOf(p))}" data-fallback="${safe(localImageFor(p))}" alt="${safe(p.name)}" onerror="${imageErrorHandler}"></div><div class="detail-info"><span class="product-category">${safe(p.category)}</span><h1>${safe(p.name)}</h1><div class="detail-price">₹${money(p.price)}</div><p>${safe(p.description||"")}</p><p class="stock-note">${Number(p.stock)>0?`In stock: ${Number(p.stock)}`:"Currently unavailable"}</p><p class="return-badge">↩ 7-day easy returns after delivery</p>${(p.sizes||[]).length?`<label class="size-picker" id="choose-size">Select size <select name="productSize" required><option value="">Choose a size</option>${p.sizes.map(size=>`<option value="${safe(size)}">${safe(size)}</option>`).join("")}</select></label>`:""}<div class="detail-actions"><button class="btn add-cart" data-id="${safe(getId(p))}" ${Number(p.stock)<=0?"disabled":""}>Add to Cart</button><button class="wishlist ${isWished(getId(p))?"is-wishlisted":""}" data-product-id="${safe(getId(p))}"><span>${isWished(getId(p))?"♥":"♡"}</span> Wishlist</button></div><a class="text-link" href="products.html">← Continue shopping</a><section class="reviews-panel"><h2>Customer reviews</h2><div id="productReviews"><p>Loading reviews…</p></div><form id="reviewForm" class="review-form"><h3>Write a review</h3><label>Rating<select name="rating" required><option value="">Choose rating</option><option value="5">★★★★★ — Excellent</option><option value="4">★★★★ — Very good</option><option value="3">★★★ — Good</option><option value="2">★★ — Fair</option><option value="1">★ — Poor</option></select></label><label>Review<textarea name="comment" minlength="5" maxlength="1200" required></textarea></label><button class="btn" type="submit">Submit review</button><p id="reviewMessage" class="form-message"></p></form></section></div>`; loadReviews(p);
  }
  async function loadReviews(product) {
    const box=$("productReviews"), form=$("reviewForm"); if(!box)return; const id=getId(product);
    try { const data=await request(`/products/${encodeURIComponent(id)}/reviews`); const list=data.reviews||[]; box.innerHTML=list.length?list.map(r=>`<article class="review-item"><strong>${safe(r.name)}</strong><span class="review-stars">${"★".repeat(r.rating)}${"☆".repeat(5-r.rating)}</span><p>${safe(r.comment)}</p><small>${new Date(r.createdAt).toLocaleDateString("en-IN")}</small></article>`).join(""):`<p>No reviews yet. Be the first to share your experience.</p>`; } catch { box.innerHTML=`<p>Reviews will appear here when the product is loaded from the store database.</p>`; }
    if(form&&!form.dataset.bound){form.dataset.bound="1";form.addEventListener("submit",async e=>{e.preventDefault();if(!token()){sessionStorage.setItem("vastraReturnTo",location.pathname+location.search);location.href="login.html";return;}const msg=$("reviewMessage"),btn=form.querySelector('[type="submit"]');btn.disabled=true;try{await request(`/products/${encodeURIComponent(id)}/reviews`,{method:"POST",body:JSON.stringify({rating:Number(form.elements.rating.value),comment:form.elements.comment.value.trim()})});msg.textContent="Thank you. Your review is published.";msg.className="form-message success";form.reset();loadReviews(product);}catch(err){msg.textContent=err.message;msg.className="form-message error";}finally{btn.disabled=false;}});}
  }
  function clearAuth() { ["vastraToken","vastraUser","vastraLoggedIn","vastraCsrf"].forEach(k => localStorage.removeItem(k)); }
  function setAuth(data) {
    if (!data || !data.user) throw new Error("Login response was incomplete.");
    localStorage.setItem("vastraUser", JSON.stringify(data.user)); localStorage.setItem("vastraLoggedIn", "true");
    if (data.csrfToken) localStorage.setItem("vastraCsrf", data.csrfToken);   // CSRF token is useless without the HttpOnly cookie
  }
  let expiredShown = false;
  function sessionExpired() {
    if (expiredShown) return; expiredShown = true;
    notify("Your session has expired. Please log in again.", true);
    if (!/(^|\/)(login|signup|admin-login)\.html$/.test(location.pathname) && /(profile|orders|checkout|account|admin|wishlist)/.test(location.pathname)) {
      sessionStorage.setItem("vastraReturnTo", location.pathname.split("/").pop() + location.search);
      setTimeout(() => { location.href = /admin/.test(location.pathname) ? "admin-login.html" : "login.html"; }, 1200);
    }
  }
  /** Re-validates the cookie session on page load (refresh keeps you signed in; expiry is detected here). */
  async function syncSession() {
    if (!token()) return;
    try { const d = await request("/auth/me"); localStorage.setItem("vastraUser", JSON.stringify(d.user)); if (d.csrfToken) localStorage.setItem("vastraCsrf", d.csrfToken); }
    catch (e) { if (e.status === 401) { clearAuth(); } }
  }
  async function migrateGuestCart() {
    const guest = read("vastraGuestCart", []);
    if (!token() || !guest.length) return;
    try { await catalogReady; } catch {}
    let migrated = true;
    for (const item of guest) {
      const product = catalog.find(p => String(getId(p)) === String(item.id));
      if (!product?._id) { migrated = false; continue; }
      try { await request("/cart/items", { method: "POST", body: JSON.stringify({ productId: product._id, quantity: Math.max(1, Math.min(20, Number(item.quantity) || 1)), size: item.size || "" }) }); }
      catch (e) { migrated = false; console.warn("Guest cart item could not be migrated:", e.message); }
    }
    if (migrated) { localStorage.removeItem("vastraGuestCart"); cartItems = []; }
  }
  function setupLogin() {
    const form=$("loginForm"); if(!form||form.dataset.bound)return; form.dataset.bound="1";
    form.addEventListener("submit",async e=>{e.preventDefault();const msg=$("loginMessage");const btn=form.querySelector('[type="submit"]');btn.disabled=true;msg.textContent="Signing in…";
      try {const data=await request("/auth/login",{method:"POST",body:JSON.stringify({email:$("loginEmail").value.trim(),password:$("loginPassword").value})}); if(data.user.role==="admin"){msg.textContent="This is an admin account. Use Admin Login.";msg.className="form-message error";btn.disabled=false;return;} setAuth(data);await migrateGuestCart();msg.textContent="Login successful.";msg.className="form-message success";const next=sessionStorage.getItem("vastraReturnTo")||"profile.html";sessionStorage.removeItem("vastraReturnTo");location.href=next;}
      catch(err){msg.textContent=err.message;msg.className="form-message error";btn.disabled=false;}});
  }
  function setupSignup() {
    const form=$("signupForm"); if(!form||form.dataset.bound)return; form.dataset.bound="1";
    form.addEventListener("submit",async e=>{e.preventDefault();const msg=$("signupMessage"),btn=form.querySelector('[type="submit"]');const password=$("signupPassword").value;
      if(!$("signupPhone")||!$("signupPhone").value.trim()){msg.textContent="Mobile number is required.";msg.className="form-message error";return;}
      if(password.length<8){msg.textContent="Password must be at least 8 characters.";msg.className="form-message error";return;}
      if(password!==$("confirmPassword").value){msg.textContent="Passwords do not match.";msg.className="form-message error";return;}
      btn.disabled=true;msg.textContent="Creating account…";
      try{const data=await request("/auth/register",{method:"POST",body:JSON.stringify({name:$("signupName").value.trim(),email:$("signupEmail").value.trim(),password,phone:$("signupPhone")?.value.trim()||""})});setAuth(data);await migrateGuestCart();msg.textContent="Account created successfully.";msg.className="form-message success";location.href="profile.html";}
      catch(err){msg.textContent=err.message;msg.className="form-message error";btn.disabled=false;}});
  }
  function setupPasswordReset(){
    const forgot=$("forgotForm"); if(forgot&&!forgot.dataset.bound){forgot.dataset.bound="1";forgot.addEventListener("submit",async e=>{e.preventDefault();const msg=$("forgotMessage");try{const d=await request("/auth/forgot-password",{method:"POST",body:JSON.stringify({email:$("forgotEmail").value.trim()})});msg.textContent=d.developmentResetToken?`Development reset token (copy below): ${d.developmentResetToken}`:d.message;msg.className="form-message success";if(d.developmentResetToken)$("resetToken").value=d.developmentResetToken;}catch(err){msg.textContent=err.message;msg.className="form-message error";}});}
    const reset=$("resetForm");if(reset&&!reset.dataset.bound){reset.dataset.bound="1";reset.addEventListener("submit",async e=>{e.preventDefault();const msg=$("resetMessage");try{const d=await request("/auth/reset-password",{method:"POST",body:JSON.stringify({token:$("resetToken").value.trim(),password:$("resetPassword").value})});msg.textContent=d.message;msg.className="form-message success";}catch(err){msg.textContent=err.message;msg.className="form-message error";}});}
  }
  function setupAdminLogin() {
    const form=$("adminLoginForm"); if(!form||form.dataset.bound)return;form.dataset.bound="1";
    form.addEventListener("submit",async e=>{e.preventDefault();const msg=$("adminLoginMessage"),btn=form.querySelector('[type="submit"]');btn.disabled=true;
      try{const data=await request("/auth/login",{method:"POST",body:JSON.stringify({email:$("adminLoginEmail").value.trim(),password:$("adminLoginPassword").value})});if(data.user.role!=="admin")throw new Error("This account does not have administrator permissions.");setAuth(data);msg.textContent="Admin login successful.";msg.className="form-message success";location.href="admin.html";}
      catch(err){msg.textContent=err.message;msg.className="form-message error";btn.disabled=false;}});
  }
  async function logout(){ try { await request("/auth/logout",{method:"POST"}); } catch {} clearAuth(); location.href="index.html"; }
  async function setupCheckout() {
    const form=$("checkoutForm");if(!form)return;
    if(!token()){sessionStorage.setItem("vastraReturnTo","checkout.html");location.href="login.html";return;}
    try {const data=await request("/auth/me");const u=data.user;const a=u.address||{};
      const map={checkoutName:u.name,checkoutEmail:u.email,checkoutPhone:u.phone,checkoutAddress:a.line1,checkoutCity:a.city,checkoutState:a.state,checkoutPincode:a.postalCode};
      Object.entries(map).forEach(([id,val])=>{if($(id)&&!$(id).value)$(id).value=val||"";});
    } catch {}
    const items=await getCartData();const box=$("checkoutItems");
    if (!items.length) { if(box)box.innerHTML=`<div class="empty-products"><p>Your cart is empty.</p><a class="btn" href="products.html">Continue shopping</a></div>`; const submit=$("checkoutForm")?.querySelector('[type="submit"]'); if(submit)submit.disabled=true; return; }
    if(box)box.innerHTML=items.map(i=>`<div class="checkout-line"><img class="checkout-line-image" data-fallback="${safe(localImageFor({name:i.name}))}" src="${safe(normalizeImage(i.image)||localImageFor({name:i.name})||PLACEHOLDER_IMAGE)}" alt="${safe(i.name)}" onerror="${imageErrorHandler}"><div><strong>${safe(i.name)}</strong><span>Qty ${i.quantity}</span></div><strong>₹${money(i.price*i.quantity)}</strong></div>`).join("");
    const subtotal=items.reduce((s,i)=>s+i.price*i.quantity,0), shipping=subtotal>=999?0:79; let activeCoupon="", activeDiscount=0;
    const paintTotal=()=>{const total=Math.max(0,subtotal+shipping-activeDiscount);if($("checkoutSubtotal"))$("checkoutSubtotal").textContent=money(subtotal);if($("checkoutShipping"))$("checkoutShipping").textContent=shipping===0?"Free":`₹${money(shipping)}`;if($("checkoutDiscount"))$("checkoutDiscount").textContent=`−₹${money(activeDiscount)}`;if($("checkoutTotal"))$("checkoutTotal").textContent=money(total);if($("payTotal"))$("payTotal").textContent=money(total);};paintTotal();
    const couponInput=$("checkoutCoupon"),applyBtn=$("applyCouponBtn"),couponMsg=$("couponMessage");
    const markOffers=()=>document.querySelectorAll(".coupon-offer").forEach(b=>{const on=!!activeCoupon&&b.dataset.coupon===activeCoupon;b.classList.toggle("is-applied",on);const t=b.querySelector(".offer-tap");if(t)t.textContent=on?"Remove":"Apply";});
    const removeCoupon=()=>{activeCoupon="";activeDiscount=0;if(couponInput)couponInput.value="";if(couponMsg){couponMsg.textContent="Coupon removed.";couponMsg.className="form-message";}markOffers();paintTotal();};
    const applyCoupon=async raw=>{const code=String(raw||"").trim().toUpperCase();if(couponInput)couponInput.value=code;if(!code){if(couponMsg){couponMsg.textContent="Enter a coupon code.";couponMsg.className="form-message error";}return;}
      try{const d=await request("/coupons/check",{method:"POST",body:JSON.stringify({code,subtotal})});activeCoupon=d.code;activeDiscount=d.discount;couponMsg.textContent=`✓ ${d.code} applied — you save ₹${money(d.discount)}.`;couponMsg.className="form-message success";}
      catch(e){activeCoupon="";activeDiscount=0;couponMsg.textContent=e.message;couponMsg.className="form-message error";}
      markOffers();paintTotal();};
    couponInput?.addEventListener("input",()=>{couponInput.value=couponInput.value.toUpperCase();});
    couponInput?.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();applyCoupon(couponInput.value);}});
    applyBtn?.addEventListener("click",()=>applyCoupon(couponInput?.value));
    document.querySelectorAll(".coupon-offer").forEach(b=>b.addEventListener("click",()=>{if(activeCoupon&&b.dataset.coupon===activeCoupon)removeCoupon();else applyCoupon(b.dataset.coupon);}));
    if(form.dataset.bound)return;form.dataset.bound="1";
    const shippingAddress=()=>({name:$("checkoutName").value.trim(),phone:$("checkoutPhone").value.trim(),line1:$("checkoutAddress").value.trim(),city:$("checkoutCity").value.trim(),state:$("checkoutState").value.trim(),postalCode:$("checkoutPincode").value.trim(),country:"India"});
    const paymentMessage=$("paymentMessage");
    try { await request("/payments/config"); if(paymentMessage)paymentMessage.textContent="Online payment is available when configured by the store."; }
    catch { const online=form.querySelector('input[name="paymentMethod"][value="razorpay"]'); if(online){online.disabled=true;online.closest(".payment-option")?.classList.add("payment-disabled");} if(paymentMessage)paymentMessage.textContent="Online payment is currently unavailable. Please choose Cash on Delivery."; }
    form.addEventListener("submit",async e=>{e.preventDefault();if(!form.reportValidity())return;const btn=form.querySelector('[type="submit"]');btn.disabled=true;
      try {
        const method=form.querySelector('input[name="paymentMethod"]:checked')?.value||"cod"; let data;
        if(method==="razorpay") {
          
          if(!window.Razorpay) throw new Error("Secure payment window did not load. Please retry or choose Cash on Delivery.");
          const created=await request("/payments/razorpay/order",{method:"POST",body:JSON.stringify({shippingAddress:shippingAddress(),couponCode:activeCoupon})});
          data=await new Promise((resolve,reject)=>{let settled=false;const finish=(fn,v)=>{if(settled)return;settled=true;fn(v);};const checkout=new window.Razorpay({key:created.keyId,amount:created.amount,currency:created.currency,order_id:created.razorpayOrderId,name:"VASTRA",description:"Fashion order",prefill:{name:$("checkoutName").value.trim(),email:$("checkoutEmail").value.trim(),contact:$("checkoutPhone").value.trim()},theme:{color:"#171717"},handler:async response=>{try{const verified=await request("/payments/razorpay/verify",{method:"POST",body:JSON.stringify({...response,shippingAddress:shippingAddress()})});finish(resolve,verified);}catch(err){finish(reject,err);}},modal:{ondismiss:()=>finish(reject,new Error("Payment window closed. No order was placed."))}});checkout.on("payment.failed",()=>finish(reject,new Error("Payment failed. You can retry or choose Cash on Delivery.")));checkout.open();});
        } else { data=await request("/orders",{method:"POST",body:JSON.stringify({paymentMethod:"cod",shippingAddress:shippingAddress(),couponCode:activeCoupon})}); }
        sessionStorage.setItem("vastraLastOrder",JSON.stringify(data.order));location.href=`order-success.html?order=${encodeURIComponent(data.order._id)}`;
      } catch(err){notify(err.message,true);btn.disabled=false;}});
  }
  async function renderOrders() {
    const box=$("ordersList");if(!box)return;
    if(!token()){box.innerHTML=`<div class="empty-products"><h2>Login to view your orders</h2><a class="btn" href="login.html">Customer Login</a></div>`;return;}
    try{const data=await request("/orders/my-orders");const orders=data.orders||[];box.innerHTML=orders.length?orders.map(o=>{const rr=o.returnRequest||{};const deliveredAt=o.deliveredAt||o.updatedAt||o.createdAt;const returnEligible=o.status==="delivered"&&((Date.now()-new Date(deliveredAt).getTime())/86400000)<=7&&!rr.requested;return `<article class="order-card"><div class="order-card-top"><div><span class="order-id">Order #${safe(String(o._id).slice(-10).toUpperCase())}</span><h3>${(o.items||[]).length} item(s) · ₹${money(o.total)}</h3><small>Placed: ${new Date(o.createdAt).toLocaleString("en-IN")}</small></div><span class="order-status">${safe(o.status)}</span></div><div class="order-card-bottom"><span>Payment: ${safe(o.paymentMethod).toUpperCase()} · ${safe(o.paymentStatus||"pending")}</span><a class="btn secondary-btn" href="order-success.html?order=${encodeURIComponent(o._id)}">View details</a></div>${o.status==="delivered"?`<div class="return-panel"><strong>7-day return policy</strong><p>${rr.requested?`Return status: ${safe(rr.status||"requested").replace("_"," ")}`:returnEligible?"Eligible for return within 7 days of delivery.":"The 7-day return window has ended."}</p>${returnEligible?`<form class="return-form" data-return-order="${safe(o._id)}"><label>Return reason<select name="reason" required><option value="">Choose a reason</option><option value="wrong_item">Wrong item received</option><option value="damaged_item">Damaged item</option><option value="size_issue">Size/fit issue</option><option value="not_as_described">Not as described</option><option value="other">Other</option></select></label><label>Additional details (optional)<textarea name="note" maxlength="500" rows="2" placeholder="Tell us a little more"></textarea></label><button class="btn" type="submit">Request Return</button></form>`:""}</div>`:(o.status!=="cancelled"?`<p class="return-note">↩ 7-day easy returns after delivery</p>`:"")}</article>`}).join(""):`<div class="empty-products"><h2>No orders yet</h2><p>Your orders will appear here after checkout.</p><a class="btn" href="products.html">Start shopping</a></div>`;
      box.querySelectorAll("[data-return-order]").forEach(form=>form.addEventListener("submit",async e=>{e.preventDefault();const btn=form.querySelector('button[type="submit"]');btn.disabled=true;try{const fd=new FormData(form);const result=await request(`/orders/${encodeURIComponent(form.dataset.returnOrder)}/return`,{method:"POST",body:JSON.stringify({reason:fd.get("reason"),note:fd.get("note")})});notify(result.message||"Return request submitted");await renderOrders();}catch(err){notify(err.message,true);btn.disabled=false;}}));}
    catch(e){box.innerHTML=`<p class="form-message error">${safe(e.message)}</p>`;}
  }
  async function renderSuccess() {
    const box=$("successOrder");if(!box)return;
    let order=read("vastraLastOrder",null);
    const id=new URLSearchParams(location.search).get("order");
    if(id&&token()){try{const d=await request(`/orders/${encodeURIComponent(id)}`);order=d.order;}catch{}}
    if(!order){box.innerHTML=`<h2>Order confirmation not found</h2><a class="btn" href="products.html">Back to shop</a>`;return;}
    box.innerHTML=`<div class="success-icon">✓</div><p class="eyebrow">ORDER CONFIRMED</p><h1>Thank you!</h1><p>Your order <strong>${safe(order._id||order.id)}</strong> has been placed.</p><div class="success-summary"><div><span>Total</span><strong>₹${money(order.total)}</strong></div><div><span>Payment</span><strong>${safe(order.paymentMethod)==="razorpay"?"Online payment":"Cash on Delivery"}</strong></div><div><span>Status</span><strong>${safe(order.status||"confirmed")}</strong></div></div><div class="success-actions"><a class="btn" href="orders.html">View My Orders</a><a class="btn secondary-btn" href="products.html">Continue Shopping</a></div>`;
  }
  // Fills the dashboard numbers and the "Saved for later" / "Recent orders" previews on profile.html.
  async function fillProfileActivity(u) {
    const setText = (id, v) => { if ($(id)) $(id).textContent = v; };
    wishlist = (u.wishlist || []).map(x => String(x._id || x));
    try { await catalogReady; } catch {}
    const wl = catalog.filter(p => isWished(getId(p)));
    setText("profileWishlistCount", wl.length); setText("profileWishlistQuickCount", wl.length);
    const wbox = $("profileWishlistPreview");
    if (wbox) wbox.innerHTML = wl.length ? wl.slice(0, 4).map(p => `<a class="up-mini" href="product.html?id=${encodeURIComponent(getId(p))}"><img src="${safe(imageOf(p))}" data-fallback="${safe(localImageFor(p))}" alt="" onerror="${imageErrorHandler}"><span><strong>${safe(p.name)}</strong><small>₹${money(p.price)}</small></span></a>`).join("") : `<p class="up-empty">No favourites yet. Tap ♡ on a product to save it.</p>`;
    try { const items = await getCartData(); setText("profileCartCount", items.reduce((s, i) => s + Number(i.quantity || 0), 0)); setText("profileCartValue", "₹" + money(items.reduce((s, i) => s + Number(i.price || 0) * Number(i.quantity || 0), 0))); } catch {}
    try {
      const od = await request("/orders/my-orders"); const orders = od.orders || [];
      setText("profileOrdersCount", orders.length); setText("profileOrdersStat", orders.length);
      setText("profileOrdersValue", "₹" + money(orders.filter(o => o.status !== "cancelled").reduce((s, o) => s + Number(o.total || 0), 0)));
      const obox = $("profileOrdersPreview");
      if (obox) obox.innerHTML = orders.length ? orders.slice(0, 3).map(o => {
        const rr = o.returnRequest || {}, since = (Date.now() - new Date(o.deliveredAt || o.updatedAt || o.createdAt).getTime()) / 86400000;
        const action = rr.requested ? `<small>Return ${safe(String(rr.status || "requested").replace("_", " "))}</small>` : (o.status === "delivered" && since <= 7 ? `<a class="up-link" href="orders.html">Return this order →</a>` : "");
        return `<div class="up-order"><div class="up-order-top"><strong>#${safe(String(o._id).slice(-8).toUpperCase())}</strong><span class="up-status">${safe(o.status)}</span></div><small>${(o.items || []).length} item(s) · ₹${money(o.total)} · ${new Date(o.createdAt).toLocaleDateString("en-IN")}</small>${action}</div>`;
      }).join("") : `<p class="up-empty">No orders yet. Your purchases will show up here.</p>`;
    } catch {}
  }
  async function renderProfile() {
    const content=$("profileContent");if(!content)return;
    const guest=$("profileGuest");
    if(!token()){if(guest)guest.style.display="grid";content.style.display="none";return;}
    try {
      const data=await request("/auth/me");const u=data.user,a=u.address||{};
      if(guest)guest.style.display="none";content.style.display="block";
      const values={profileName:u.name,profileEmail:u.email,profilePhone:u.phone,profileAddress:a.line1,profileCity:a.city,profileState:a.state,profilePincode:a.postalCode,profileDob:u.dateOfBirth?String(u.dateOfBirth).slice(0,10):"",profileGender:u.gender||""};
      Object.entries(values).forEach(([id,v])=>{if($(id))$(id).value=v||"";});
      [["profileHeaderName",u.name],["profileHeaderEmail",u.email],["summaryName",u.name],["summaryEmail",u.email],["profileWishlistQuickCount",(u.wishlist||[]).length]].forEach(([id,v])=>{if($(id))$(id).textContent=v??"";});
      fillProfileActivity(u);const initials=(u.name||"V").split(/\s+/).map(x=>x[0]).join("").slice(0,2).toUpperCase();["accountHeroAvatar","summaryAvatar","heroAvatar"].forEach(id=>{if($(id))$(id).textContent=initials;});
      const form=$("profileForm");if(form&&!form.dataset.bound){form.dataset.bound="1";form.addEventListener("submit",async e=>{e.preventDefault();try{const result=await request("/auth/profile",{method:"PUT",body:JSON.stringify({name:$("profileName").value.trim(),gender:$("profileGender")?.value||"",dateOfBirth:$("profileDob")?.value||"",phone:$("profilePhone")?.value.trim()||"",address:{line1:$("profileAddress")?.value.trim()||"",city:$("profileCity")?.value.trim()||"",state:$("profileState")?.value.trim()||"",postalCode:$("profilePincode")?.value.trim()||"",country:"India"}})});localStorage.setItem("vastraUser",JSON.stringify(result.user));if($("profileMessage"))$("profileMessage").textContent="Profile saved successfully.";notify("Profile updated");}catch(err){if($("profileMessage"))$("profileMessage").textContent=err.message;}});}
    } catch(e){if(guest)guest.style.display="grid";content.style.display="none";notify("Please sign in again: "+e.message,true);}
  }
  async function loadAdmin() {
    const root=document.querySelector(".dashboard-page");if(!root)return;
    if(!token()){root.innerHTML=`<section class="panel-card"><h2>Administrator login required</h2><a class="btn" href="admin-login.html">Admin Login</a></section>`;return;}
    try{
      const me=await request("/auth/me");if(me.user.role!=="admin")throw new Error("Admin access required.");
      const data=await request("/products/admin/all");const list=data.products||[];
      if($("adminProductCount"))$("adminProductCount").textContent=list.length;
      if($("adminUserCount"))$("adminUserCount").textContent="…";
      if($("adminCartCount"))$("adminCartCount").textContent="—";
      if($("adminOrderCount"))$("adminOrderCount").textContent="…";
      try { const ud=await request("/auth/admin/users"); if($("adminUserCount"))$("adminUserCount").textContent=ud.users.length; const uh=$("adminUsers"); if(uh)uh.innerHTML=ud.users.map(u=>`<div class="admin-user-row"><div class="user-avatar">${safe((u.name||"U").slice(0,1).toUpperCase())}</div><div><strong>${safe(u.name)}</strong><small>${safe(u.email||u.phone)} · ${safe(u.role)}</small></div><small>${new Date(u.createdAt).toLocaleDateString()}</small><select data-user-role="${safe(u._id)}" aria-label="User role"><option value="customer" ${u.role==="customer"?"selected":""}>Customer</option><option value="admin" ${u.role==="admin"?"selected":""}>Admin</option></select></div>`).join("");uh?.querySelectorAll("[data-user-role]").forEach(sel=>sel.addEventListener("change",async()=>{try{await request(`/admin/users/${sel.dataset.userRole}/role`,{method:"PATCH",body:JSON.stringify({role:sel.value})});notify("User role updated");}catch(e){notify(e.message,true);loadAdmin();}})); } catch {}
      try {
        const od=await request("/orders/admin/all");
        if($("adminOrderCount"))$("adminOrderCount").textContent=od.orders.length;
        const orderBox=$("adminOrders");
        if(orderBox)orderBox.innerHTML=(od.orders||[]).slice(0,12).map(o=>`<article class="admin-user-row"><div><strong>Order #${safe(String(o._id).slice(-8).toUpperCase())} · ₹${money(o.total)}</strong><small>${safe(o.user?.name||"Customer")} · ${safe(o.user?.email||o.user?.phone||"")} · ${new Date(o.createdAt).toLocaleDateString("en-IN")}</small><small>${o.paymentMethod==="razorpay"?"Online":"COD"} · ${safe(o.paymentStatus||"pending")}${o.couponCode?` · Coupon ${safe(o.couponCode)}`:""}</small></div><select data-order-status="${safe(o._id)}" aria-label="Order status">${["placed","confirmed","processing","shipped","delivered","cancelled"].map(st=>`<option value="${st}" ${o.status===st?"selected":""} ${st==="placed"?"disabled":""}>${st}</option>`).join("")}</select></article>`).join("")||`<p class="hint">No orders yet.</p>`;
        const retBox=$("adminReturns");
        if(retBox){const rl=(od.orders||[]).filter(o=>o.returnRequest&&o.returnRequest.requested);
          retBox.innerHTML=rl.map(o=>{const rr=o.returnRequest;return `<article class="admin-user-row"><div><strong>Order #${safe(String(o._id).slice(-8).toUpperCase())} · ₹${money(o.total)}</strong><small>${safe(String(rr.reason||"").replace(/_/g," "))}${rr.note?` — ${safe(rr.note)}`:""}</small><small>${safe(o.user?.name||"Customer")} · ${o.paymentMethod==="razorpay"?"Paid online":"COD"} · requested ${rr.requestedAt?new Date(rr.requestedAt).toLocaleDateString("en-IN"):""}</small></div><select data-return-status="${safe(o._id)}" aria-label="Return status">${["requested","approved","rejected","completed"].map(st=>`<option value="${st}" ${rr.status===st?"selected":""} ${st==="requested"?"disabled":""}>${st}</option>`).join("")}</select></article>`;}).join("")||`<p class="hint">No return requests.</p>`;
          retBox.querySelectorAll("[data-return-status]").forEach(sel=>sel.addEventListener("change",async()=>{try{await request(`/orders/admin/${sel.dataset.returnStatus}/return`,{method:"PATCH",body:JSON.stringify({status:sel.value})});notify("Return request updated");loadAdmin();}catch(err){notify(err.message,true);loadAdmin();}}));}
        orderBox?.querySelectorAll("[data-order-status]").forEach(sel=>sel.addEventListener("change",async()=>{try{await request(`/orders/admin/${sel.dataset.orderStatus}/status`,{method:"PATCH",body:JSON.stringify({status:sel.value})});notify("Order status updated");}catch(err){notify(err.message,true);loadAdmin();}}));
      } catch {}
      try {
        const td=await request("/support/admin/all"); const tickets=$("adminTickets");
        if(tickets)tickets.innerHTML=(td.tickets||[]).slice(0,10).map(t=>`<article class="admin-user-row"><div><strong>${safe(t.topic)} · ${safe(t.name)}</strong><small>${safe(t.email)} · ${safe(t.message)}</small><small>Ticket ${safe(String(t._id).slice(-8).toUpperCase())}</small></div><select data-ticket-status="${safe(t._id)}" aria-label="Support ticket status">${["open","in_progress","resolved"].map(st=>`<option value="${st}" ${t.status===st?"selected":""}>${st.replace("_"," ")}</option>`).join("")}</select></article>`).join("")||`<p class="hint">No support tickets.</p>`;
        tickets?.querySelectorAll("[data-ticket-status]").forEach(sel=>sel.addEventListener("change",async()=>{try{await request(`/support/admin/${sel.dataset.ticketStatus}`,{method:"PATCH",body:JSON.stringify({status:sel.value})});notify("Support ticket updated");}catch(err){notify(err.message,true);}}));
      } catch {}
      try { const cd=await request("/coupons/admin/all");const cb=$("adminCoupons");if(cb)cb.innerHTML=(cd.coupons||[]).map(c=>`<article class="admin-user-row"><div><strong>${safe(c.code)} · ${c.discountPercent}%</strong><small>${safe(c.eligibility)} · ${c.active?"Active":"Inactive"} · Used ${c.uses||0} times</small></div><button class="clear-btn" data-coupon-toggle="${safe(c._id)}" data-active="${c.active?"true":"false"}">${c.active?"Deactivate":"Activate"}</button><button class="clear-btn" data-coupon-delete="${safe(c._id)}">Delete</button></article>`).join("")||`<p class="hint">No managed coupons yet. VASTRA20 and OLD10 have built-in eligibility rules.</p>`;cb?.querySelectorAll("[data-coupon-toggle]").forEach(b=>b.addEventListener("click",async()=>{try{const c=(cd.coupons||[]).find(x=>x._id===b.dataset.couponToggle);await request(`/coupons/admin/${b.dataset.couponToggle}`,{method:"PATCH",body:JSON.stringify({active:b.dataset.active!=="true",discountPercent:c.discountPercent,eligibility:c.eligibility,expiresAt:c.expiresAt,maxUses:c.maxUses})});loadAdmin();}catch(e){notify(e.message,true);}}));cb?.querySelectorAll("[data-coupon-delete]").forEach(b=>b.addEventListener("click",async()=>{if(!confirm("Delete this coupon?"))return;try{await request(`/coupons/admin/${b.dataset.couponDelete}`,{method:"DELETE"});loadAdmin();}catch(e){notify(e.message,true);}})); } catch {}
      const cf=$("adminCouponForm");if(cf&&!cf.dataset.bound){cf.dataset.bound="1";cf.addEventListener("submit",async e=>{e.preventDefault();try{await request("/coupons/admin",{method:"POST",body:JSON.stringify({code:$("adminCouponCode").value.trim(),discountPercent:Number($("adminCouponPercent").value),eligibility:$("adminCouponEligibility").value})});cf.reset();notify("Coupon created");loadAdmin();}catch(err){notify(err.message,true);}});}
      const af=$("adminCreateAdminForm");if(af&&!af.dataset.bound){af.dataset.bound="1";af.addEventListener("submit",async e=>{e.preventDefault();const m=$("adminCreateAdminMessage");try{const d=await request("/admin/admins",{method:"POST",body:JSON.stringify({name:$("newAdminName").value.trim(),email:$("newAdminEmail").value.trim(),password:$("newAdminPassword").value})});m.textContent=`Admin created: ${d.admin.email}`;m.className="form-message success";af.reset();}catch(err){m.textContent=err.message;m.className="form-message error";}});}
      const holder=$("adminProducts");if(holder)holder.innerHTML=list.filter(p=>p.active!==false).map(p=>`<div class="admin-product-row"><img src="${safe(imageOf(p))}" alt=""><div><strong>${safe(p.name)}</strong><small>${safe(p.category)} · ₹${money(p.price)} · Stock ${p.stock}</small></div><button class="clear-btn" data-admin-remove="${safe(p._id)}">Deactivate</button></div>`).join("")||`<p class="hint">No active products.</p>`;
      const form=$("adminAddForm");if(form&&!form.dataset.bound){form.dataset.bound="1";form.addEventListener("submit",async e=>{e.preventDefault();try{await request("/products/admin/create",{method:"POST",body:JSON.stringify({name:$("adminProductName").value.trim(),price:Number($("adminProductPrice").value),category:$("adminProductCategory").value,image:$("adminProductImage").value.trim(),stock:Math.max(0,Number($("adminProductStock")?.value||10)),description:$("adminProductDescription")?.value.trim()||"Added by VASTRA administrator",active:true})});form.reset();notify("Product added");loadAdmin();}catch(err){notify(err.message,true);}});}
      holder?.querySelectorAll("[data-admin-remove]").forEach(btn=>btn.addEventListener("click",async()=>{if(!confirm("Deactivate this product?"))return;try{await request(`/products/admin/${btn.dataset.adminRemove}`,{method:"DELETE"});notify("Product deactivated");loadAdmin();}catch(e){notify(e.message,true);}}));
    }catch(e){root.innerHTML=`<section class="panel-card"><h2>Admin access error</h2><p>${safe(e.message)}</p><button class="btn" onclick="logout()">Log out</button></section>`;}
  }
  function setupEvents() {
    document.addEventListener("click",e=>{
      const add=e.target.closest(".add-cart");if(add){e.preventDefault();addToCart(add.dataset.id);}
      const wish=e.target.closest(".wishlist");if(wish){e.preventDefault();toggleWishlist(wish.dataset.productId||wish.dataset.id);}
      const action=e.target.closest("[data-cart-action]");if(action)cartAction(action.dataset.cartAction,action.dataset.id);
      const filter=e.target.closest(".filter-btn");if(filter){document.querySelectorAll(".filter-btn").forEach(b=>b.classList.toggle("active",b===filter));renderProducts();}
    });
    $("searchInput")?.addEventListener("input",renderProducts);
    document.querySelectorAll("[data-logout],.logout-button").forEach(b=>b.addEventListener("click",logout));
    const supportForm = $("supportForm");
    if (supportForm && !supportForm.dataset.bound) {
      supportForm.dataset.bound = "1";
      supportForm.addEventListener("submit", async e => {
        e.preventDefault(); const response=$("supportResponse"), btn=supportForm.querySelector('[type="submit"]'); btn.disabled=true;
        try { const data=await request("/support",{method:"POST",body:JSON.stringify({name:$("supportName").value.trim(),email:$("supportEmail").value.trim(),topic:$("supportTopic").value,message:$("supportMessage").value.trim()})}); if(response){response.textContent=`${data.message} Ticket ID: ${data.ticket.id}`;response.className="form-message success";}supportForm.reset(); }
        catch(err){if(response){response.textContent=err.message;response.className="form-message error";}} finally {btn.disabled=false;}
      });
    }
  }
  function init() {
    const requestedCategory = (new URLSearchParams(location.search).get("category") || "").toLowerCase();
    if (requestedCategory) {
      const requestedButton = [...document.querySelectorAll(".filter-btn")].find(b => b.dataset.category === requestedCategory);
      if (requestedButton) { document.querySelectorAll(".filter-btn").forEach(b => b.classList.toggle("active", b === requestedButton)); }
    }
    if(token())document.querySelectorAll('.nav a[href="login.html"],.nav a[href="signup.html"]').forEach(a=>{a.style.display="none";});
    setupEvents();setupLogin();setupSignup();setupAdminLogin();setupPasswordReset();catalogReady=loadCatalog();syncSession();
    renderCart();renderProfile();renderOrders();renderSuccess();setupCheckout();loadAdmin();
    if($("cartCount"))updateCartCount();
  }
  window.checkout=async function(){
    const button = document.querySelector(".checkout-btn");
    if (button) { button.disabled = true; button.textContent = "Checking cart…"; }
    try {
      const items = await getCartData();
      if (!items.length) { notify("Your cart is empty. Add a product before checkout.", true); return; }
      if (!token()) {
        sessionStorage.setItem("vastraReturnTo", "checkout.html");
        location.href = "login.html?returnTo=checkout.html";
        return;
      }
      try { await request("/auth/me"); }
      catch (e) { if (e.status === 401) { clearAuth(); syncCheckoutButton(); sessionStorage.setItem("vastraReturnTo", "checkout.html"); location.href = "login.html?returnTo=checkout.html"; return; } }
      location.href = "checkout.html";
    } finally {
      if (button) { button.disabled = false; syncCheckoutButton(); }
    }
  };
  window.clearCart = clearCart;
  window.logout=logout;window.adminLogout=logout;
  window.VASTRA={request,setAuth,clearAuth,migrateGuestCart,notify,API_BASE,isLoggedIn:()=>!!token()};
  window.addToCart=addToCart;window.toggleWishlist=toggleWishlist;
  document.addEventListener("DOMContentLoaded",init);
})();