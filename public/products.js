/**
 * ============================================================
 *  BRICK STORE — PRODUCT LIST  (the ONLY place products live)
 * ============================================================
 *  The products below are DEMO / PLACEHOLDER products.
 *  Replace them with your real products whenever you are ready.
 *
 *  EACH PRODUCT LOOKS LIKE THIS:
 *
 *  {
 *      id: 1,                       // a unique number. Never use the same number twice.
 *      category: "T-Shirts",        // optional. Groups products in the Filters menu.
 *      name: "Product name",
 *      price: 12,                   // normal price (numbers only, no $ sign)
 *      oldPrice: 15,                // optional. Shown crossed out when it is higher than the price. Use 0 or delete to hide.
 *      image: "photo-link-or-file.jpg",     // main photo
 *      gallery: ["photo1.jpg", "photo2.jpg"], // optional. More photos for the product page (swipe on phones).
 *      desc: "Short description.",
 *      dateAdded: "2026-03-01",     // year-month-day. Used for "New Arrivals".
 *      clicks: 450,                 // popularity number. Used for "Trending Now".
 *      sales: 85,                   // how many sold. Used for "Best Selling".
 *      tags: ["word", "another"],   // extra search words (customers can search these)
 *      variants: [                  // optional. Sizes / colours / versions, each with its own price.
 *          { name: "Small", price: 12 },
 *          { name: "Large", price: 15 }
 *      ],
 *      stock: 5,                    // optional. 0 = "Sold out". Delete the line if you don't track stock.
 *      badge: "Limited"             // optional. A small label on the product photo.
 *  },
 *
 *  RULES THAT KEEP THE STORE WORKING
 *  - Every product ends with  },   (a closing bracket and a comma).
 *  - Text goes inside "quote marks". Numbers do not.
 *  - Photos: use a full web link (https://...) or put the photo file in
 *    this same folder and write just its name, e.g. "my-shirt.jpg".
 *    Best size: square, about 1000 x 1000 pixels, JPG or WEBP.
 *  - If a product has variants, the first variant's price should match "price".
 * ============================================================
 */

const products = [
    {
        id: 1, category: "Fixed blade", name: "T3 Module Power Bank", price: $75.99, oldPrice: $95.99,
        image: "https://trozk.com/cdn/shop/files/1_1-_1.png?v=1787575139&width=2000",
        gallery: ["https://trozk.com/cdn/shop/files/1_1-_1.png?v=1787575139&width=2000"],
        desc: "Premium replica desk toy. Deep sapphire phases.",
        dateAdded: "2026-03-01", clicks: 450, sales: 85,
        tags: ["knife", "doppler", "sapphire", "curved", "blue"],
        variants: [{ name: "Standard Phase 3", price: 12 }, { name: "Sapphire Edition", price: 18 }]
    },
    {
        id: 2, category: "Fixed blade", name: "Floppy Magnetic Power Bank", price: $55.99, oldPrice: $69.99​,
        image: "https://trozk.com/cdn/shop/files/5_8060d2c9-4fd5-4c90-ad3c-02cbb278dad3.jpg?v=1766902510&width=2000",
        gallery: ["https://trozk.com/cdn/shop/files/5_8060d2c9-4fd5-4c90-ad3c-02cbb278dad3.jpg?v=1766902510&width=2000"],
        desc: "Premium replica desk toy. 100% fade pattern.",
        dateAdded: "2026-03-02", clicks: 600, sales: 120,
        tags: ["knife", "fade", "gradient", "curved"],
        variants: [{ name: "90% Fade", price: 12 }, { name: "100% Full Fade", price: 20 }]
    },
    {
        id: 3, category: "Fixed blade", name: "M9 Bayonet Crimson Web", price: 12, oldPrice: 15,
        image: "https://cdn.skinport.com/cdn-cgi/image/width=512,height=384,fit=pad,format=avif,quality=85,background=transparent/images/screenshots/632372451/playside.png",
        gallery: ["https://cdn.skinport.com/cdn-cgi/image/width=512,height=384,fit=pad,format=avif,quality=85,background=transparent/images/screenshots/632372451/playside.png"],
        desc: "Premium replica desk toy. Factory new look with distinct webbing patterns.",
        dateAdded: "2026-03-03", clicks: 300, sales: 50,
        tags: ["knife", "crimson", "web", "bayonet", "red"],
        variants: [{ name: "Field-Tested Look", price: 12 }, { name: "Factory New Look", price: 16 }]
    },
    {
        id: 4, category: "Folding", name: "Butterfly Knife Marble Fade", price: 12, oldPrice: 18,
        image: "https://cdn.skinport.com/cdn-cgi/image/width=512,height=384,fit=pad,format=avif,quality=85,background=transparent/images/screenshots/632758204/playside.png",
        gallery: ["https://cdn.skinport.com/cdn-cgi/image/width=512,height=384,fit=pad,format=avif,quality=85,background=transparent/images/screenshots/632758204/playside.png"],
        desc: "Premium replica desk toy. Smooth flipping action mechanism.",
        dateAdded: "2026-03-04", clicks: 800, sales: 200,
        tags: ["knife", "butterfly", "marble", "balisong", "fade"],
        variants: [{ name: "Standard Mechanism", price: 12 }, { name: "Pro Bearing Pivot", price: 19 }]
    },
    {
        id: 5, category: "Folding", name: "Butterfly Knife Tiger Tooth", price: 12, oldPrice: 18,
        image: "https://cdn.skinport.com/cdn-cgi/image/width=512,height=384,fit=pad,format=avif,quality=85,background=transparent/images/screenshots/616083695/playside.png",
        gallery: ["https://cdn.skinport.com/cdn-cgi/image/width=512,height=384,fit=pad,format=avif,quality=85,background=transparent/images/screenshots/616083695/playside.png"],
        desc: "Premium replica desk toy. Golden anodized finish.",
        dateAdded: "2026-03-05", clicks: 500, sales: 95,
        tags: ["knife", "butterfly", "tiger", "balisong", "gold", "yellow"],
        variants: [{ name: "Standard Finish", price: 12 }, { name: "High-Gloss Mirror", price: 17 }]
    },
    {
        id: 6, category: "Fixed blade", name: "Talon Knife Slaughter", price: 12, oldPrice: 15,
        image: "https://cdn.skinport.com/cdn-cgi/image/width=512,height=384,fit=pad,format=avif,quality=85,background=transparent/images/screenshots/631798830/playside.png",
        gallery: ["https://cdn.skinport.com/cdn-cgi/image/width=512,height=384,fit=pad,format=avif,quality=85,background=transparent/images/screenshots/631798830/playside.png"],
        desc: "Premium replica desk toy. Ivory-style handle.",
        dateAdded: "2026-03-06", clicks: 200, sales: 30,
        tags: ["knife", "talon", "slaughter", "red", "curved"],
        variants: [{ name: "Standard", price: 12 }, { name: "Diamond Pattern", price: 15 }]
    },
    {
        id: 7, category: "Fixed blade", name: "Huntsman Knife Doppler", price: 12, oldPrice: 15,
        image: "https://cdn.skinport.com/cdn-cgi/image/width=512,height=384,fit=pad,format=avif,quality=85,background=transparent/images/screenshots/602129942/playside.png",
        gallery: ["https://cdn.skinport.com/cdn-cgi/image/width=512,height=384,fit=pad,format=avif,quality=85,background=transparent/images/screenshots/602129942/playside.png"],
        desc: "Premium replica desk toy. Aggressive serrated spine.",
        dateAdded: "2026-03-07", clicks: 350, sales: 60,
        tags: ["knife", "huntsman", "doppler", "serrated", "ruby"],
        variants: [{ name: "Phase 1", price: 12 }, { name: "Ruby Gem", price: 22 }]
    },
    {
        id: 8, category: "Folding", name: "Flip Knife Fade", price: 12, oldPrice: 15,
        image: "https://cdn.skinport.com/cdn-cgi/image/width=512,height=384,fit=pad,format=avif,quality=85,background=transparent/images/screenshots/625454898/playside.png",
        gallery: ["https://cdn.skinport.com/cdn-cgi/image/width=512,height=384,fit=pad,format=avif,quality=85,background=transparent/images/screenshots/625454898/playside.png"],
        desc: "Premium replica desk toy. Sleek, foldable design.",
        dateAdded: "2026-03-08", clicks: 400, sales: 75,
        tags: ["knife", "flip", "fade", "pocket", "foldable"],
        variants: [{ name: "Standard Lock", price: 12 }, { name: "Spring Assist Lock", price: 14 }]
    },
    {
        id: 9, category: "Fixed blade", name: "Shadow Daggers Marble Fade", price: 12, oldPrice: 15,
        image: "https://cdn.skinport.com/cdn-cgi/image/width=512,height=384,fit=pad,format=avif,quality=85,background=transparent/images/screenshots/632307382/playside.png",
        gallery: ["https://cdn.skinport.com/cdn-cgi/image/width=512,height=384,fit=pad,format=avif,quality=85,background=transparent/images/screenshots/632307382/playside.png"],
        desc: "Premium replica desk toy. Dual-push daggers.",
        dateAdded: "2026-03-09", clicks: 150, sales: 20,
        tags: ["knife", "shadow", "daggers", "marble", "push", "dual"],
        variants: [{ name: "Standard Grip", price: 12 }, { name: "Weighted Grip", price: 15 }]
    },
    {
        id: 10, category: "Fixed blade", name: "Bowie Knife Tiger Tooth", price: 12, oldPrice: 15,
        image: "https://cdn.skinport.com/cdn-cgi/image/width=512,height=384,fit=pad,format=avif,quality=85,background=transparent/images/screenshots/632900583/playside.png",
        gallery: ["https://cdn.skinport.com/cdn-cgi/image/width=512,height=384,fit=pad,format=avif,quality=85,background=transparent/images/screenshots/632900583/playside.png"],
        desc: "Premium replica desk toy. Massive display piece.",
        dateAdded: "2026-03-10", clicks: 250, sales: 40,
        tags: ["knife", "bowie", "tiger", "tooth", "large", "gold"],
        variants: [{ name: "Standard Edge", price: 12 }, { name: "Sharpened Edge", price: 16 }]
    }
];

// ⚠️ DO NOT DELETE the line below.
// It lets the secure order server (the "worker" folder) read this same product list,
// so it can check prices when an order arrives. It does nothing in the customer's browser.
if (typeof module !== "undefined" && module.exports) { module.exports = products; }
