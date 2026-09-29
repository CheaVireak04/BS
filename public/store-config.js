/**
 * ============================================================
 *  BRICK STORE — STORE SETTINGS
 * ============================================================
 *  This file holds the store's words and settings: the text on the
 *  home page, your Telegram username, social links, delivery options,
 *  delivery companies and provinces.
 *
 *  HOW TO EDIT SAFELY
 *  - Only change the text between the quote marks "like this".
 *  - Keep every comma , and bracket { } [ ] exactly where it is.
 *  - After saving, reload the page. If the page goes blank, you
 *    probably deleted a comma or a quote mark — undo your last change.
 *
 *  Products are NOT in this file. Products live in products.js.
 * ============================================================
 */

const STORE_CONFIG = {

    // ---------- Store identity ----------
    storeName: "BRICK STORE",            // shown in the top bar and browser tab

    // ---------- Home page top section ("hero") ----------
    // Placeholder text. Replace it when you decide what you sell.
    heroEyebrow: "",                             // optional small line above the big title, e.g. "New season"
    heroTitle: "Welcome to BRICK STORE",         // the big title
    heroSubtitle: "Browse the collection and order in a few taps.",
    heroImage: "",                               // optional banner photo link, e.g. "hero-banner.jpg". Leave "" for no image.

    // ---------- Money ----------
    currencySymbol: "$",                 // shown before every price

    // ---------- Where orders are sent ----------
    // Orders are sent automatically by the secure order server (the "worker" folder)
    // to your Telegram bot. The bot password is NOT here — it is kept secret in Cloudflare.
    orderApiUrl: "/api/orders",

    // Shown to the customer after the order was received.
    orderSuccessText: "The shop has received your order and will contact you to confirm it.",

    // Backup plan: if the order server can't be reached, offer the customer a button to
    // send the order as a Telegram chat message to this username instead.
    allowChatFallback: true,
    supportUsername: "Chea_Vireak",       // your Telegram username (also shown in Contact us)

    // ---------- "Share App" button ----------
    shareLink: "https://t.me/BrickStoreApp_bot/Homepage",
    shareText: "Check out BRICK STORE!",

    // ---------- About section (in the right-side menu) ----------
    aboutText: "BRICK STORE is a modern online shop established in 2025.",

    // ---------- Social links (right-side menu). Remove a line to hide it. ----------
    socialLinks: [
        { name: "Facebook",  url: "https://www.facebook.com/brick.theofficialstore", icon: "facebook" },
        { name: "TikTok",    url: "https://www.tiktok.com/@brick.theofficial",       icon: "tiktok" },
        { name: "Instagram", url: "https://www.instagram.com/brick.theofficialstore", icon: "instagram" }
    ],

    // ---------- Collections (left menu + chips on the home page) ----------
    // How many products each collection shows.
    maxNewArrivals: 4,
    maxTrending: 4,
    maxBestDeals: 4,
    maxBestSelling: 4,

    // ---------- Delivery options shown at checkout ----------
    // "type" tells the app which form to show:
    //   "standard" = choose delivery company + province + address + phone
    //   "grab"     = pin location on a map + phone
    //   "pickup"   = no extra fields
    // "value" is the exact text that appears in the order message you receive.
    deliveryOptions: [
        { type: "standard", value: "Standard (1-2 days)",       label: "Standard delivery",  detail: "1–2 days · by delivery company to your province" },
        { type: "grab",     value: "Grab Express (Phnom Penh)", label: "Grab Express",       detail: "Phnom Penh only · pin your location on a map" },
        { type: "pickup",   value: "Store Pickup",              label: "Store pickup",       detail: "Collect it yourself · the shop will contact you" }
    ],

    // ---------- Delivery companies (for Standard delivery) ----------
    // "id" is what appears in your order message. "logo" is optional ("" = show the name only).
    deliveryCompanies: [
        { id: "VET",  name: "Vireak Buntham", logo: "https://vireakbuntham.com/img/vireak-buntham.3087fdaf.png" },
        { id: "J&T",  name: "J&T Express",    logo: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR14ZxIWPL4ua777cTemr_v4dZykQ4uUBkOtvMIn_DMSKK5H6Hs3CQyp0mhI0nu7mAz0PXY-wpA0L2XP5ho3fK1b1bUudRwK7WYtHV8eQ&s=10" },
        { id: "L192", name: "L192",           logo: "https://encrypted-tbn3.gstatic.com/images?q=tbn:ANd9GcQjJr4cZCuxXdd6s-sNuo_VolvXeyDL6tQqpdshMQAprJDR6kBK" }
    ],

    // ---------- Provinces (for Standard delivery) ----------
    // "value" goes into the order message, "label" is what the customer sees.
    provinces: [
        { value: "Phnom Penh", label: "Phnom Penh" },
        { value: "Banteay Meanchey - Krong Serei Saophoan", label: "Krong Serei Saophoan - Banteay Meanchey" },
        { value: "Banteay Meanchey - Poipet", label: "Poipet - Banteay Meanchey" },
        { value: "Battambang", label: "Battambang" },
        { value: "Kampong Cham", label: "Kampong Cham" },
        { value: "Kampong Chhnang", label: "Kampong Chhnang" },
        { value: "Kampong Speu", label: "Kampong Speu" },
        { value: "Kampong Thom", label: "Kampong Thom" },
        { value: "Kampot - Krong Kampot", label: "Krong Kampot - Kampot" },
        { value: "Kandal", label: "Kandal" },
        { value: "Kep - Krong Kep", label: "Krong Kep - Kep" },
        { value: "Koh Kong", label: "Koh Kong" },
        { value: "Kratie", label: "Kratie" },
        { value: "Mondulkiri", label: "Mondulkiri" },
        { value: "Oddar Meanchey", label: "Oddar Meanchey" },
        { value: "Pailin", label: "Pailin" },
        { value: "Preah Sihanouk", label: "Preah Sihanouk" },
        { value: "Preah Vihear", label: "Preah Vihear" },
        { value: "Prey Veng", label: "Prey Veng" },
        { value: "Pursat", label: "Pursat" },
        { value: "Ratanakiri", label: "Ratanakiri" },
        { value: "Siem Reap", label: "Siem Reap" },
        { value: "Stung Treng", label: "Stung Treng" },
        { value: "Svay Rieng", label: "Svay Rieng" },
        { value: "Takeo", label: "Takeo" },
        { value: "Tboung Khmum", label: "Tboung Khmum" }
    ],

    // ---------- Google Maps (for Grab Express location pin) ----------
    // The map only loads when a customer chooses Grab Express, so the store opens faster.
    googleMapsApiKey: "AIzaSyBZ2h_cG0r0mccTr78C9cK2-zC5rexpwik"
};

// ⚠️ DO NOT DELETE the line below.
// It lets the secure order server read these settings (delivery options, companies, provinces)
// so it can check orders. It does nothing in the customer's browser.
if (typeof module !== "undefined" && module.exports) { module.exports = STORE_CONFIG; }
