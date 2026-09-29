/**
 * ============================================================
 *  BRICK STORE — ORDER RECEIVER (runs on Cloudflare, not in the browser)
 * ============================================================
 *  What happens when a customer taps "Place order":
 *
 *   1. Check the request is a real order from YOUR website (right address, right size).
 *   2. Check it isn't spam (too many orders from one place in a short time).
 *   3. Check every detail: name, phone, delivery, products, quantities.
 *   4. Re-calculate the prices from products.js — we never trust prices sent by a browser.
 *   5. Give the order an ID (like BRICK-260929-7K2Q).
 *   6. Send a neat message to your Telegram bot → your chat/group.
 *   7. Tell the customer "received" ONLY if Telegram accepted the message.
 *
 *  SETTINGS (set in the Cloudflare dashboard, never in files):
 *   TELEGRAM_BOT_TOKEN   (Secret)  the bot's password from @BotFather
 *   TELEGRAM_CHAT_ID     (Secret)  where orders go: your personal ID, or a group ID (starts with -100…)
 *   TELEGRAM_THREAD_ID   (optional) topic number, only if your group uses Topics
 *   MINI_APP_BOT_TOKEN   (optional Secret) only if the store's bot is a DIFFERENT bot from the order bot
 *  SETTINGS (in wrangler.jsonc → "vars"):
 *   REQUIRE_TELEGRAM_USER  "true" = only accept orders placed inside Telegram
 *   ALLOWED_ORIGINS        extra website addresses allowed to send orders (comma separated)
 * ============================================================
 */

import products from '../public/products.js';
import STORE_CONFIG from '../public/store-config.js';

const MAX_BODY_BYTES = 16 * 1024;           // an order is tiny; anything bigger is rejected
const MAX_ITEMS = 50;
const MAX_QTY_PER_LINE = 99;
const RATE_LIMIT_PER_IP = 5;                // max orders from one internet address…
const RATE_WINDOW_MS = 10 * 60 * 1000;      // …every 10 minutes
const DUPLICATE_WINDOW_MS = 30 * 60 * 1000; // the same order sent twice within 30 min is only delivered once
const TELEGRAM_TIMEOUT_MS = 10000;
const INIT_DATA_MAX_AGE_S = 24 * 60 * 60;   // Telegram login proof is valid for 24 hours
const SHOP_TIMEZONE = 'Asia/Phnom_Penh';

// Short-term memory (kept while this Cloudflare server copy is running).
const recentOrders = new Map();   // orderKey → { orderId, total, at }
const inFlight = new Map();       // orderKey → Promise (same order arriving twice at the same moment)
const ipHits = new Map();         // ip → [timestamps]

// ------------------------------------------------------------
//  Small helpers
// ------------------------------------------------------------
export function jsonResponse(body, status = 200, extraHeaders = {}) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extraHeaders }
    });
}

const fail = (status, error, message, headers) => jsonResponse({ ok: false, error, message }, status, headers);

function escapeHtml(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Removes invisible control characters and trims to a maximum length. */
function cleanText(value, maxLen) {
    if (typeof value !== 'string') return '';
    return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, maxLen);
}

function money(n) {
    const cur = (STORE_CONFIG && STORE_CONFIG.currencySymbol) || '$';
    return cur + Number(n).toFixed(2);
}

function allowedOrigins(request, env) {
    const self = new URL(request.url).origin;
    const extra = String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim().replace(/\/$/, '')).filter(Boolean);
    return [self, ...extra];
}

function corsHeaders(origin, request) {
    // Only needed when the website lives on a different address than this Worker.
    if (!origin || origin === new URL(request.url).origin) return { vary: 'Origin' };
    return {
        'access-control-allow-origin': origin,
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers': 'content-type',
        'access-control-max-age': '600',
        vary: 'Origin'
    };
}

function tooManyFromIp(ip) {
    const now = Date.now();
    const list = (ipHits.get(ip) || []).filter(t => now - t < RATE_WINDOW_MS);
    ipHits.set(ip, list);
    return list.length >= RATE_LIMIT_PER_IP;
}

function rememberOrderFromIp(ip) {
    const list = ipHits.get(ip) || [];
    list.push(Date.now());
    ipHits.set(ip, list);
    if (ipHits.size > 5000) ipHits.clear(); // keep memory small
}

function forgetOldOrders() {
    const now = Date.now();
    for (const [key, v] of recentOrders) if (now - v.at > DUPLICATE_WINDOW_MS) recentOrders.delete(key);
    if (recentOrders.size > 1000) recentOrders.clear();
}

async function sha256Hex(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hmacSha256(keyBytes, text) {
    const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text)));
}

function timingSafeEqualHex(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
}

/**
 * Checks Telegram's "login proof" that the Mini App sends (initData).
 * If it is genuine, we know the order really came from this Telegram user.
 * Official method: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export async function verifyTelegramInitData(initData, botToken) {
    if (!initData || typeof initData !== 'string' || !botToken || initData.length > 4096) return null;
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return null;
    params.delete('hash');
    const dataCheckString = [...params.entries()]
        .map(([k, v]) => `${k}=${v}`)
        .sort()
        .join('\n');
    const secretKey = await hmacSha256(new TextEncoder().encode('WebAppData'), botToken);
    const expected = [...await hmacSha256(secretKey, dataCheckString)].map(b => b.toString(16).padStart(2, '0')).join('');
    if (!timingSafeEqualHex(expected, hash.toLowerCase())) return null;
    const authDate = Number(params.get('auth_date'));
    if (!authDate || (Date.now() / 1000 - authDate) > INIT_DATA_MAX_AGE_S) return null;
    try {
        const user = JSON.parse(params.get('user') || 'null');
        if (!user || typeof user.id !== 'number') return null;
        return {
            id: user.id,
            name: cleanText([user.first_name, user.last_name].filter(Boolean).join(' '), 80),
            username: cleanText(user.username || '', 40)
        };
    } catch (e) {
        return null;
    }
}

// ------------------------------------------------------------
//  Checking the order
// ------------------------------------------------------------
function unitPriceFor(product, variantName) {
    const variants = Array.isArray(product.variants) && product.variants.length ? product.variants : null;
    if (variants) {
        const v = variants.find(x => x.name === variantName);
        return v ? { name: v.name, price: Number(v.price) } : null;
    }
    if (variantName && variantName !== 'Standard') return null;
    return { name: 'Standard', price: Number(product.price) };
}

/** Returns { order } when everything is fine, or { error, message } explaining what is wrong. */
export function validateOrder(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'bad_request', message: 'The order was not readable. Please try again.' };

    const orderKey = typeof body.orderKey === 'string' ? body.orderKey : '';
    if (!/^[A-Za-z0-9-]{8,64}$/.test(orderKey)) return { error: 'bad_request', message: 'The order was not readable. Please try again.' };

    // Customer
    const customer = body.customer || {};
    const name = cleanText(customer.name, 80);
    const phone = cleanText(customer.phone, 30);
    if (!name) return { error: 'invalid_name', message: 'Please enter your name.' };
    const digits = phone.replace(/\D/g, '');
    if (!/^[0-9+()\-.\s]+$/.test(phone) || digits.length < 6 || digits.length > 15) {
        return { error: 'invalid_phone', message: 'Please check your phone number.' };
    }

    // Delivery (must be one of the options in store-config.js)
    const delivery = body.delivery || {};
    const option = (STORE_CONFIG.deliveryOptions || []).find(o => o.value === delivery.method && o.type === delivery.type);
    if (!option) return { error: 'invalid_delivery', message: 'Please choose a delivery method.' };
    const out = { type: option.type, method: option.value };
    if (option.type === 'standard') {
        const company = (STORE_CONFIG.deliveryCompanies || []).find(c => c.id === delivery.company);
        if (!company) return { error: 'invalid_company', message: 'Please choose a delivery company.' };
        const province = (STORE_CONFIG.provinces || []).find(p => p.value === delivery.province);
        if (!province) return { error: 'invalid_province', message: 'Please choose your city or province.' };
        out.company = company.id;
        out.province = province.value;
        out.address = cleanText(delivery.address, 200);
    }
    if (option.type === 'grab') {
        const loc = delivery.location || {};
        const lat = Number(loc.lat), lng = Number(loc.lng);
        if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) {
            return { error: 'invalid_location', message: 'Please pin and confirm your location.' };
        }
        out.location = { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 };
    }

    // Products: re-check names, variants, stock and prices against products.js
    if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > MAX_ITEMS) {
        return { error: 'invalid_items', message: 'Your cart looks empty. Please add a product and try again.' };
    }
    const items = [];
    const qtyByProduct = new Map();
    let total = 0;
    for (const raw of body.items) {
        const id = Number(raw && raw.id);
        const quantity = raw && typeof raw.quantity === 'number' ? raw.quantity : NaN;
        const product = products.find(p => p.id === id);
        if (!product) return { error: 'unknown_product', message: 'A product in your cart is no longer available. Please refresh the store and try again.' };
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QTY_PER_LINE) return { error: 'invalid_quantity', message: 'Please check the quantities in your cart.' };
        const variant = unitPriceFor(product, raw.variant);
        if (!variant || !isFinite(variant.price) || variant.price < 0) return { error: 'unknown_variant', message: `An option for “${product.name}” is no longer available. Please refresh the store and try again.` };
        const soFar = (qtyByProduct.get(id) || 0) + quantity;
        qtyByProduct.set(id, soFar);
        if (typeof product.stock === 'number' && soFar > product.stock) {
            return { error: 'out_of_stock', message: product.stock <= 0 ? `“${product.name}” is sold out.` : `Only ${product.stock} of “${product.name}” available.` };
        }
        total += variant.price * quantity;
        items.push({ id, name: product.name, variant: variant.name, hasVariants: Array.isArray(product.variants) && product.variants.length > 0, quantity, unitPrice: variant.price });
    }
    total = Math.round(total * 100) / 100;

    // The browser shows a total to the customer. If it doesn't match today's prices, stop.
    const clientTotal = Number(body.clientTotal);
    if (!isFinite(clientTotal) || Math.abs(clientTotal - total) > 0.005) {
        return { error: 'price_changed', message: 'Some prices have changed. Please close the store, open it again, and check your cart.' };
    }

    return {
        order: {
            orderKey,
            customer: { name, phone },
            delivery: out,
            note: cleanText(body.note, 500),
            items,
            total,
            initData: typeof body.initData === 'string' ? body.initData : ''
        }
    };
}

// ------------------------------------------------------------
//  Order ID + Telegram message
// ------------------------------------------------------------
async function makeOrderId(orderKey, now) {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: SHOP_TIMEZONE, year: '2-digit', month: '2-digit', day: '2-digit' }).formatToParts(now);
    const get = t => (parts.find(p => p.type === t) || {}).value || '00';
    const hash = await sha256Hex(orderKey);
    const code = parseInt(hash.slice(0, 10), 16).toString(36).toUpperCase().padStart(5, '0').slice(-5);
    return `BRICK-${get('year')}${get('month')}${get('day')}-${code}`;
}

export function formatOrderMessage(order, orderId, tgUser, now) {
    const e = escapeHtml;
    const time = new Intl.DateTimeFormat('en-GB', { timeZone: SHOP_TIMEZONE, dateStyle: 'medium', timeStyle: 'short' }).format(now);
    const lines = [];
    lines.push(`🛍️ <b>NEW ORDER #${e(orderId)}</b>`);
    lines.push('');
    lines.push('👤 <b>CUSTOMER</b>');
    lines.push(`Name: ${e(order.customer.name)}`);
    lines.push(`Phone: ${e(order.customer.phone)}`);
    if (tgUser) {
        const label = tgUser.username ? `@${tgUser.username}` : (tgUser.name || 'Open chat');
        lines.push(`Telegram: <a href="tg://user?id=${tgUser.id}">${e(label)}</a> ✅ verified`);
    } else {
        lines.push('Telegram: ⚠️ not verified (ordered outside Telegram)');
    }
    lines.push('');
    lines.push('📍 <b>DELIVERY</b>');
    lines.push(`Method: ${e(order.delivery.method)}`);
    if (order.delivery.type === 'standard') {
        lines.push(`Province: ${e(order.delivery.province)}`);
        lines.push(`Address: ${e(order.delivery.address || 'N/A')}`);
        lines.push('');
        lines.push('🚚 <b>DELIVERY COMPANY</b>');
        lines.push(e(order.delivery.company));
    }
    if (order.delivery.type === 'grab') {
        const { lat, lng } = order.delivery.location;
        lines.push(`Location: <a href="https://www.google.com/maps?q=${lat},${lng}">Open in Google Maps</a>`);
        lines.push(`(${lat}, ${lng})`);
    }
    lines.push('');
    lines.push('🛒 <b>ORDER</b>');
    order.items.forEach((it, i) => {
        lines.push('');
        lines.push(`${i + 1}. ${e(it.name)}`);
        if (it.hasVariants) lines.push(`   Variant: ${e(it.variant)}`);
        lines.push(`   Qty: ${it.quantity}`);
        lines.push(`   Price: ${money(it.unitPrice)}${it.quantity > 1 ? ` each · ${money(it.unitPrice * it.quantity)}` : ''}`);
    });
    lines.push('');
    lines.push('💰 <b>TOTAL</b>');
    lines.push(`<b>${money(order.total)}</b>`);
    lines.push('');
    lines.push('📝 <b>NOTE</b>');
    lines.push(e(order.note || 'None'));
    lines.push('');
    lines.push('🕐 <b>ORDER TIME</b>');
    lines.push(`${e(time)} (Phnom Penh)`);
    lines.push('');
    lines.push('📦 <b>STATUS</b>');
    lines.push('NEW');
    let text = lines.join('\n');
    if (text.length > 4000) text = text.slice(0, 3990) + '\n…';  // Telegram's limit is 4096
    return text;
}

async function sendToTelegram(env, text) {
    const base = env.TELEGRAM_API_BASE || 'https://api.telegram.org';
    const payload = { chat_id: String(env.TELEGRAM_CHAT_ID).trim(), text, parse_mode: 'HTML', link_preview_options: { is_disabled: true } };
    if (env.TELEGRAM_THREAD_ID) payload.message_thread_id = Number(env.TELEGRAM_THREAD_ID);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TELEGRAM_TIMEOUT_MS);
    try {
        const res = await fetch(`${base}/bot${String(env.TELEGRAM_BOT_TOKEN).trim()}/sendMessage`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) {
            // Telegram's own error text (e.g. "chat not found"). It never contains the token.
            console.error('Telegram refused the message:', res.status, data && data.description);
            return false;
        }
        return true;
    } catch (err) {
        console.error('Could not reach Telegram:', err && err.name);
        return false;
    } finally {
        clearTimeout(timer);
    }
}

// ------------------------------------------------------------
//  The two web addresses
// ------------------------------------------------------------
export async function handleOrder(request, env) {
    const origin = request.headers.get('origin');
    const allowed = allowedOrigins(request, env);
    const originOk = origin && allowed.includes(origin);

    // Browsers ask permission first when the website is on another address.
    if (request.method === 'OPTIONS') {
        if (!originOk) return new Response(null, { status: 403 });
        return new Response(null, { status: 204, headers: corsHeaders(origin, request) });
    }
    if (request.method !== 'POST') return fail(405, 'method_not_allowed', 'Not allowed.', { allow: 'POST, OPTIONS' });
    if (!originOk) return fail(403, 'forbidden', 'Not allowed.');
    const cors = corsHeaders(origin, request);

    if (!String(request.headers.get('content-type') || '').toLowerCase().includes('application/json')) {
        return fail(415, 'bad_request', 'The order was not readable. Please try again.', cors);
    }
    const declared = Number(request.headers.get('content-length') || 0);
    if (declared > MAX_BODY_BYTES) return fail(413, 'too_large', 'The order is too large.', cors);
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) return fail(413, 'too_large', 'The order is too large.', cors);

    if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
        console.error('Order server is missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID.');
        return fail(503, 'not_configured', 'Ordering is temporarily unavailable. Please try again later.', cors);
    }

    let body;
    try { body = JSON.parse(raw); } catch (e) { return fail(400, 'bad_request', 'The order was not readable. Please try again.', cors); }

    const checked = validateOrder(body);
    if (checked.error) return fail(checked.error === 'price_changed' ? 409 : 400, checked.error, checked.message, cors);
    const order = checked.order;

    // Same order sent again (double tap, slow network retry)? Answer "received" without sending twice.
    forgetOldOrders();
    const seen = recentOrders.get(order.orderKey);
    if (seen) return jsonResponse({ ok: true, orderId: seen.orderId, total: seen.total, duplicate: true }, 200, cors);
    if (inFlight.has(order.orderKey)) {
        const result = await inFlight.get(order.orderKey);
        return jsonResponse(result.body, result.status, cors);
    }

    // Spam protection
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    if (env.ORDER_LIMITER) {
        const { success } = await env.ORDER_LIMITER.limit({ key: ip });
        if (!success) return fail(429, 'rate_limited', 'Too many orders in a short time. Please wait a minute and try again.', cors);
    }
    if (tooManyFromIp(ip)) return fail(429, 'rate_limited', 'Too many orders in a short time. Please wait a few minutes and try again.', cors);

    // Is this really a Telegram user? (Proof checked with the bot token — never leaves this server.)
    const tgUser = await verifyTelegramInitData(order.initData, env.MINI_APP_BOT_TOKEN || env.TELEGRAM_BOT_TOKEN);
    if (String(env.REQUIRE_TELEGRAM_USER).toLowerCase() === 'true' && !tgUser) {
        return fail(403, 'telegram_required', 'Please open the store inside Telegram to place an order.', cors);
    }

    const work = (async () => {
        const now = new Date();
        const orderId = await makeOrderId(order.orderKey, now);
        const text = formatOrderMessage(order, orderId, tgUser, now);
        const sent = await sendToTelegram(env, text);
        if (!sent) return { status: 502, body: { ok: false, error: 'telegram_failed', message: 'Order could not be sent. Please try again.' } };
        recentOrders.set(order.orderKey, { orderId, total: order.total, at: Date.now() });
        rememberOrderFromIp(ip);
        return { status: 200, body: { ok: true, orderId, total: order.total } };
    })();
    inFlight.set(order.orderKey, work);
    try {
        const result = await work;
        return jsonResponse(result.body, result.status, cors);
    } finally {
        inFlight.delete(order.orderKey);
    }
}

export function handleHealth(request, env) {
    if (request.method !== 'GET') return fail(405, 'method_not_allowed', 'Not allowed.');
    // Only says whether settings are filled in — never shows them.
    return jsonResponse({
        ok: true,
        botTokenSet: Boolean(env.TELEGRAM_BOT_TOKEN),
        chatIdSet: Boolean(env.TELEGRAM_CHAT_ID),
        requireTelegramUser: String(env.REQUIRE_TELEGRAM_USER).toLowerCase() === 'true',
        productsLoaded: Array.isArray(products) ? products.length : 0
    });
}
