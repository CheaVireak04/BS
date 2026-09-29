/**
 * ============================================================
 *  BRICK STORE — CLOUDFLARE WORKER (the "back office")
 * ============================================================
 *  Think of this file as the shop's back office door.
 *
 *  - Normal visitors asking for the website (index.html, pictures, products.js…)
 *    never reach this code: Cloudflare hands them the files directly. Fast and free.
 *  - Only these two addresses come here:
 *      POST /api/orders  → a customer places an order (see orders.js)
 *      GET  /api/health  → quick check that the bot settings are filled in
 *
 *  The Telegram bot password (token) lives ONLY in Cloudflare's secret settings
 *  (env.TELEGRAM_BOT_TOKEN). It is never written in any file and never sent to customers.
 * ============================================================
 */

import { handleOrder, handleHealth, jsonResponse } from './orders.js';

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        if (url.pathname === '/api/orders') {
            try {
                return await handleOrder(request, env, ctx);
            } catch (err) {
                // Never show internal details (or secrets) to the customer.
                console.error('Order handler crashed:', err && err.message);
                return jsonResponse({ ok: false, error: 'server_error', message: 'Order could not be sent. Please try again.' }, 500);
            }
        }

        if (url.pathname === '/api/health') {
            return handleHealth(request, env);
        }

        if (url.pathname.startsWith('/api/')) {
            return jsonResponse({ ok: false, error: 'not_found' }, 404);
        }

        // Anything else: serve the website files (if a file wasn't found above, this returns 404).
        return env.ASSETS.fetch(request);
    }
};
