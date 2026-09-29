# BRICK STORE — How to edit your store (no coding needed)

The website files are in the **`public`** folder. You only ever need to touch **two** of them:

| File | What's inside | Do you edit it? |
|---|---|---|
| `public/products.js` | All your products | **Yes** |
| `public/store-config.js` | Home page text, social links, delivery options, provinces | **Yes** |
| `public/styles.css` | Colours and look | Only if you want to change colours |
| `public/app.js`, `public/index.html` | How the store works / page structure | No |
| `public/manifest.webmanifest`, `public/icons/` | App icon for "Add to Home Screen" | No (replace the icon pictures if you want) |
| `worker/` | The secure order helper that runs on Cloudflare | No |
| `wrangler.jsonc` | Cloudflare settings (no passwords) | Rarely |

⚠️ At the very bottom of `products.js` and `store-config.js` there is a line that starts with `if (typeof module`. **Don't delete it** — the order server needs it to check prices.

Open the files with **Notepad** (right-click → Open with → Notepad) or, better, the free **Visual Studio Code**.

---

## 1. Change a product

Open `public/products.js`. Each product looks like this:

```js
{
    id: 1, category: "Fixed blade", name: "Karambit Doppler", price: 12, oldPrice: 15,
    image: "https://....png",
    gallery: ["https://....png"],
    desc: "Premium replica desk toy. Deep sapphire phases.",
    dateAdded: "2026-03-01", clicks: 450, sales: 85,
    tags: ["knife", "doppler", "sapphire"],
    variants: [{ name: "Standard Phase 3", price: 12 }, { name: "Sapphire Edition", price: 18 }]
},
```

| To change… | Edit this |
|---|---|
| Photo | `image` (and the same link inside `gallery`) |
| More photos | add links to `gallery`: `["photo1.jpg", "photo2.jpg", "photo3.jpg"]` |
| Name | `name` |
| Price | `price` (just the number, no `$`) |
| Crossed-out old price | `oldPrice` (use `0` to hide it) |
| Description | `desc` |
| Category | `category` (e.g. `"T-Shirts"`). Categories appear in **Filters** and the left menu automatically. |
| Sizes / colours / versions | `variants`. Each one has a `name` and a `price`. The first one's price should match `price`. |
| Search words | `tags` |
| "Sold out" / "Only 2 left" | add `stock: 0` or `stock: 2` (optional) |
| A small label like "Limited" | add `badge: "Limited"` (optional) |

**Photos:** either paste a full web link (`https://...`), or put the photo file in the `public` folder and write just its name, like `"my-shirt.jpg"`. Best: square, about 1000×1000 pixels, JPG or WEBP.

### Add a new product
1. Copy one whole product — from its `{` to its `},`
2. Paste it right after another product's `},`
3. Give it a **new** `id` number (never reuse a number).
4. Change the name, price, photo, etc.

### Remove a product
Delete everything from its `{` to its `},`.

### The 3 rules that keep the store working
1. Text goes inside "quote marks". Numbers don't.
2. Every product ends with `},` — keep the comma.
3. If the page goes blank after an edit, you probably deleted a comma, bracket or quote mark. Undo (Ctrl+Z), save, and try again.

---

## 2. Change store text and settings

Open `public/store-config.js`:

- **Home page title** → `heroTitle`, `heroSubtitle` (optional `heroEyebrow`, `heroImage`)
- **Your Telegram username** (Contact us + backup ordering) → `supportUsername` (without @)
- **Message shown after an order** → `orderSuccessText`
- **Where orders are delivered** → NOT in any file. It's the `TELEGRAM_CHAT_ID` secret in Cloudflare (see SETUP-CLOUDFLARE.md)
- **About text** → `aboutText`
- **Facebook / TikTok / Instagram links** → `socialLinks`
- **Delivery options, companies, provinces** → `deliveryOptions`, `deliveryCompanies`, `provinces`
- **Currency sign** → `currencySymbol`
- **How many products each collection shows** → `maxNewArrivals`, `maxTrending`, `maxBestDeals`, `maxBestSelling`

---

## 3. Put the new version online

1. On the GitHub website, open your repository → go into the `public` folder.
2. Click the file (for example `products.js`) → click the ✏️ pencil → make your change → **Commit changes**.
   (To add photos: in the `public` folder click **Add file → Upload files**.)
3. Cloudflare notices the change and puts it online by itself within 1–2 minutes.
4. Close the Mini App in Telegram and open it again to see the new version.

If the new version doesn't appear: Cloudflare → **Workers & Pages → bs → Deployments** shows whether the last update worked. A red ❌ usually means a missing comma or quote mark in the file you just edited.

## 4. Undo everything
The very first version of the store is saved in `_backup_original` on your computer (it is not on GitHub).
