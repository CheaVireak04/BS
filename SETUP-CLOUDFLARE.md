# BRICK STORE — Moving to Cloudflare (simple guide)

Takes about 30–45 minutes. Everything here is free.

## What changes (the 10-year-old version)

- **Before:** your website lived on GitHub Pages. When a customer ordered, Telegram opened a chat with you and the customer had to press **Send** themselves.
- **After:** your website lives on **Cloudflare**, a big, fast company that hosts websites. Cloudflare also runs a small helper program called a **Worker**. When a customer taps **Place order**, the Worker sends the order to you automatically through your Telegram bot.
- **The bot token** is the bot's password. Anyone who has it can control your bot. That's why it goes into Cloudflare's locked safe (called a **Secret**) and nowhere else. Customers can never see it.

```
You change files on GitHub
        ↓  (Cloudflare notices automatically)
Cloudflare Worker "bs"
   ├─ shows the website (the files in the "public" folder)
   └─ /api/orders  → checks the order → Telegram bot → your chat
```

> ⚠️ **Never** paste your bot token into GitHub, into any file, or into a chat with anyone (including AI). It only goes into Cloudflare, in Step 5.

---

## Step 1 — Put the new files on GitHub

**What this does:** GitHub is where your store's files are kept. Cloudflare will read them from there.

On your computer, the new version is in **`BS\brick-store`**. From now on, use only this folder. The loose files directly inside `BS` are the previous version: move them into a folder named `old` so you don't mix them up.

```
brick-store
├─ public/            ← the website (products.js, store-config.js, app.js, index.html, …)
├─ worker/            ← the order helper that runs on Cloudflare
├─ index.html         ← small redirect so your OLD GitHub Pages link keeps working
├─ wrangler.jsonc     ← Cloudflare settings (no passwords inside)
├─ package.json, package-lock.json
├─ .gitignore, .dev.vars.example
└─ SETUP-CLOUDFLARE.md, HOW-TO-EDIT.md
```

On the GitHub website:
1. Open your BRICK STORE repository.
2. Click **Add file → Upload files**.
3. Open `BS\brick-store` on your computer, select **everything inside it**, and drag it onto the GitHub page. Don't include `node_modules` if you ever see it.
4. Click **Commit changes**.
5. **Delete the old copies** that used to sit in the main folder. They now live inside `public`: `app.js`, `products.js`, `store-config.js`, `styles.css`, `manifest.webmanifest` and the `icons` folder. For each one: click the file → click **⋯** (top right) → **Delete file** → **Commit changes**. **Keep** the main-folder `index.html`: that's the new redirect.

✅ Your old GitHub Pages link still works after this, because the redirect sends visitors into `public`.

---

## Step 2 — Create a Cloudflare account

**What this does:** gives you a free place to run your store.

1. Go to **dash.cloudflare.com** and sign up (free plan) or log in.
2. Confirm your email.

---

## Step 3 — Connect GitHub and create the Worker

**What this does:** tells Cloudflare "take my store from GitHub and put it online, and do it again every time I change something."

1. In Cloudflare, open **Workers & Pages** (left menu, sometimes under **Compute**).
2. Click **Create** → **Import a repository** (or **Connect to Git**). Choose **GitHub**.
3. GitHub asks for permission. Allow access to **only your BRICK STORE repository**.
4. Choose the repository and the main branch.
5. **Project / Worker name:** type exactly `bs`. It must match the name inside `wrangler.jsonc`, or the build fails.
6. **Build command:** leave empty.
   **Deploy command:** `npx wrangler deploy` (usually filled in already).
7. Click **Deploy** (or **Save and Deploy**) and wait 1–2 minutes.
8. You get a free address like **`https://bs.YOUR-NAME.workers.dev`**. Open it. You should see your store.

(Button names may be slightly different — Cloudflare changes its dashboard sometimes. The idea stays the same.)

---

## Step 4 — Get your bot token and your chat ID

**Bot token = the bot's password. Chat ID = the address the orders are sent to.**

The simplest choice is to use your existing store bot, **@BrickMini_bot**, as the order bot too. Then there's only one token.

**Token:**
1. In Telegram, open **@BotFather**.
2. Send `/mybots` → choose **@BrickMini_bot** → **API Token**.
3. Copy it. Keep it secret.

**Chat ID (orders go to your own Telegram):**
1. Open **@BrickMini_bot** and press **Start**. A bot can only message people who have pressed Start.
2. Open **@userinfobot** and press **Start**. It replies with your **Id** (a number like `123456789`). Copy it.

**Chat ID for a group instead (optional):**
1. Create the group and add **@BrickMini_bot** as a member. Send any message in the group.
2. On your own computer, open this in your browser (replace `<TOKEN>` with your token):
   `https://api.telegram.org/bot<TOKEN>/getUpdates`
3. Look for `"chat":{"id":-100…`. That negative number (starting with `-100`) is the group's chat ID.
4. If your group uses **Topics**, you can also add `TELEGRAM_THREAD_ID` (the topic number) in Step 5.

---

## Step 5 — Put the token and chat ID into Cloudflare's safe

**What this does:** stores the password where only the Worker can read it.

1. Cloudflare → **Workers & Pages** → **bs** → **Settings** → **Variables and Secrets** → **Add**.
2. Type: **Secret** · Name: `TELEGRAM_BOT_TOKEN` · Value: your token.
3. Click **Add** again. Type: **Secret** · Name: `TELEGRAM_CHAT_ID` · Value: your chat ID.
4. Click **Deploy** (or **Save**).

Names must be typed **exactly** like that, in capital letters with underscores.

*Only if the order bot is a different bot from @BrickMini_bot:* also add a Secret `MINI_APP_BOT_TOKEN` with @BrickMini_bot's token. Without it, orders still arrive, but they are marked "not verified".

---

## Step 6 — Check the settings

Open `https://bs.YOUR-NAME.workers.dev/api/health` in your browser. You should see:

```
"botTokenSet":true, "chatIdSet":true, "productsLoaded":10
```

It only says *whether* the settings exist. It never shows their values. If something says `false`, repeat Step 5.

---

## Step 7 — Point your Telegram Mini App to the new address

**What this does:** makes the bot open the Cloudflare version instead of GitHub Pages.

1. **@BotFather** → send `/myapps` → choose your app (**Homepage**) → **Edit Web App URL** → paste `https://bs.YOUR-NAME.workers.dev`.
2. If your bot also has a **Menu Button** that opens the store: `/mybots` → **@BrickMini_bot** → **Bot Settings** → **Menu Button** → set the same address.
3. Close the Mini App completely and open it again.

---

## Step 8 — Test one real order

1. Open the store **inside Telegram** from @BrickMini_bot.
2. Add something to the cart → **Checkout** → your name is filled in from Telegram → type a phone number → choose **Store pickup** → type "TEST ORDER" as the note → **Place order**.
3. You should see **Order received** and a number like `BRICK-260929-7K2QX`.
4. Your chat (or group) should get **🛍️ NEW ORDER #BRICK-…** with ✅ verified.
5. Try **Standard delivery** and **Grab Express** once each too.

**If it fails:** the customer sees "Order could not be sent. Please try again." Then check:
- Step 6 shows `true` for both settings.
- You pressed **Start** on the bot (Step 4).
- For a group: the bot is still a member.
- Cloudflare → **bs** → **Logs** shows the reason (for example "chat not found"). The token is never printed there.

---

## After it works

- **Updating the store:** change files on GitHub (for example `public/products.js`). Cloudflare puts the new version online by itself within 1–2 minutes. No manual uploading to Cloudflare.
- **Old GitHub Pages site:** once you've tested for a few days, you can turn it off: GitHub → repository → **Settings → Pages** → **Unpublish** or set **Source** to **None**.
- **Google Maps:** if you restricted your Maps key to certain websites, add your new `workers.dev` address in Google Cloud Console → **APIs & Services → Credentials**.
- **Only-Telegram orders (extra spam protection):** in `wrangler.jsonc`, change `"REQUIRE_TELEGRAM_USER": "false"` to `"true"`. After that, orders placed from a normal web browser are refused.
- **Your own domain later (optional):** Cloudflare → **bs** → **Settings → Domains & Routes → Add → Custom domain**. Then update the BotFather URL again.
