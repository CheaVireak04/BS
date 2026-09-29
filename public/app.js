/**
 * ============================================================
 *  BRICK STORE — APP LOGIC
 * ============================================================
 *  You normally do NOT need to edit this file.
 *  - Products  → products.js
 *  - Words, Telegram username, delivery options, links → store-config.js
 *  - Colours and look → styles.css
 *
 *  What this file does:
 *  Telegram Mini App integration, search, filters, sorting, collections,
 *  product page, cart (saved in the browser), checkout, Grab location pin,
 *  and building the order message that is sent to Telegram.
 * ============================================================
 */

const app = {
    tg: null,
    supportUsername: (typeof STORE_CONFIG !== 'undefined' && STORE_CONFIG.supportUsername) || "Chea_Vireak",
    searchQuery: "",
    minPrice: 0,
    maxPrice: 1000,
    absMinPrice: 0,
    absMaxPrice: 1000,
    isPriceFilterActive: false,
    cart: [],
    isPanelOpen: false,
    isLeftPanelOpen: false,
    isDarkMode: true,
    currentCategory: 'home',          // collection: home | new | trending | deal | selling
    pendingOrderProductId: null,
    selectedCompany: null,
    currentVariant: null,

    // added in the renovation
    currentVariantProductId: null,    // which product currentVariant belongs to (fixes wrong-variant bug)
    currentProductId: null,
    currentView: 'home',
    detailQty: 1,
    categoryFilter: 'all',            // product category (from products.js "category")
    sortBy: 'featured',
    deliveryType: null,               // standard | grab | pickup
    deliveryValue: '',
    pendingOrderItems: [],
    isSubmitting: false,
    homeScroll: 0,
    historyDepth: 0,
    suggestionIndex: -1,
    activeLayer: null,                // element that currently traps focus (drawer / sheet)
    lastFocus: null,
    toastTimer: null,

    // MAP STATE VARIABLES
    mapLat: null,
    mapLng: null,
    isLocationConfirmed: false,
    googleMap: null,
    mapMarker: null,
    mapsPromise: null,

    COLLECTIONS: [
        { id: 'home',     label: 'All products', icon: 'grid' },
        { id: 'new',      label: 'New Arrivals', icon: 'sparkle' },
        { id: 'trending', label: 'Trending Now', icon: 'trend' },
        { id: 'deal',     label: 'Best Deals',   icon: 'tag' },
        { id: 'selling',  label: 'Best Selling', icon: 'trophy' }
    ],

    // =========================================================
    //  START-UP
    // =========================================================
    init() {
        const cfg = this.cfg();

        // Telegram Web App (only active when opened inside Telegram)
        try {
            this.tg = window.Telegram?.WebApp || null;
            this.tg?.expand?.();
            this.tg?.ready?.();
            this.tg?.BackButton?.onClick?.(() => this.goBack());
        } catch (e) { console.warn("Telegram WebApp API not detected."); }

        // Price bounds come from the products themselves
        if (Array.isArray(window.products) || typeof products !== 'undefined') {
            const prices = this.allProducts().map(p => Number(p.price)).filter(n => !isNaN(n));
            if (prices.length) {
                this.absMinPrice = Math.floor(Math.min(...prices));
                this.absMaxPrice = Math.ceil(Math.max(...prices));
            }
        }
        this.minPrice = this.absMinPrice;
        this.maxPrice = this.absMaxPrice;
        const mi = this.el('minPriceRange'), ma = this.el('maxPriceRange');
        if (mi && ma) {
            mi.min = this.absMinPrice; mi.max = this.absMaxPrice; mi.value = this.absMinPrice;
            ma.min = this.absMinPrice; ma.max = this.absMaxPrice; ma.value = this.absMaxPrice;
        }

        // Restore saved theme + cart
        let savedTheme = null;
        try {
            savedTheme = localStorage.getItem('brickTheme');
            const savedCart = localStorage.getItem('brickStoreCart');
            if (savedCart) this.cart = JSON.parse(savedCart) || [];
        } catch (e) { this.cart = []; }
        if (!Array.isArray(this.cart)) this.cart = [];
        if (savedTheme) this.isDarkMode = savedTheme !== 'light';
        else this.isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';

        this.setupViewportFix();
        this.reconcileCart();
        this.renderStaticContent();
        this.applyTheme();
        this.updateSliderUI();
        this.updateCartBadge();
        this.renderCatalog();

        // Browser / Android back button support
        try { history.replaceState({ view: 'home' }, ''); } catch (e) {}
        window.addEventListener('popstate', (e) => this.onPopState(e));
        document.addEventListener('keydown', (e) => this.onGlobalKeydown(e));
        document.addEventListener('click', (e) => {
            if (!e.target.closest || !e.target.closest('.search')) this.hideSuggestions();
        });
        // Follow the device's light/dark setting until the visitor picks one
        try {
            const mq = window.matchMedia('(prefers-color-scheme: dark)');
            const onChange = (ev) => {
                let saved = null; try { saved = localStorage.getItem('brickTheme'); } catch (err) {}
                if (!saved && !(this.tg && this.tg.initData)) { this.isDarkMode = ev.matches; this.applyTheme(); }
            };
            if (mq.addEventListener) mq.addEventListener('change', onChange); else if (mq.addListener) mq.addListener(onChange);
        } catch (e) {}
        try { this.tg?.onEvent?.('themeChanged', () => {
            let saved = null; try { saved = localStorage.getItem('brickTheme'); } catch (err) {}
            if (!saved) { this.isDarkMode = this.tg.colorScheme === 'dark'; this.applyTheme(); }
        }); } catch (e) {}
    },

    /**
     * Phones: when the on-screen keyboard opens, keep checkout/filter panels
     * inside the part of the screen you can still see (iPhone Safari + Android Chrome).
     */
    setupViewportFix() {
        const vv = window.visualViewport;
        if (!vv) return;
        const root = document.documentElement.style;
        const update = () => {
            root.setProperty('--vvh', vv.height + 'px');
            root.setProperty('--vvt', vv.offsetTop + 'px');
        };
        vv.addEventListener('resize', update);
        vv.addEventListener('scroll', update);
        update();
    },

    // =========================================================
    //  SMALL HELPERS
    // =========================================================
    cfg() { return (typeof STORE_CONFIG !== 'undefined') ? STORE_CONFIG : {}; },
    allProducts() { return (typeof products !== 'undefined' && Array.isArray(products)) ? products : []; },
    el(id) { return document.getElementById(id); },
    getProduct(id) { return this.allProducts().find(p => p.id === id); },
    esc(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    },
    money(n) { return (this.cfg().currencySymbol || '$') + Number(n || 0).toFixed(2); },
    icon(name, cls = '') { return `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`; },
    variantsOf(p) { return (p && Array.isArray(p.variants) && p.variants.length) ? p.variants : null; },
    defaultVariant(p) {
        const v = this.variantsOf(p);
        return v ? { name: v[0].name, price: Number(v[0].price) } : { name: 'Standard', price: Number(p.price) };
    },
    hasStock(p) { return p && typeof p.stock === 'number'; },
    isSoldOut(p) { return this.hasStock(p) && p.stock <= 0; },
    qtyInCart(productId) { return this.cart.filter(i => i && i.id === productId).reduce((a, i) => a + (i.quantity || 1), 0); },
    prefersReducedMotion() {
        try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
    },
    categories() {
        const seen = [];
        this.allProducts().forEach(p => { if (p.category && !seen.includes(p.category)) seen.push(p.category); });
        return seen;
    },
    imgTag(src, alt, extra = '') {
        return `<img src="${this.esc(src)}" alt="${this.esc(alt)}" loading="lazy" decoding="async" ${extra}
                 onload="app.onImgLoad(this)" onerror="app.onImgError(this)">`;
    },
    onImgLoad(img) {
        img.classList.add('is-loaded');
        if (img.parentElement) img.parentElement.classList.remove('is-loading-img');
    },
    onImgError(img) {
        const box = img.parentElement;
        img.style.visibility = 'hidden';
        if (box) {
            box.classList.remove('is-loading-img');
            if (!box.querySelector('.img-fallback')) {
                const f = document.createElement('div');
                f.className = 'img-fallback';
                f.setAttribute('aria-hidden', 'true');
                f.innerHTML = this.icon('image');
                box.appendChild(f);
            }
        }
    },

    haptic(style = 'light') {
        try { this.tg?.HapticFeedback?.impactOccurred?.(style); } catch (e) {}
    },

    /** Highlights the search words inside a product name (safe for any typed character). */
    highlightText(text) {
        const raw = String(text == null ? '' : text);
        const q = this.searchQuery;
        if (!q) return this.esc(raw);
        const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return raw.split(new RegExp(`(${safe})`, 'gi'))
            .map((part, i) => i % 2 === 1 ? `<mark class="search-highlight">${this.esc(part)}</mark>` : this.esc(part))
            .join('');
    },

    // =========================================================
    //  TEXT FROM store-config.js (hero, menus, checkout options)
    // =========================================================
    renderStaticContent() {
        const cfg = this.cfg();
        const name = cfg.storeName || 'BRICK STORE';
        const parts = name.split(' ');
        this.el('brand-strong').textContent = parts[0];
        this.el('brand-light').textContent = parts.slice(1).join(' ');
        this.el('brand-light').hidden = parts.length < 2;
        document.title = name;

        // Hero
        const hero = this.el('hero');
        if (hero) {
            hero.innerHTML = `
                ${cfg.heroImage ? `<div class="hero-banner">${this.imgTag(cfg.heroImage, name, 'loading="eager"')}</div>` : ''}
                <div class="hero">
                    ${cfg.heroEyebrow ? `<p class="hero-eyebrow">${this.esc(cfg.heroEyebrow)}</p>` : ''}
                    <h2 class="hero-title">${this.esc(cfg.heroTitle || name)}</h2>
                    ${cfg.heroSubtitle ? `<p class="hero-sub">${this.esc(cfg.heroSubtitle)}</p>` : ''}
                </div>`;
        }

        // Collections: header (desktop), chips (phone/tablet), left drawer
        this.el('header-nav').innerHTML = this.COLLECTIONS.map(c =>
            `<button type="button" data-collection="${c.id}" onclick="app.setCategory('${c.id}')">${this.esc(c.label)}</button>`).join('');
        this.el('collection-chips').innerHTML = this.COLLECTIONS.map(c =>
            `<button type="button" class="chip" data-collection="${c.id}" aria-pressed="false" onclick="app.setCategory('${c.id}')">${this.esc(c.label)}</button>`).join('');
        this.el('left-collections').innerHTML = this.COLLECTIONS.map(c =>
            `<button type="button" class="menu-item" data-collection="${c.id}" onclick="app.setCategory('${c.id}')">${this.icon(c.icon)}${this.esc(c.label)}${this.icon('chev-right', 'chev')}</button>`).join('');

        // Categories (only shown when products have 2+ categories)
        const cats = this.categories();
        const showCats = cats.length >= 2;
        this.el('left-categories-section').hidden = !showCats;
        this.el('category-filter-group').hidden = !showCats;
        if (showCats) {
            this.el('left-categories').innerHTML = cats.map((c, i) =>
                `<button type="button" class="menu-item" data-category-index="${i}" onclick="app.pickCategoryFromMenu(${i})">${this.icon('folder')}${this.esc(c)}${this.icon('chev-right', 'chev')}</button>`).join('');
        }
        const showPrice = this.absMaxPrice > this.absMinPrice;
        this.el('price-filter-group').hidden = !showPrice;
        this.el('no-filters-hint').hidden = showCats || showPrice;
        this.el('filter-btn').hidden = !showCats && !showPrice;

        // About + contact
        this.el('about-text').textContent = cfg.aboutText || '';
        const links = (cfg.socialLinks || []).map((s, i) =>
            `<a href="${this.esc(s.url)}" class="menu-item" onclick="app.openSocial(app.cfg().socialLinks[${i}].url); return false;">${this.icon(s.icon || 'external')}${this.esc(s.name)}${this.icon('external', 'chev')}</a>`);
        links.push(`<a href="https://t.me/${this.esc(this.supportUsername.replace('@', ''))}" class="menu-item" onclick="app.openSocial('https://t.me/${this.esc(this.supportUsername.replace('@', ''))}'); return false;">${this.icon('telegram')}Telegram · @${this.esc(this.supportUsername.replace('@', ''))}${this.icon('external', 'chev')}</a>`);
        this.el('contact-links').innerHTML = links.join('');

        // Checkout: delivery options, companies, provinces
        this.el('delivery-options').innerHTML = (cfg.deliveryOptions || []).map((d, i) => `
            <button type="button" class="radio-card" role="radio" aria-checked="false" data-delivery-index="${i}" onclick="app.selectDelivery(${i})">
                <span class="radio-dot" aria-hidden="true"></span>
                <span class="radio-text"><span class="radio-title">${this.esc(d.label || d.value)}</span>${d.detail ? `<span class="radio-sub">${this.esc(d.detail)}</span>` : ''}</span>
            </button>`).join('');
        this.el('company-grid').innerHTML = (cfg.deliveryCompanies || []).map((c, i) => `
            <button type="button" class="company-box" role="radio" aria-checked="false" id="company-${this.companyDomId(c.id)}" data-company-index="${i}" onclick="app.selectCompany(app.cfg().deliveryCompanies[${i}].id)">
                ${c.logo ? `<img src="${this.esc(c.logo)}" alt="" loading="lazy" onerror="this.remove()">` : ''}
                <span>${this.esc(c.name || c.id)}</span>
            </button>`).join('');
        this.el('modal-province').innerHTML = (cfg.provinces || []).map(p =>
            `<option value="${this.esc(p.value)}">${this.esc(p.label || p.value)}</option>`).join('');
    },
    companyDomId(id) { return String(id).toLowerCase().replace(/[^a-z0-9]/g, '') || 'x'; },

    // =========================================================
    //  SEARCH
    // =========================================================
    matchesSearch(p, s) {
        if (!s) return true;
        return String(p.name || '').toLowerCase().includes(s) ||
            String(p.desc || '').toLowerCase().includes(s) ||
            String(p.category || '').toLowerCase().includes(s) ||
            (Array.isArray(p.tags) && p.tags.some(t => String(t).toLowerCase().includes(s)));
    },

    handleSearch(event) {
        const input = event && event.target ? event.target : this.el('searchInput');
        this.searchQuery = String(input.value || '').toLowerCase().trim();
        this.el('search-clear').hidden = !input.value;
        const box = this.el('search-suggestions');
        this.suggestionIndex = -1;

        if (this.searchQuery.length > 0) {
            const matches = this.allProducts().filter(p => this.matchesSearch(p, this.searchQuery)).slice(0, 5);
            if (matches.length > 0) {
                box.innerHTML = matches.map((p, i) => `
                    <li class="suggestion" role="option" id="sugg-${i}" aria-selected="false" data-id="${p.id}"
                        onmousedown="event.preventDefault()" onclick="app.selectSuggestion(${p.id})">
                        <img class="suggestion-thumb" src="${this.esc(p.image)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">
                        <span class="suggestion-name">${this.highlightText(p.name)}</span>
                        <span class="suggestion-price">${this.money(p.price)}</span>
                    </li>`).join('');
                this.showSuggestions();
            } else {
                this.hideSuggestions();
            }
        } else {
            this.hideSuggestions();
        }
        if (event && event.type === 'focus') return; // just re-show suggestions on focus
        this.renderCatalog();
    },
    showSuggestions() {
        const box = this.el('search-suggestions');
        box.hidden = false;
        this.el('searchInput').setAttribute('aria-expanded', 'true');
    },
    hideSuggestions() {
        const box = this.el('search-suggestions');
        if (!box) return;
        box.hidden = true;
        this.suggestionIndex = -1;
        const inp = this.el('searchInput');
        if (inp) { inp.setAttribute('aria-expanded', 'false'); inp.removeAttribute('aria-activedescendant'); }
    },
    onSearchKeydown(e) {
        const box = this.el('search-suggestions');
        const items = box.hidden ? [] : [...box.querySelectorAll('.suggestion')];
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            if (!items.length) return;
            e.preventDefault();
            const dir = e.key === 'ArrowDown' ? 1 : -1;
            this.suggestionIndex = (this.suggestionIndex + dir + items.length) % items.length;
            items.forEach((it, i) => it.setAttribute('aria-selected', i === this.suggestionIndex ? 'true' : 'false'));
            e.target.setAttribute('aria-activedescendant', items[this.suggestionIndex].id);
            items[this.suggestionIndex].scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (this.suggestionIndex > -1 && items[this.suggestionIndex]) {
                this.selectSuggestion(Number(items[this.suggestionIndex].dataset.id));
            } else {
                this.hideSuggestions();
                e.target.blur(); // closes the phone keyboard so results are visible
                const grid = this.el('category-title');
                if (grid) grid.scrollIntoView({ behavior: this.prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
            }
        } else if (e.key === 'Escape') {
            if (!box.hidden) { e.stopPropagation(); this.hideSuggestions(); }
            else if (e.target.value) { e.stopPropagation(); this.clearSearch(); }
        }
    },
    clearSearch() {
        const inp = this.el('searchInput');
        inp.value = '';
        this.searchQuery = '';
        this.el('search-clear').hidden = true;
        this.hideSuggestions();
        this.renderCatalog();
        inp.focus();
    },

    forceSearch(query) {
        this.haptic('light');
        const input = this.el('searchInput');
        if (input) input.value = query;
        this.searchQuery = String(query).toLowerCase();
        this.el('search-clear').hidden = !query;
        this.hideSuggestions();
        this.renderCatalog();
    },

    selectSuggestion(id) {
        this.haptic('light');
        this.hideSuggestions();
        this.el('searchInput').value = "";
        this.el('search-clear').hidden = true;
        this.searchQuery = "";
        this.renderCatalog();
        this.viewProduct(id);
    },

    /** Finds a close word from the products for "Did you mean…?" (works for any product type). */
    suggestSpelling(query) {
        if (!query || query.length < 3) return null;
        const words = new Set();
        this.allProducts().forEach(p => {
            String(p.name || '').split(/\s+/).forEach(w => w.length > 2 && words.add(w));
            (p.tags || []).forEach(t => words.add(String(t)));
            if (p.category) words.add(String(p.category));
        });
        const dist = (a, b) => {
            a = a.toLowerCase(); b = b.toLowerCase();
            const m = a.length, n = b.length, d = [];
            for (let i = 0; i <= m; i++) { d[i] = [i]; }
            for (let j = 1; j <= n; j++) { d[0][j] = j; }
            for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
                d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
            return d[m][n];
        };
        let best = null, bestD = Infinity;
        words.forEach(w => {
            if (w.toLowerCase() === query) return;
            const dd = dist(query, w);
            if (dd < bestD) { bestD = dd; best = w; }
        });
        const limit = Math.max(1, Math.floor(query.length / 3));
        return bestD <= limit ? best : null;
    },

    // =========================================================
    //  CATALOG (grid of products)
    // =========================================================
    getVisibleProducts() {
        const cfg = this.cfg();
        let list = [...this.allProducts()].filter(p => {
            const matchesSearch = this.matchesSearch(p, this.searchQuery);
            let matchesPrice = true;
            if (this.isPriceFilterActive) matchesPrice = (Number(p.price) >= this.minPrice) && (Number(p.price) <= this.maxPrice);
            const matchesCategory = this.categoryFilter === 'all' || p.category === this.categoryFilter;
            return matchesSearch && matchesPrice && matchesCategory;
        });

        // Collections (same rules as before the renovation)
        if (this.currentCategory === 'new') { list.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded)); list = list.slice(0, cfg.maxNewArrivals || 4); }
        else if (this.currentCategory === 'trending') { list.sort((a, b) => (b.clicks || 0) - (a.clicks || 0)); list = list.slice(0, cfg.maxTrending || 4); }
        else if (this.currentCategory === 'deal') { list.sort((a, b) => Number(a.price) - Number(b.price)); list = list.slice(0, cfg.maxBestDeals || 4); }
        else if (this.currentCategory === 'selling') { list.sort((a, b) => (b.sales || 0) - (a.sales || 0)); list = list.slice(0, cfg.maxBestSelling || 4); }

        // Sort menu
        const by = this.sortBy;
        if (by === 'newest') list.sort((a, b) => new Date(b.dateAdded || 0) - new Date(a.dateAdded || 0));
        else if (by === 'price-asc') list.sort((a, b) => Number(a.price) - Number(b.price));
        else if (by === 'price-desc') list.sort((a, b) => Number(b.price) - Number(a.price));
        else if (by === 'popular') list.sort((a, b) => (b.clicks || 0) - (a.clicks || 0));
        else if (by === 'bestselling') list.sort((a, b) => (b.sales || 0) - (a.sales || 0));
        return list;
    },

    cardHTML(p) {
        const sold = this.isSoldOut(p);
        const old = Number(p.oldPrice) > Number(p.price) ? `<span class="price-old"><span class="sr-only">Was </span>${this.money(p.oldPrice)}</span>` : '';
        let badge = '';
        if (sold) badge = `<span class="badge badge-muted">Sold out</span>`;
        else if (this.hasStock(p) && p.stock <= 3) badge = `<span class="badge">Only ${p.stock} left</span>`;
        else if (p.badge) badge = `<span class="badge">${this.esc(p.badge)}</span>`;
        const v = this.variantsOf(p);
        const metaParts = [];
        if (p.category) metaParts.push(this.esc(p.category));
        if (v && v.length > 1) metaParts.push(`${v.length} options`);
        return `
            <article class="card">
                <div class="card-media is-loading-img">
                    ${this.imgTag(p.image, p.name)}
                    ${badge}
                    <button type="button" class="quick-add" onclick="app.animateAddToCart(${p.id}, event)" aria-label="Add ${this.esc(p.name)} to cart" ${sold ? 'disabled' : ''}>
                        ${this.icon('plus')}
                    </button>
                </div>
                <div class="card-body">
                    ${metaParts.length ? `<span class="card-meta">${metaParts.join(' · ')}</span>` : ''}
                    <h3 class="card-title">${this.highlightText(p.name)}</h3>
                    <div class="price-row"><span class="price">${this.money(p.price)}</span>${old}</div>
                </div>
                <button type="button" class="card-link" onclick="app.viewProduct(${p.id})" aria-label="${this.esc(p.name)}, ${this.money(p.price)}"></button>
            </article>`;
    },

    renderCatalog() {
        const grid = this.el('product-grid');
        if (!grid) return;
        const list = this.getVisibleProducts();
        const collection = this.COLLECTIONS.find(c => c.id === this.currentCategory) || this.COLLECTIONS[0];

        // Title + count
        const title = this.el('category-title');
        if (title) {
            if (this.searchQuery) title.textContent = `Results for “${this.el('searchInput').value.trim()}”`;
            else if (this.categoryFilter !== 'all' && this.currentCategory === 'home') title.textContent = this.categoryFilter;
            else title.textContent = collection.label;
        }
        const count = this.el('results-count');
        if (count) count.textContent = `${list.length} ${list.length === 1 ? 'product' : 'products'}`;

        // Collection highlight everywhere
        document.querySelectorAll('[data-collection]').forEach(b => {
            const on = b.dataset.collection === this.currentCategory;
            if (b.classList.contains('chip')) b.setAttribute('aria-pressed', on ? 'true' : 'false');
            else if (on) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
        });
        document.querySelectorAll('[data-category-index]').forEach(b => {
            const on = this.categories()[Number(b.dataset.categoryIndex)] === this.categoryFilter;
            if (on) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
        });
        this.renderActiveFilters();
        const apply = this.el('filter-apply');
        if (apply) apply.textContent = list.length ? `Show ${list.length} ${list.length === 1 ? 'result' : 'results'}` : 'No results';

        if (list.length === 0) {
            const hasAny = this.allProducts().length > 0;
            let suggestionHtml = "";
            const suggestion = this.suggestSpelling(this.searchQuery);
            if (suggestion) {
                suggestionHtml = `<p class="state-text">Did you mean <button type="button" class="btn-link" style="min-height:auto;padding:0" onclick="app.forceSearch(this.dataset.q)" data-q="${this.esc(suggestion)}">${this.esc(suggestion)}</button>?</p>`;
            }
            grid.innerHTML = hasAny ? `
                <div class="state">
                    <div class="state-icon">${this.icon('search')}</div>
                    <p class="state-title">No products found</p>
                    <p class="state-text">${this.searchQuery ? `Nothing matches “${this.esc(this.el('searchInput').value.trim())}”. Check the spelling or try a different word.` : 'No products match these filters.'}</p>
                    ${suggestionHtml}
                    <div class="state-actions"><button type="button" class="btn btn-secondary" onclick="app.resetFilters()">Clear search &amp; filters</button></div>
                </div>` : `
                <div class="state">
                    <div class="state-icon">${this.icon('bag')}</div>
                    <p class="state-title">No products yet</p>
                    <p class="state-text">Products will appear here soon.</p>
                </div>`;
            return;
        }
        grid.innerHTML = list.map(p => this.cardHTML(p)).join('');
    },

    renderActiveFilters() {
        const box = this.el('active-filters');
        if (!box) return;
        const pills = [];
        if (this.categoryFilter !== 'all') {
            pills.push(`<button type="button" class="chip chip-remove" onclick="app.setCategoryFilter('all')" aria-label="Remove category filter ${this.esc(this.categoryFilter)}">${this.esc(this.categoryFilter)} ${this.icon('x')}</button>`);
        }
        if (this.isPriceFilterActive && (this.minPrice > this.absMinPrice || this.maxPrice < this.absMaxPrice)) {
            pills.push(`<button type="button" class="chip chip-remove" onclick="app.clearPriceFilter()" aria-label="Remove price filter">${this.money(this.minPrice)} – ${this.money(this.maxPrice)} ${this.icon('x')}</button>`);
        }
        box.innerHTML = pills.join('');
        box.hidden = pills.length === 0;
        const n = this.el('filter-count');
        if (n) { n.textContent = pills.length; n.hidden = pills.length === 0; }
    },

    setSort(value) {
        this.haptic('light');
        this.sortBy = value || 'featured';
        const s = this.el('sort-select'); if (s && s.value !== this.sortBy) s.value = this.sortBy;
        this.renderCatalog();
    },

    setCategoryFilter(cat) {
        this.haptic('light');
        this.categoryFilter = cat || 'all';
        this.renderCategoryChips();
        this.renderCatalog();
    },
    pickCategoryFromMenu(index) {
        const cat = this.categories()[index];
        this.currentCategory = 'home';
        this.categoryFilter = cat || 'all';
        this.searchQuery = '';
        const si = this.el('searchInput'); if (si) si.value = '';
        this.el('search-clear').hidden = true;
        if (this.isLeftPanelOpen) this.toggleLeftPanel();
        this.navigate('home');
        this.renderCategoryChips();
        this.renderCatalog();
    },
    renderCategoryChips() {
        const box = this.el('filter-categories');
        if (!box) return;
        const cats = ['all', ...this.categories()];
        box.innerHTML = cats.map((c, i) => `
            <button type="button" class="chip" role="radio" aria-checked="${this.categoryFilter === c ? 'true' : 'false'}"
                    tabindex="${this.categoryFilter === c ? '0' : '-1'}" onclick="app.setCategoryFilter(${i === 0 ? "'all'" : `app.categories()[${i - 1}]`})">
                ${i === 0 ? 'All' : this.esc(c)}
            </button>`).join('');
    },

    openFilters() {
        this.haptic('light');
        this.renderCategoryChips();
        this.renderCatalog();
        this.openSheet('filter-sheet');
    },
    closeFilters() { this.closeSheet('filter-sheet'); },

    // =========================================================
    //  PRODUCT PAGE
    // =========================================================
    selectVariant(price, name) {
        this.haptic('light');
        this.currentVariant = { name: name, price: Number(price) };
        this.currentVariantProductId = this.currentProductId;
        const p = this.getProduct(this.currentProductId);
        document.querySelectorAll('#variant-group .variant').forEach(b => {
            const on = b.dataset.name === String(name);
            b.setAttribute('aria-checked', on ? 'true' : 'false');
            b.tabIndex = on ? 0 : -1;
        });
        const sel = this.el('variant-selected'); if (sel) sel.textContent = name;
        this.updateDetailPrice(p);
    },
    selectVariantIndex(i) {
        const p = this.getProduct(this.currentProductId);
        const v = this.variantsOf(p);
        if (v && v[i]) this.selectVariant(v[i].price, v[i].name);
    },
    updateDetailPrice(p) {
        const price = Number(this.currentVariant ? this.currentVariant.price : p.price);
        const priceDisplay = this.el('detail-price');
        if (priceDisplay) priceDisplay.textContent = this.money(price);
        const old = this.el('detail-old-price');
        const save = this.el('detail-save');
        const showOld = p && Number(p.oldPrice) > price;
        if (old) { old.hidden = !showOld; old.innerHTML = showOld ? `<span class="sr-only">Was </span>${this.money(p.oldPrice)}` : ''; }
        if (save) { save.hidden = !showOld; save.textContent = showOld ? `Save ${this.money(Number(p.oldPrice) - price)}` : ''; }
        const bb = this.el('buybar-price'); if (bb) bb.textContent = this.money(price);
    },
    changeDetailQty(delta) {
        const p = this.getProduct(this.currentProductId);
        let q = this.detailQty + delta;
        const max = this.hasStock(p) ? Math.max(1, p.stock) : 99;
        q = Math.max(1, Math.min(max, q));
        this.detailQty = q;
        this.haptic('light');
        const out = this.el('detail-qty'); if (out) out.textContent = q;
        const minus = this.el('detail-qty-minus'); if (minus) minus.disabled = q <= 1;
        const plus = this.el('detail-qty-plus'); if (plus) plus.disabled = q >= max;
    },

    viewProduct(id, opts = {}) {
        const p = this.getProduct(id);
        if (!p) return;
        this.currentProductId = id;
        this.detailQty = 1;

        // Default variant for THIS product
        this.currentVariant = this.defaultVariant(p);
        this.currentVariantProductId = id;

        const images = (Array.isArray(p.gallery) && p.gallery.length) ? p.gallery : [p.image];
        const many = images.length > 1;
        const slides = images.map((src, idx) => `
            <div class="gallery-slide is-loading-img" role="group" aria-roledescription="slide" aria-label="${idx + 1} of ${images.length}">
                ${this.imgTag(src, `${p.name}${many ? ` — photo ${idx + 1}` : ''}`, idx === 0 ? 'loading="eager" fetchpriority="high"' : '')}
            </div>`).join('');
        const dots = many ? `<div class="gallery-dots" aria-hidden="true">${images.map((_, i) => `<span class="gallery-dot" ${i === 0 ? 'aria-current="true"' : ''}></span>`).join('')}</div>` : '';
        const thumbs = many ? `<div class="gallery-thumbs has-many">${images.map((src, i) => `
            <button type="button" class="gallery-thumb" aria-label="Show photo ${i + 1}" ${i === 0 ? 'aria-current="true"' : ''} onclick="app.goToSlide(${i})">
                <img src="${this.esc(src)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">
            </button>`).join('')}</div>` : '';

        const v = this.variantsOf(p);
        let variantsHTML = '';
        if (v && v.length > 0) {
            variantsHTML = `
                <div>
                    <p class="option-label" id="variant-label"><span>Option</span><span id="variant-selected">${this.esc(this.currentVariant.name)}</span></p>
                    <div class="variant-grid" id="variant-group" role="radiogroup" aria-labelledby="variant-label">
                        ${v.map((x, i) => `
                        <button type="button" class="variant" role="radio" aria-checked="${i === 0 ? 'true' : 'false'}" tabindex="${i === 0 ? 0 : -1}"
                                data-name="${this.esc(x.name)}" onclick="app.selectVariantIndex(${i})">
                            <span class="variant-name">${this.esc(x.name)}</span>
                            <span class="variant-price">${this.money(x.price)}</span>
                        </button>`).join('')}
                    </div>
                </div>`;
        }

        const sold = this.isSoldOut(p);
        let stockHTML = '';
        if (this.hasStock(p)) {
            if (sold) stockHTML = `<p class="stock-line"><span class="stock-dot out"></span>Sold out</p>`;
            else if (p.stock <= 3) stockHTML = `<p class="stock-line"><span class="stock-dot low"></span>Only ${p.stock} left</p>`;
            else stockHTML = `<p class="stock-line"><span class="stock-dot"></span>In stock</p>`;
        }
        const maxQty = this.hasStock(p) ? Math.max(1, p.stock) : 99;

        const deliveryList = (this.cfg().deliveryOptions || []).map(d =>
            `<li><strong style="color:var(--text);font-weight:500">${this.esc(d.label || d.value)}</strong>${d.detail ? ` — ${this.esc(d.detail)}` : ''}</li>`).join('');

        const c = this.el('product-detail-content');
        if (!c) return;
        c.innerHTML = `
            <div class="pdp">
                <div class="gallery">
                    <div class="gallery-track" id="gallery-track" ${many ? 'aria-roledescription="carousel" aria-label="Product photos"' : ''} onscroll="app.onGalleryScroll()">${slides}</div>
                    ${dots}${thumbs}
                </div>
                <div class="pdp-info">
                    <div>
                        ${p.category ? `<p class="pdp-eyebrow">${this.esc(p.category)}</p>` : ''}
                        <h1 class="pdp-title" id="pdp-title" tabindex="-1">${this.esc(p.name)}</h1>
                        <div class="pdp-price-row">
                            <span id="detail-price" class="pdp-price"></span>
                            <span id="detail-old-price" class="price-old" hidden></span>
                            <span id="detail-save" class="pdp-save" hidden></span>
                        </div>
                    </div>
                    ${variantsHTML}
                    <div class="qty-row">
                        <span class="field-label" style="margin:0" id="qty-label">Quantity</span>
                        <div class="stepper stepper-lg" role="group" aria-labelledby="qty-label">
                            <button type="button" id="detail-qty-minus" onclick="app.changeDetailQty(-1)" aria-label="Decrease quantity" disabled>${this.icon('minus')}</button>
                            <span id="detail-qty" aria-live="polite">1</span>
                            <button type="button" id="detail-qty-plus" onclick="app.changeDetailQty(1)" aria-label="Increase quantity" ${maxQty <= 1 ? 'disabled' : ''}>${this.icon('plus')}</button>
                        </div>
                    </div>
                    ${stockHTML}
                    <div class="pdp-actions">
                        <button type="button" class="btn btn-secondary" onclick="app.addFromDetail(event)" ${sold ? 'disabled' : ''}>${this.icon('bag')} Add to cart</button>
                        <button type="button" class="btn btn-primary" onclick="app.buyNowFromDetail()" ${sold ? 'disabled' : ''}>Buy now</button>
                    </div>
                    <div class="info-list">
                        <div class="info-item"><h3>Description</h3><p class="desc">${this.esc(p.desc || '')}</p></div>
                        ${deliveryList ? `<div class="info-item"><h3>Delivery options</h3><ul>${deliveryList}</ul></div>` : ''}
                        <div class="info-item"><h3>How ordering works</h3><p>Choose delivery, add your name and phone, and tap Place order. Your order goes straight to the shop, and you'll get an order number.</p></div>
                    </div>
                </div>
            </div>
            ${this.relatedHTML(p)}`;

        this.updateDetailPrice(p);
        const addBtn = this.el('buybar-add'), buyBtn = this.el('buybar-buy');
        if (addBtn) addBtn.disabled = sold;
        if (buyBtn) buyBtn.disabled = sold;
        document.title = `${p.name} · ${this.cfg().storeName || 'BRICK STORE'}`;
        this.navigate('product', opts);
    },

    relatedHTML(p) {
        const others = this.allProducts().filter(x => x.id !== p.id);
        const same = others.filter(x => p.category && x.category === p.category);
        const rest = others.filter(x => !same.includes(x));
        const list = [...same, ...rest].slice(0, 4);
        if (!list.length) return '';
        return `<section class="related" aria-labelledby="related-title">
                    <div class="section-head"><h2 class="section-title" id="related-title">You may also like</h2></div>
                    <div class="grid">${list.map(x => this.cardHTML(x)).join('')}</div>
                </section>`;
    },

    onGalleryScroll() {
        const track = this.el('gallery-track');
        if (!track) return;
        const i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
        document.querySelectorAll('.gallery-dot').forEach((d, k) => d.setAttribute('aria-current', k === i ? 'true' : 'false'));
        document.querySelectorAll('.gallery-thumb').forEach((d, k) => d.setAttribute('aria-current', k === i ? 'true' : 'false'));
    },
    goToSlide(i) {
        const track = this.el('gallery-track');
        if (!track) return;
        track.scrollTo({ left: i * track.clientWidth, behavior: this.prefersReducedMotion() ? 'auto' : 'smooth' });
        setTimeout(() => this.onGalleryScroll(), 350);
    },

    addFromDetail(event) {
        if (this.currentProductId == null) return;
        this.animateAddToCart(this.currentProductId, event, this.detailQty);
    },
    buyNowFromDetail() {
        if (this.currentProductId == null) return;
        this.openOrderSummary(this.currentProductId);
    },

    // =========================================================
    //  CART
    // =========================================================
    saveCart() {
        try { localStorage.setItem('brickStoreCart', JSON.stringify(this.cart)); } catch (e) {}
        this.updateCartBadge();
    },

    /**
     * Keeps saved carts in sync with products.js. When you change or remove a product,
     * customers' old carts update to the new name/price instead of ordering something
     * that no longer exists.
     */
    reconcileCart() {
        let changed = false, notify = false;
        const fixed = [];
        this.cart.forEach(item => {
            if (!item || typeof item !== 'object') { changed = true; return; }
            const p = this.getProduct(item.id);
            if (!p || this.isSoldOut(p)) { changed = true; notify = true; return; }
            let variant;
            const vs = this.variantsOf(p);
            if (vs) {
                const found = vs.find(v => v.name === (item.variant && item.variant.name));
                if (!found) { changed = true; notify = true; return; }
                variant = { name: found.name, price: Number(found.price) };
            } else {
                variant = { name: 'Standard', price: Number(p.price) };
            }
            let qty = Math.max(1, parseInt(item.quantity, 10) || 1);
            if (this.hasStock(p) && qty > p.stock) { qty = p.stock; changed = true; notify = true; }
            if (Number(item.cartPrice) !== variant.price) { changed = true; notify = true; }
            if (item.name !== p.name || item.image !== p.image) changed = true;
            const existing = fixed.find(f => f.id === p.id && f.variant.name === variant.name);
            if (existing) { existing.quantity += qty; changed = true; return; }
            fixed.push({ ...p, quantity: qty, variant, cartPrice: variant.price });
        });
        this.cart = fixed;
        if (changed) this.saveCart();
        if (notify) setTimeout(() => this.showToast('Your cart was updated to match the latest products and prices.'), 600);
    },

    animateAddToCart(productId, event, qty = 1) {
        if (event) { event.stopPropagation(); }
        this.haptic('medium');

        const p = this.getProduct(productId);
        if (!p) return;
        if (this.isSoldOut(p)) { this.showToast('Sorry, this item is sold out.'); return; }

        // Use the chosen variant ONLY if it belongs to this product
        const variantToAdd = (this.currentVariant && this.currentVariantProductId === productId)
            ? { name: this.currentVariant.name, price: Number(this.currentVariant.price) }
            : this.defaultVariant(p);

        let addQty = Math.max(1, parseInt(qty, 10) || 1);
        if (this.hasStock(p)) {
            const room = p.stock - this.qtyInCart(productId);
            if (room <= 0) { this.showToast(`You already have all ${p.stock} available in your cart.`); return; }
            if (addQty > room) { addQty = room; }
        }

        const existingIndex = this.cart.findIndex(i => i.id === productId && i.variant?.name === variantToAdd.name);
        if (existingIndex > -1) {
            this.cart[existingIndex].quantity += addQty;
        } else {
            this.cart.push({ ...p, quantity: addQty, variant: variantToAdd, cartPrice: variantToAdd.price });
        }
        this.saveCart();

        if (event) this.flyToCart(p, event);
        this.bumpCart();
        const label = addQty > 1 ? `${addQty} × added to cart` : 'Added to cart';
        this.showToast(label, { actionLabel: 'View cart', onAction: () => this.navigate('cart') });
    },

    flyToCart(p, event) {
        if (this.prefersReducedMotion()) return;
        try {
            const src = event.target && event.target.closest ? event.target.closest('.card, .pdp, .buy-bar') : null;
            const imgEl = !src ? null : src.classList.contains('card') ? src.querySelector('img') : document.querySelector('#gallery-track img');
            const startEl = (imgEl && imgEl.offsetParent !== null) ? imgEl : event.target;
            const targets = [this.el('nav-cart'), this.el('header-cart')].filter(t => t && t.offsetParent !== null);
            if (!startEl || !targets.length) return;
            const start = startEl.getBoundingClientRect();
            const end = targets[0].getBoundingClientRect();
            const fly = document.createElement('img');
            fly.src = p.image; fly.alt = ''; fly.className = 'flying-item';
            const size = 56;
            const sx = start.left + start.width / 2 - size / 2, sy = start.top + start.height / 2 - size / 2;
            fly.style.left = sx + 'px'; fly.style.top = sy + 'px';
            document.body.appendChild(fly);
            const dx = end.left + end.width / 2 - size / 2 - sx, dy = end.top + end.height / 2 - size / 2 - sy;
            requestAnimationFrame(() => requestAnimationFrame(() => {
                fly.style.transform = `translate(${dx}px, ${dy}px) scale(0.25)`;
                fly.style.opacity = '0.2';
            }));
            setTimeout(() => fly.remove(), 650);
        } catch (e) {}
    },

    bumpCart() {
        [this.el('nav-cart'), this.el('header-cart')].forEach(c => {
            if (!c) return;
            c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump');
        });
    },

    updateQuantity(index, delta) {
        this.haptic('light');
        const item = this.cart[index];
        if (!item) return;
        if (delta > 0) {
            const p = this.getProduct(item.id);
            if (this.hasStock(p) && this.qtyInCart(item.id) + delta > p.stock) {
                this.showToast(`Only ${p.stock} available.`);
                return;
            }
        }
        if (item.quantity + delta > 0) {
            item.quantity += delta;
        } else {
            this.removeFromCart(index);
            return;
        }
        this.saveCart();
        this.renderCart();
    },

    removeFromCart(index) {
        this.haptic('light');
        const removed = this.cart.splice(index, 1)[0];
        this.saveCart();
        this.renderCart();
        if (removed) {
            this.showToast(`Removed ${removed.name}`, {
                actionLabel: 'Undo',
                onAction: () => { this.cart.splice(Math.min(index, this.cart.length), 0, removed); this.saveCart(); this.renderCart(); }
            });
        }
    },

    cartTotals() {
        let total = 0, count = 0;
        this.cart.forEach(i => { if (!i) return; total += Number(i.cartPrice || i.price) * (i.quantity || 1); count += (i.quantity || 1); });
        return { total, count };
    },

    renderCart() {
        try {
            const content = this.el('cart-content');
            if (!content) return;

            if (this.cart.length === 0) {
                content.innerHTML = `
                    <h1 class="page-title" id="cart-title" tabindex="-1">Cart</h1>
                    <div class="state">
                        <div class="state-icon">${this.icon('bag')}</div>
                        <p class="state-title">Your cart is empty</p>
                        <p class="state-text">Browse the store and add something you like.</p>
                        <div class="state-actions"><button type="button" class="btn btn-primary" onclick="app.navigate('home'); app.setCategory('home');">Continue shopping</button></div>
                    </div>`;
                return;
            }

            const { total, count } = this.cartTotals();
            const itemsHTML = this.cart.map((item, index) => {
                if (!item) return '';
                const unit = Number(item.cartPrice || item.price);
                const qty = item.quantity || 1;
                return `
                <li class="cart-item">
                    <a href="#" class="cart-thumb is-loading-img" onclick="app.viewProduct(${item.id}); return false;" tabindex="-1" aria-hidden="true">${this.imgTag(item.image, '')}</a>
                    <div class="cart-info">
                        <div class="cart-top">
                            <div style="min-width:0">
                                <p class="cart-name"><a href="#" onclick="app.viewProduct(${item.id}); return false;">${this.esc(item.name)}</a></p>
                                <p class="cart-variant">${this.esc(item.variant?.name || 'Standard')}</p>
                                ${qty > 1 ? `<p class="cart-unit">${this.money(unit)} each</p>` : ''}
                            </div>
                            <span class="cart-line-total">${this.money(unit * qty)}</span>
                        </div>
                        <div class="cart-bottom">
                            <div class="stepper" role="group" aria-label="Quantity for ${this.esc(item.name)}">
                                <button type="button" aria-label="${qty === 1 ? 'Remove item' : 'Decrease quantity'}" onclick="app.updateQuantity(${index}, -1)">${this.icon(qty === 1 ? 'x' : 'minus', 'icon-sm')}</button>
                                <span aria-live="polite">${qty}</span>
                                <button type="button" aria-label="Increase quantity" onclick="app.updateQuantity(${index}, 1)">${this.icon('plus', 'icon-sm')}</button>
                            </div>
                            <button type="button" class="remove-btn" aria-label="Remove ${this.esc(item.name)}" onclick="app.removeFromCart(${index})">Remove</button>
                        </div>
                    </div>
                </li>`;
            }).join('');

            content.innerHTML = `
                <div style="margin-bottom:24px">
                    <h1 class="page-title" id="cart-title" tabindex="-1">Cart</h1>
                    <p class="page-sub">${count} ${count === 1 ? 'item' : 'items'}</p>
                </div>
                <div class="cart-layout">
                    <ul class="cart-list">${itemsHTML}</ul>
                    <aside class="summary-card" aria-label="Order summary">
                        <div class="summary-row"><span>Subtotal (${count} ${count === 1 ? 'item' : 'items'})</span><strong>${this.money(total)}</strong></div>
                        <div class="summary-row"><span>Delivery</span><strong style="color:var(--text-2);font-weight:400">Choose at checkout</strong></div>
                        <div class="summary-row summary-total"><span>Total</span><strong>${this.money(total)}</strong></div>
                        <button type="button" class="btn btn-primary btn-block" style="margin-top:16px" onclick="app.openOrderSummary()">Checkout</button>
                        <p class="summary-note">Your order goes straight to the shop.</p>
                    </aside>
                </div>`;
        } catch (e) {
            console.error("Cart render failed:", e);
            const content = this.el('cart-content');
            if (content) content.innerHTML = `<div class="state"><div class="state-icon">${this.icon('alert')}</div><p class="state-title">Something went wrong</p><p class="state-text">We couldn't show your cart. Please reload the page.</p><div class="state-actions"><button type="button" class="btn btn-secondary" onclick="location.reload()">Reload</button></div></div>`;
        }
    },

    // =========================================================
    //  GRAB EXPRESS: LOCATION + GOOGLE MAPS
    // =========================================================
    setLocationStatus(msg) {
        const s = this.el('location-status');
        if (!s) return;
        s.hidden = !msg;
        s.innerHTML = msg ? `${this.icon('alert')}<span>${this.esc(msg)}</span>` : '';
    },

    getGrabLocation() {
        this.haptic('medium');
        const b = this.el('btn-get-location');
        this.setLocationStatus('');
        if (!navigator.geolocation) {
            this.setLocationStatus("This device can't share its location. Please choose another delivery method or add directions in the note.");
            return;
        }
        b.classList.add('is-loading');
        b.setAttribute('aria-busy', 'true');
        navigator.geolocation.getCurrentPosition((pos) => {
            b.classList.remove('is-loading'); b.removeAttribute('aria-busy');
            this.mapLat = pos.coords.latitude;
            this.mapLng = pos.coords.longitude;
            b.hidden = true;
            this.initGoogleMap(this.mapLat, this.mapLng);
        }, (err) => {
            b.classList.remove('is-loading'); b.removeAttribute('aria-busy');
            b.innerHTML = `${this.icon('pin')} Try again`;
            const msg = err && err.code === 1
                ? "Location access is blocked. Allow location for Telegram (or your browser) in your phone's settings, then try again."
                : "We couldn't find your location. Check that GPS is on and try again.";
            this.setLocationStatus(msg);
        }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
    },

    /** Loads Google Maps only when needed (keeps the store fast). */
    loadGoogleMaps() {
        if (typeof google !== 'undefined' && google.maps && google.maps.Map) return Promise.resolve();
        if (this.mapsPromise) return this.mapsPromise;
        const key = this.cfg().googleMapsApiKey;
        if (!key || key.includes('YOUR_GOOGLE_MAPS_API_KEY')) return Promise.reject(new Error('no key'));
        this.mapsPromise = new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('timeout')), 10000);
            window.__brickMapsReady = () => { clearTimeout(timer); resolve(); };
            window.gm_authFailure = () => { clearTimeout(timer); reject(new Error('auth')); };
            const s = document.createElement('script');
            s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&loading=async&callback=__brickMapsReady`;
            s.async = true;
            s.onerror = () => { clearTimeout(timer); reject(new Error('load')); };
            document.head.appendChild(s);
        }).catch(err => { this.mapsPromise = null; throw err; });
        return this.mapsPromise;
    },

    showCoords() {
        const coordsDisplay = this.el('map-coords');
        coordsDisplay.textContent = `${Number(this.mapLat).toFixed(5)}, ${Number(this.mapLng).toFixed(5)}`;
        coordsDisplay.hidden = false;
    },

    resetConfirmButton() {
        const c = this.el('btn-confirm-location');
        c.className = 'btn btn-accent btn-block';
        c.innerHTML = 'Confirm this location';
    },

    initGoogleMap(lat, lng) {
        const container = this.el('map-container');
        const div = this.el('google-map');
        const confirm = this.el('btn-confirm-location');
        container.hidden = false;
        this.mapLat = lat; this.mapLng = lng;
        this.showCoords();
        confirm.hidden = false;
        this.resetConfirmButton();
        div.innerHTML = `<div class="map-fallback"><div class="spinner" style="margin:0"></div>Loading map…</div>`;

        const fallback = () => {
            div.innerHTML = `
                <div class="map-fallback">
                    ${this.icon('pin', 'icon-lg')}
                    <strong style="color:var(--text)">Your GPS location was found</strong>
                    <span>The map preview couldn't load, but your position is saved.</span>
                    <a href="https://www.google.com/maps?q=${lat},${lng}" target="_blank" rel="noopener" onclick="app.openSocial(this.href); return false;">Check it on Google Maps</a>
                </div>`;
            this.el('map-help').hidden = true;
        };

        this.loadGoogleMaps().then(() => {
            try {
                const center = { lat, lng };
                div.innerHTML = '';
                this.googleMap = new google.maps.Map(div, { center, zoom: 16, disableDefaultUI: true, zoomControl: true, gestureHandling: 'greedy' });
                this.mapMarker = new google.maps.Marker({ position: center, map: this.googleMap, draggable: true });
                const moved = (latLng) => {
                    this.mapLat = latLng.lat();
                    this.mapLng = latLng.lng();
                    this.isLocationConfirmed = false;
                    this.resetConfirmButton();
                    this.showCoords();
                };
                this.mapMarker.addListener('dragend', (e) => moved(e.latLng));
                this.googleMap.addListener('click', (e) => { this.mapMarker.setPosition(e.latLng); moved(e.latLng); });
                this.el('map-help').hidden = false;
            } catch (e) { fallback(); }
        }).catch(fallback);
    },

    /** Kept for compatibility (old testing helper). Not connected to any button. */
    simulateMapDrag() {
        this.haptic('light');
        this.mapLat += 0.0001; this.mapLng += 0.0001;
        this.isLocationConfirmed = false;
        this.resetConfirmButton();
        this.showCoords();
    },

    confirmGrabLocation() {
        this.haptic('medium');
        this.isLocationConfirmed = true;
        this.el('map-error').hidden = true;
        const c = this.el('btn-confirm-location');
        c.className = 'btn btn-secondary btn-block';
        c.innerHTML = `<span class="location-ok">${this.icon('check')} Location confirmed</span>`;
    },

    // =========================================================
    //  CHECKOUT
    // =========================================================
    getOrderItems(productId) {
        if (productId) {
            const p = this.getProduct(productId);
            if (!p) return [];
            const variant = (this.currentVariant && this.currentVariantProductId === productId)
                ? { name: this.currentVariant.name, price: Number(this.currentVariant.price) }
                : this.defaultVariant(p);
            return [{ ...p, quantity: Math.max(1, this.detailQty || 1), variant, cartPrice: variant.price }];
        }
        return this.cart.filter(Boolean).map(i => ({ ...i }));
    },

    openOrderSummary(productId = null) {
        this.haptic('medium');
        const items = this.getOrderItems(productId);
        if (!items.length) { this.showToast('Your cart is empty.'); return; }
        if (productId && this.isSoldOut(this.getProduct(productId))) { this.showToast('Sorry, this item is sold out.'); return; }

        this.pendingOrderProductId = productId;
        this.pendingOrderItems = items;
        this.selectedCompany = null;
        this.deliveryType = null;
        this.deliveryValue = '';
        this.isSubmitting = false;

        // Reset map state
        this.isLocationConfirmed = false;
        this.mapLat = null; this.mapLng = null;
        this.el('map-container').hidden = true;
        this.el('google-map').innerHTML = '';
        const locBtn = this.el('btn-get-location');
        locBtn.hidden = false; locBtn.className = 'btn btn-outline btn-block';
        locBtn.innerHTML = `${this.icon('pin')} Use my current location`;
        this.el('map-coords').hidden = true;
        this.el('map-help').hidden = true;
        this.el('btn-confirm-location').hidden = true;
        this.resetConfirmButton();
        this.setLocationStatus('');

        // Reset errors + values
        ['delivery-error', 'name-error', 'phone-error', 'company-error', 'map-error'].forEach(id => { const el = this.el(id); if (el) el.hidden = true; });
        ['modal-address', 'modal-note'].forEach(id => { const el = this.el(id); if (el) { el.value = ''; el.removeAttribute('aria-invalid'); } });
        // Name + phone are kept while the store is open (handy if the customer orders again).
        ['modal-name', 'modal-phone'].forEach(id => { const el = this.el(id); if (el) el.removeAttribute('aria-invalid'); });
        const nameInput = this.el('modal-name');
        if (nameInput && !nameInput.value) {
            // Fill the name from the customer's Telegram profile (they can change it).
            try {
                const u = this.tg && this.tg.initDataUnsafe && this.tg.initDataUnsafe.user;
                if (u) nameInput.value = [u.first_name, u.last_name].filter(Boolean).join(' ').slice(0, 80);
            } catch (e) {}
        }
        // A fresh "order ticket" number. If the customer taps Place order twice, or retries after a
        // network problem, the server sees the same ticket and never sends the order twice.
        this.orderKey = this.newOrderKey();
        const prov = this.el('modal-province'); if (prov) prov.selectedIndex = 0;
        this.el('conditional-fields').hidden = true;
        this.el('grab-fields').hidden = true;
        this.el('pickup-info').hidden = true;
        document.querySelectorAll('#delivery-options .radio-card').forEach((b, i) => { b.setAttribute('aria-checked', 'false'); b.tabIndex = i === 0 ? 0 : -1; });
        document.querySelectorAll('.company-box').forEach((b, i) => { b.classList.remove('selected'); b.setAttribute('aria-checked', 'false'); b.tabIndex = i === 0 ? 0 : -1; });
        this.el('delivery-options').classList.remove('has-error');
        this.el('company-grid').classList.remove('has-error');

        // Order summary
        let total = 0;
        this.el('checkout-items').innerHTML = items.map(i => {
            const unit = Number(i.cartPrice || i.price), q = i.quantity || 1;
            total += unit * q;
            return `<li class="co-item">
                        <img src="${this.esc(i.image)}" alt="" onerror="this.style.visibility='hidden'">
                        <div class="co-item-info"><p class="co-item-name">${this.esc(i.name)}</p><p class="co-item-sub">${this.esc(i.variant?.name || 'Standard')} · ${q} × ${this.money(unit)}</p></div>
                        <span class="co-item-price">${this.money(unit * q)}</span>
                    </li>`;
        }).join('');
        this.el('checkout-total-top').textContent = this.money(total);
        this.el('checkout-total').textContent = this.money(total);

        // Show form (not the success screen)
        this.el('checkout-form').hidden = false;
        this.el('checkout-success').hidden = true;
        this.el('checkout-chat').hidden = true;
        this.el('checkout-foot').hidden = false;
        this.setSubmitting(false);
        this.showOrderError('');
        this.el('checkout-body').scrollTop = 0;

        this.openSheet('order-modal');
    },

    closeOrderSummary() {
        if (this.isSubmitting) return; // wait until the order finished sending
        this.haptic('light');
        this.closeSheet('order-modal');
    },

    newOrderKey() {
        try {
            if (window.crypto && crypto.randomUUID) return 'o-' + crypto.randomUUID();
            const a = new Uint8Array(16); crypto.getRandomValues(a);
            return 'o-' + [...a].map(b => b.toString(16).padStart(2, '0')).join('');
        } catch (e) {
            return 'o-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
        }
    },

    selectDelivery(index) {
        const opt = (this.cfg().deliveryOptions || [])[index];
        if (!opt) return;
        this.haptic('light');
        this.deliveryType = opt.type;
        this.deliveryValue = opt.value;
        document.querySelectorAll('#delivery-options .radio-card').forEach((b, i) => {
            b.setAttribute('aria-checked', i === index ? 'true' : 'false');
            b.tabIndex = i === index ? 0 : -1;
        });
        this.handleDeliveryChange();
    },

    handleDeliveryChange() {
        this.el('delivery-error').hidden = true;
        this.el('delivery-options').classList.remove('has-error');
        const isStandard = this.deliveryType === 'standard';
        const isGrab = this.deliveryType === 'grab';
        const isPickup = this.deliveryType === 'pickup';
        this.el('conditional-fields').hidden = !isStandard;
        this.el('grab-fields').hidden = !isGrab;
        this.el('pickup-info').hidden = !isPickup;
        const panel = isStandard ? this.el('conditional-fields') : isGrab ? this.el('grab-fields') : null;
        if (panel) setTimeout(() => { try { panel.scrollIntoView({ behavior: this.prefersReducedMotion() ? 'auto' : 'smooth', block: 'nearest' }); } catch (e) {} }, 60);
    },

    selectCompany(companyName) {
        this.haptic('light');
        this.selectedCompany = companyName;
        this.el('company-error').hidden = true;
        this.el('company-grid').classList.remove('has-error');
        const targetId = `company-${this.companyDomId(companyName)}`;
        document.querySelectorAll('.company-box').forEach(box => {
            const on = box.id === targetId;
            box.classList.toggle('selected', on);
            box.setAttribute('aria-checked', on ? 'true' : 'false');
            box.tabIndex = on ? 0 : -1;
        });
    },

    clearPhoneError() { this.el('phone-error').hidden = true; this.el('modal-phone').removeAttribute('aria-invalid'); },
    clearNameError() { this.el('name-error').hidden = true; this.el('modal-name').removeAttribute('aria-invalid'); },
    /** Kept for compatibility: Grab now uses the shared phone field. */
    clearGrabPhoneError() { this.clearPhoneError(); },

    /**
     * The order message used by the BACKUP plan only (customer sends it in a Telegram chat).
     * Normally orders are sent automatically by the order server (worker/orders.js).
     */
    buildOrderMessage(items, total) {
        const d = this.deliveryValue;
        const isStandard = this.deliveryType === 'standard';
        const isGrab = this.deliveryType === 'grab';
        const cur = this.cfg().currencySymbol || '$';
        let msg = `🛒 *NEW ORDER*\nMethod: ${d}\n\n`;
        msg += `👤 Name: ${this.el('modal-name').value.trim()}\n`;
        msg += `📞 Phone: ${this.el('modal-phone').value.trim()}\n`;
        if (isStandard) {
            msg += `🏢 Company: ${this.selectedCompany}\n`;
            msg += `📍 Province: ${this.el('modal-province').value}\n`;
            msg += `🏠 Address: ${this.el('modal-address').value.trim() || 'N/A'}\n`;
        }
        if (isGrab) {
            msg += `📍 Location: https://www.google.com/maps?q=${this.mapLat},${this.mapLng}\n`;
        }
        msg += `\n`;
        const note = this.el('modal-note').value.trim();
        msg += `📝 Note: ${note || 'None'}\n\n`;
        msg += `📦 *Items:*\n`;
        msg += items.map((i, idx) => `${idx + 1}. ${i.name} (${i.variant?.name || 'Standard'}) - ${i.quantity || 1}x @ ${cur}${Number(i.cartPrice || i.price).toFixed(2)}`).join('\n');
        msg += `\n\n💰 *Total: ${cur}${total.toFixed(2)}*`;
        return msg;
    },

    /** Checks the form in the browser (the server checks everything again). */
    validateCheckout() {
        const errors = [];
        const show = (id, focusEl) => { this.el(id).hidden = false; errors.push(focusEl || this.el(id)); };

        const nameEl = this.el('modal-name'), phoneEl = this.el('modal-phone');
        if (!nameEl.value.trim()) { nameEl.setAttribute('aria-invalid', 'true'); show('name-error', nameEl); }
        const phone = phoneEl.value.trim();
        const digits = phone.replace(/\D/g, '').length;
        if (!phone || digits < 6 || digits > 15 || !/^[0-9+()\-.\s]+$/.test(phone)) {
            this.el('phone-error-text').textContent = phone ? 'Please check your phone number (numbers only, e.g. 012 345 678).' : 'Please enter your phone number.';
            phoneEl.setAttribute('aria-invalid', 'true'); show('phone-error', phoneEl);
        }
        if (!this.deliveryType) { this.el('delivery-options').classList.add('has-error'); show('delivery-error', this.el('delivery-options')); }
        if (this.deliveryType === 'standard' && !this.selectedCompany) { this.el('company-grid').classList.add('has-error'); show('company-error', this.el('company-grid')); }
        if (this.deliveryType === 'grab' && !this.isLocationConfirmed) {
            show('map-error', this.el('btn-confirm-location').hidden ? this.el('btn-get-location') : this.el('btn-confirm-location'));
        }
        if (errors.length) {
            this.haptic('heavy');
            try { this.tg?.HapticFeedback?.notificationOccurred?.('error'); } catch (e) {}
            const first = errors[0];
            try { first.scrollIntoView({ behavior: this.prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' }); } catch (e) {}
            if (first.tagName === 'INPUT') setTimeout(() => first.focus({ preventScroll: true }), 250);
            return false;
        }
        return true;
    },

    orderItemsAndTotal() {
        const items = this.pendingOrderItems.length ? this.pendingOrderItems : this.getOrderItems(this.pendingOrderProductId);
        let total = 0;
        items.forEach(i => total += Number(i.cartPrice || i.price) * (i.quantity || 1));
        return { items, total: Math.round(total * 100) / 100 };
    },

    setSubmitting(on) {
        this.isSubmitting = on;
        const btn = this.el('btn-submit-order');
        btn.disabled = on;
        btn.classList.toggle('is-loading', on);
        if (on) btn.setAttribute('aria-busy', 'true'); else btn.removeAttribute('aria-busy');
        this.el('btn-submit-label').textContent = on ? 'Sending order…' : (this.orderFailed ? 'Try again' : 'Place order');
        const close = this.el('checkout-close'); if (close) close.disabled = on;
    },

    showOrderError(detail, allowFallback) {
        const box = this.el('order-error');
        if (!detail && detail !== null) { box.hidden = true; this.orderFailed = false; return; }
        this.orderFailed = true;
        box.hidden = false;
        this.el('order-error-detail').textContent = detail || '';
        this.el('btn-chat-fallback').hidden = !(allowFallback && this.cfg().allowChatFallback !== false && this.supportUsername);
        try { this.tg?.HapticFeedback?.notificationOccurred?.('error'); } catch (e) {}
        try { box.scrollIntoView({ block: 'nearest' }); } catch (e) {}
    },

    /** "Place order": sends the order to the secure order server, which forwards it to Telegram. */
    async submitFinalOrder() {
        if (this.isSubmitting) return;               // already sending — ignore extra taps
        this.haptic('medium');
        this.showOrderError('');
        if (!this.validateCheckout()) return;

        const { items, total } = this.orderItemsAndTotal();
        const payload = {
            orderKey: this.orderKey || (this.orderKey = this.newOrderKey()),
            initData: (this.tg && this.tg.initData) || '',
            customer: { name: this.el('modal-name').value.trim(), phone: this.el('modal-phone').value.trim() },
            delivery: {
                type: this.deliveryType,
                method: this.deliveryValue,
                company: this.deliveryType === 'standard' ? this.selectedCompany : undefined,
                province: this.deliveryType === 'standard' ? this.el('modal-province').value : undefined,
                address: this.deliveryType === 'standard' ? this.el('modal-address').value.trim() : undefined,
                location: this.deliveryType === 'grab' ? { lat: this.mapLat, lng: this.mapLng } : undefined
            },
            note: this.el('modal-note').value.trim(),
            items: items.map(i => ({ id: i.id, variant: (i.variant && i.variant.name) || 'Standard', quantity: i.quantity || 1 })),
            clientTotal: total
        };

        this.setSubmitting(true);
        let res = null, data = null;
        const controller = window.AbortController ? new AbortController() : null;
        const timer = setTimeout(() => controller && controller.abort(), 20000);
        try {
            res = await fetch(this.cfg().orderApiUrl || '/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller ? controller.signal : undefined
            });
            data = await res.json().catch(() => null);
        } catch (err) {
            res = null;
        } finally {
            clearTimeout(timer);
        }
        this.setSubmitting(false);

        if (res && res.ok && data && data.ok) {
            this.orderSucceeded(data.orderId);
            return;
        }

        // Something went wrong: say so honestly and let the customer try again.
        let detail;
        let fallback = true;
        if (!res) detail = 'Check your internet connection. Your cart is still saved.';
        else if (data && data.message && res.status >= 400 && res.status < 500 && res.status !== 404) {
            detail = data.message;
            fallback = res.status === 403 || res.status === 429;
            if (data.error === 'invalid_phone') { this.el('modal-phone').setAttribute('aria-invalid', 'true'); }
        } else detail = 'The shop\'s order system did not answer. Your cart is still saved.';
        this.showOrderError(detail, fallback);
        this.setSubmitting(false);
    },

    orderSucceeded(orderId) {
        try { this.tg?.HapticFeedback?.notificationOccurred?.('success'); } catch (e) {}
        this.lastOrderId = orderId;
        this.orderKey = null;
        this.orderFailed = false;
        this.el('success-order-id').textContent = orderId ? `Order #${orderId}` : '';
        this.el('success-order-id').hidden = !orderId;
        this.el('success-text').textContent = this.cfg().orderSuccessText || 'The shop has received your order.';
        this.el('checkout-form').hidden = true;
        this.el('checkout-foot').hidden = true;
        this.el('checkout-success').hidden = false;
        this.el('checkout-body').scrollTop = 0;
        try { this.el('checkout-success').focus({ preventScroll: true }); } catch (e) {}

        // Empty the cart if this was a cart checkout (same as before)
        if (!this.pendingOrderProductId) {
            this.cart = [];
            this.saveCart();
            if (this.currentView === 'cart') this.renderCart();
        }
    },

    finishOrder() {
        this.closeSheet('order-modal');
        if (this.currentView === 'cart' && this.cart.length === 0) this.navigate('home');
    },

    /** BACKUP plan (the old way): open a Telegram chat with the order already written. */
    sendViaTelegramChat() {
        if (this.isSubmitting) return;
        if (!this.validateCheckout()) return;
        const { items, total } = this.orderItemsAndTotal();
        const msg = this.buildOrderMessage(items, total);
        this.lastOrderMessage = msg;
        this.isSubmitting = true;
        this.el('checkout-form').hidden = true;
        this.el('checkout-foot').hidden = true;
        this.el('checkout-chat').hidden = false;

        setTimeout(() => {
            const url = `https://t.me/${this.supportUsername.replace('@', '')}?text=${encodeURIComponent(msg)}`;
            const inTelegram = this.tg && this.tg.initDataUnsafe && Object.keys(this.tg.initDataUnsafe).length > 0;
            if (inTelegram) {
                try {
                    if (this.tg.openTelegramLink) this.tg.openTelegramLink(url);
                    else this.tg.openLink(url);
                } catch (err) {
                    window.location.href = url;
                }
                setTimeout(() => { try { this.tg.close(); } catch (e) {} }, 300);
            } else {
                window.location.href = url;
            }
            if (!this.pendingOrderProductId) {
                this.cart = [];
                this.saveCart();
                this.renderCart();
            }
            setTimeout(() => { this.isSubmitting = false; this.closeSheet('order-modal'); }, 800);
        }, 1200);
    },

    // =========================================================
    //  MENUS, SHEETS, NAVIGATION
    // =========================================================
    openSocial(url) {
        this.haptic('light');
        if (this.tg && this.tg.initData && /^https:\/\/t\.me\//.test(url) && this.tg.openTelegramLink) {
            this.tg.openTelegramLink(url);
        } else if (this.tg && this.tg.openLink && this.tg.initData) {
            this.tg.openLink(url);
        } else {
            window.open(url, '_blank', 'noopener');
        }
    },

    setLayerOpen(panel, overlay, open) {
        if (!panel || !overlay) return;
        if (open) {
            this.lastFocus = document.activeElement;
            overlay.hidden = false;
            panel.setAttribute('aria-hidden', 'false');
            requestAnimationFrame(() => { overlay.classList.add('is-open'); panel.classList.add('is-open'); });
            document.body.classList.add('no-scroll');
            this.activeLayer = panel;
            panel.setAttribute('tabindex', '-1');
            setTimeout(() => { try { panel.focus({ preventScroll: true }); } catch (e) {} }, 60);
        } else {
            panel.classList.remove('is-open');
            overlay.classList.remove('is-open');
            panel.setAttribute('aria-hidden', 'true');
            setTimeout(() => { if (!overlay.classList.contains('is-open')) overlay.hidden = true; }, 300);
            if (this.activeLayer === panel) this.activeLayer = null;
            if (!document.querySelector('.drawer.is-open, .sheet-wrap.is-open')) document.body.classList.remove('no-scroll');
            if (this.lastFocus && this.lastFocus.focus && document.contains(this.lastFocus)) { try { this.lastFocus.focus({ preventScroll: true }); } catch (e) {} }
        }
    },

    togglePanel() {
        this.haptic('light');
        if (this.isLeftPanelOpen) this.toggleLeftPanel();
        this.isPanelOpen = !this.isPanelOpen;
        this.setLayerOpen(this.el('side-panel'), this.el('panel-overlay'), this.isPanelOpen);
        this.el('btn-side-panel').setAttribute('aria-expanded', String(this.isPanelOpen));
    },

    toggleLeftPanel() {
        this.haptic('light');
        if (this.isPanelOpen) this.togglePanel();
        this.isLeftPanelOpen = !this.isLeftPanelOpen;
        this.setLayerOpen(this.el('left-panel'), this.el('left-panel-overlay'), this.isLeftPanelOpen);
        this.el('btn-left-panel').setAttribute('aria-expanded', String(this.isLeftPanelOpen));
    },

    openSheet(id) {
        const wrap = this.el(id);
        if (!wrap) return;
        if (this.isPanelOpen) this.togglePanel();
        if (this.isLeftPanelOpen) this.toggleLeftPanel();
        this.lastFocus = document.activeElement;
        wrap.hidden = false;
        const overlay = wrap.querySelector('.overlay');
        requestAnimationFrame(() => requestAnimationFrame(() => { wrap.classList.add('is-open'); if (overlay) overlay.classList.add('is-open'); }));
        document.body.classList.add('no-scroll');
        const sheet = wrap.querySelector('.sheet');
        this.activeLayer = sheet;
        this.hideToast();
        if (sheet) { sheet.setAttribute('tabindex', '-1'); setTimeout(() => { try { sheet.focus({ preventScroll: true }); } catch (e) {} }, 80); }
    },

    closeSheet(id) {
        const wrap = this.el(id);
        if (!wrap || wrap.hidden) return;
        wrap.classList.remove('is-open');
        const overlay = wrap.querySelector('.overlay');
        if (overlay) overlay.classList.remove('is-open');
        setTimeout(() => { if (!wrap.classList.contains('is-open')) wrap.hidden = true; }, 320);
        this.activeLayer = null;
        if (!document.querySelector('.drawer.is-open, .sheet-wrap.is-open')) document.body.classList.remove('no-scroll');
        if (this.lastFocus && this.lastFocus.focus && document.contains(this.lastFocus)) { try { this.lastFocus.focus({ preventScroll: true }); } catch (e) {} }
    },

    closeAllLayers() {
        if (this.isPanelOpen) this.togglePanel();
        if (this.isLeftPanelOpen) this.toggleLeftPanel();
        ['filter-sheet', 'order-modal'].forEach(id => { const w = this.el(id); if (w && !w.hidden && !this.isSubmitting) this.closeSheet(id); });
        this.hideSuggestions();
    },

    onGlobalKeydown(e) {
        if (e.key === 'Escape') {
            const order = this.el('order-modal'), filters = this.el('filter-sheet');
            if (order && !order.hidden) { if (!this.isSubmitting) this.closeOrderSummary(); return; }
            if (filters && !filters.hidden) { this.closeFilters(); return; }
            if (this.isPanelOpen) { this.togglePanel(); return; }
            if (this.isLeftPanelOpen) { this.toggleLeftPanel(); return; }
            this.hideSuggestions();
            return;
        }
        // Keep keyboard focus inside an open drawer / sheet
        if (e.key === 'Tab' && this.activeLayer) {
            const f = [...this.activeLayer.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select, textarea, [tabindex="0"]')]
                .filter(x => x.offsetParent !== null && !x.closest('[hidden]'));
            if (!f.length) return;
            const first = f[0], last = f[f.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
            else if (!this.activeLayer.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
        }
        // Arrow keys inside radio groups (variants, delivery, companies, categories)
        if (['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key)) {
            const group = e.target.closest && e.target.closest('[role="radiogroup"]');
            if (!group || e.target.getAttribute('role') !== 'radio') return;
            const radios = [...group.querySelectorAll('[role="radio"]')].filter(r => !r.disabled);
            const i = radios.indexOf(e.target);
            if (i < 0) return;
            e.preventDefault();
            const next = radios[(i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1) + radios.length) % radios.length];
            next.focus();
            next.click();
        }
    },

    navigate(viewId, opts = {}) {
        this.haptic('light');
        if (this.isPanelOpen) this.togglePanel();
        if (this.isLeftPanelOpen) this.toggleLeftPanel();
        this.hideSuggestions();

        const prev = this.currentView;
        if (prev === 'home' && viewId !== 'home') this.homeScroll = window.pageYOffset || 0;

        document.querySelectorAll('.view-section').forEach(el => {
            const on = el.id === `view-${viewId}`;
            el.hidden = !on;
            el.classList.toggle('active', on);
            el.classList.remove('is-entering');
        });
        const v = this.el(`view-${viewId}`);
        if (v && !this.prefersReducedMotion()) { void v.offsetWidth; v.classList.add('is-entering'); }
        document.body.dataset.view = viewId;
        this.currentView = viewId;

        const h = this.el('nav-home'), c = this.el('nav-cart');
        if (h) { if (viewId === 'home') h.setAttribute('aria-current', 'page'); else h.removeAttribute('aria-current'); }
        if (c) { if (viewId === 'cart') c.setAttribute('aria-current', 'page'); else c.removeAttribute('aria-current'); }
        const hc = this.el('header-cart');
        if (hc) { if (viewId === 'cart') hc.setAttribute('aria-current', 'page'); else hc.removeAttribute('aria-current'); }

        if (viewId === 'home' || viewId === 'cart') {
            try { this.tg?.BackButton?.hide?.(); } catch (e) {}
        } else {
            try { this.tg?.BackButton?.show?.(); } catch (e) {}
        }
        if (viewId !== 'product') document.title = viewId === 'cart' ? `Cart · ${this.cfg().storeName || 'BRICK STORE'}` : (this.cfg().storeName || 'BRICK STORE');

        if (viewId === 'cart') { this.renderCart(); this.hideToast(); }

        // Browser history (so the phone's Back button works)
        if (!opts.fromHistory && prev !== viewId || (viewId === 'product' && !opts.fromHistory)) {
            try {
                history.pushState({ view: viewId, productId: viewId === 'product' ? this.currentProductId : null }, '');
                this.historyDepth++;
            } catch (e) {}
        }

        const toTop = !(viewId === 'home' && opts.restoreScroll);
        window.scrollTo(0, toTop ? 0 : this.homeScroll);
        if (opts.focus !== false && prev !== viewId) {
            const heading = viewId === 'product' ? this.el('pdp-title') : viewId === 'cart' ? this.el('cart-title') : null;
            if (heading) try { heading.focus({ preventScroll: true }); } catch (e) {}
        }
    },

    goHome() { this.navigate('home', { restoreScroll: this.currentView !== 'home' }); },

    goBack() {
        if (this.historyDepth > 0) { history.back(); }
        else { this.navigate('home', { restoreScroll: true }); }
    },

    onPopState(e) {
        this.historyDepth = Math.max(0, this.historyDepth - 1);
        this.closeAllLayers();
        const state = e.state || { view: 'home' };
        if (state.view === 'product' && state.productId != null && this.getProduct(state.productId)) {
            this.viewProduct(state.productId, { fromHistory: true });
        } else {
            this.navigate(state.view === 'cart' ? 'cart' : 'home', { fromHistory: true, restoreScroll: state.view !== 'cart' });
        }
    },

    handlePriceFilter(type) {
        this.isPriceFilterActive = true;
        const mi = this.el('minPriceRange'), ma = this.el('maxPriceRange');
        let min = Number(mi.value), max = Number(ma.value);
        if (type === 'min' && min > max - 1) { min = max - 1; mi.value = min; }
        if (type === 'max' && max < min + 1) { max = min + 1; ma.value = max; }
        this.minPrice = Math.max(this.absMinPrice, min);
        this.maxPrice = Math.min(this.absMaxPrice, max);
        this.updateSliderUI();
        this.renderCatalog();
    },
    clearPriceFilter() {
        this.isPriceFilterActive = false;
        this.minPrice = this.absMinPrice; this.maxPrice = this.absMaxPrice;
        const mi = this.el('minPriceRange'), ma = this.el('maxPriceRange');
        if (mi) mi.value = this.absMinPrice; if (ma) ma.value = this.absMaxPrice;
        this.updateSliderUI();
        this.renderCatalog();
    },

    updateSliderUI() {
        const l = this.el('priceValue');
        if (l) l.textContent = `${this.money(this.minPrice)} — ${this.money(this.maxPrice)}`;
        const a = this.el('price-min-label'), b = this.el('price-max-label');
        if (a) a.textContent = this.money(this.minPrice);
        if (b) b.textContent = this.money(this.maxPrice);
        const t = this.el('slider-track');
        if (t) {
            const rangeTotal = this.absMaxPrice - this.absMinPrice || 1;
            t.style.left = (((this.minPrice - this.absMinPrice) / rangeTotal) * 100) + '%';
            t.style.right = (100 - (((this.maxPrice - this.absMinPrice) / rangeTotal) * 100)) + '%';
        }
        const mi = this.el('minPriceRange'), ma = this.el('maxPriceRange');
        if (mi) mi.setAttribute('aria-valuetext', this.money(this.minPrice));
        if (ma) ma.setAttribute('aria-valuetext', this.money(this.maxPrice));
    },

    updateCartBadge() {
        const totalQty = this.cart.reduce((acc, curr) => acc + ((curr && curr.quantity) || 1), 0);
        document.querySelectorAll('[data-cart-badge]').forEach(b => {
            b.textContent = totalQty > 99 ? '99+' : totalQty;
            b.hidden = totalQty === 0;
        });
        const label = totalQty ? `Cart, ${totalQty} ${totalQty === 1 ? 'item' : 'items'}` : 'Cart';
        const hc = this.el('header-cart'); if (hc) hc.setAttribute('aria-label', label);
        const nc = this.el('nav-cart'); if (nc) nc.setAttribute('aria-label', label);
    },

    setCategory(cat) {
        this.haptic('medium');
        this.currentCategory = cat;
        this.searchQuery = "";
        const si = this.el('searchInput');
        if (si) si.value = "";
        const sc = this.el('search-clear'); if (sc) sc.hidden = true;
        if (this.isLeftPanelOpen) this.toggleLeftPanel();
        this.navigate('home', { focus: false });
        this.renderCatalog();
    },

    resetFilters(keepSheetOpen) {
        this.haptic('medium');
        this.searchQuery = "";
        const s = this.el('searchInput');
        if (s) s.value = "";
        const sc = this.el('search-clear'); if (sc) sc.hidden = true;
        this.minPrice = this.absMinPrice;
        this.maxPrice = this.absMaxPrice;
        this.isPriceFilterActive = false;
        this.categoryFilter = 'all';
        this.sortBy = 'featured';
        const sort = this.el('sort-select'); if (sort) sort.value = 'featured';
        const mi = this.el('minPriceRange'), ma = this.el('maxPriceRange');
        if (mi) mi.value = this.absMinPrice;
        if (ma) ma.value = this.absMaxPrice;
        this.updateSliderUI();
        this.renderCategoryChips();
        if (keepSheetOpen === true) { this.currentCategory = 'home'; this.renderCatalog(); return; }
        this.setCategory('home');
    },

    applyTheme() {
        const dark = !!this.isDarkMode;
        document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
        document.body.classList.toggle('dark', dark);
        const sw = this.el('theme-switch'); if (sw) sw.setAttribute('aria-checked', dark ? 'true' : 'false');
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', dark ? '#000000' : '#ffffff');
        try {
            this.tg?.setHeaderColor?.(dark ? '#000000' : '#ffffff');
            this.tg?.setBackgroundColor?.(dark ? '#000000' : '#ffffff');
            this.tg?.setBottomBarColor?.(dark ? '#000000' : '#ffffff');
        } catch (e) {}
    },

    toggleTheme() {
        this.haptic('medium');
        this.isDarkMode = !this.isDarkMode;
        try { localStorage.setItem('brickTheme', this.isDarkMode ? 'dark' : 'light'); } catch (e) {}
        this.applyTheme();
    },

    shareApp() {
        const cfg = this.cfg();
        const l = cfg.shareLink || "https://t.me/BrickStoreApp_bot/Homepage";
        const t = cfg.shareText || "Check out BRICK STORE!";
        const tgShare = `https://t.me/share/url?url=${encodeURIComponent(l)}&text=${encodeURIComponent(t)}`;
        try {
            if (this.tg?.openTelegramLink && this.tg.initData) {
                this.tg.openTelegramLink(tgShare);
            } else if (navigator.share) {
                navigator.share({ title: cfg.storeName || 'BRICK STORE', text: t, url: l }).catch(() => {});
            } else {
                window.open(tgShare, '_blank', 'noopener');
            }
        } catch (e) {}
    },

    // =========================================================
    //  TOAST MESSAGES
    // =========================================================
    hideToast() {
        clearTimeout(this.toastTimer);
        const region = this.el('toast-region');
        if (region) region.innerHTML = '';
    },

    showToast(message, opts = {}) {
        const region = this.el('toast-region');
        if (!region) return;
        clearTimeout(this.toastTimer);
        region.innerHTML = '';
        const t = document.createElement('div');
        t.className = 'toast';
        t.setAttribute('role', 'status');
        t.innerHTML = `<span class="toast-msg">${this.esc(message)}</span>`;
        if (opts.actionLabel && opts.onAction) {
            const b = document.createElement('button');
            b.type = 'button'; b.className = 'toast-action'; b.textContent = opts.actionLabel;
            b.onclick = () => { opts.onAction(); t.classList.remove('is-visible'); setTimeout(() => t.remove(), 250); };
            t.appendChild(b);
        }
        region.appendChild(t);
        requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('is-visible')));
        this.toastTimer = setTimeout(() => { t.classList.remove('is-visible'); setTimeout(() => t.remove(), 300); }, opts.duration || 3000);
    }
};

// Start the app
document.addEventListener('DOMContentLoaded', () => { app.init(); });
