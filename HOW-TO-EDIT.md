# BRICK STORE — How to edit your store (no coding needed)

Your store is made of a few files. You only ever need to touch **two** of them:

| File | What's inside | Do you edit it? |
|---|---|---|
| `products.js` | All your products | **Yes** |
| `store-config.js` | Home page text, Telegram username, social links, delivery options, provinces | **Yes** |
| `styles.css` | Colours and look | Only if you want to change colours |
| `app.js` | How the store works | No |
| `index.html` | Page structure | No |
| `manifest.webmanifest`, `icons/` | App icon for "Add to Home Screen" | No (replace the icon pictures if you want) |

Open the files with **Notepad** (right-click → Open with → Notepad) or, better, the free **Visual Studio Code**.

---

## 1. Change a product

Open `products.js`. Each product looks like this:

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

**Photos:** either paste a full web link (`https://...`), or put the photo file in the same folder as `index.html` and write just its name, like `"my-shirt.jpg"`. Best: square, about 1000×1000 pixels, JPG or WEBP.

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

Open `store-config.js`:

- **Home page title** → `heroTitle`, `heroSubtitle` (optional `heroEyebrow`, `heroImage`)
- **Who receives orders** → `supportUsername` (your Telegram username, without @)
- **About text** → `aboutText`
- **Facebook / TikTok / Instagram links** → `socialLinks`
- **Delivery options, companies, provinces** → `deliveryOptions`, `deliveryCompanies`, `provinces`
- **Currency sign** → `currencySymbol`
- **How many products each collection shows** → `maxNewArrivals`, `maxTrending`, `maxBestDeals`, `maxBestSelling`

---

## 3. Put the new version online

Your live store only changes when these files are uploaded to where your store is hosted (your GitHub repository).

On the GitHub website:
1. Open your repository.
2. Click **Add file → Upload files**.
3. Drag in **all** of these: `index.html`, `app.js`, `products.js`, `store-config.js`, `styles.css`, `manifest.webmanifest`, and the whole `icons` folder.
4. Click **Commit changes**.
5. Wait 1–2 minutes, then open the store in Telegram. If you still see the old version, close the Mini App completely and open it again.

Do **not** upload the `_backup_original` folder — it's your safety copy of the old store.

## 4. Undo everything
The old store is saved in `_backup_original`. Copy those 3 files back over the new ones to go back.
