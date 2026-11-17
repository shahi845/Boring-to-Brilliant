# Put OURCAMPUS online (GitHub + Vercel + Supabase)

## 1. GitHub: keep the folders
The code only works if the folders (`src`, `server`, `api`, `supabase` …) stay folders.
**Do not** use GitHub's "choose your files" button: it flattens every file into one list and the site breaks.

1. Start clean: delete the old repository (Settings → Delete this repository) and create a new **private** one. Don't add a README.
2. Unzip `Boring-to-Brilliant.zip` (right-click → Extract All) and open the extracted folder.
   You should see the folders `api`, `docs`, `public`, `server`, `src`, `supabase`, `tests` and files like `package.json`, `vercel.json`.
3. On the new repository page click **uploading an existing file**.
4. In File Explorer press **Ctrl + A** and **drag everything** onto the GitHub page (dragging keeps the folders). Wait until every file is listed, then **Commit changes**.
5. Check: the repository's top level must show the folders, not 80 loose files. Open `src` and you should see `app`, `lib`, `pages`, `styles`, `ui`.
6. Never upload the `private` folder or `.env` (they contain passwords and keys).

**Easier alternative (no GitHub upload):** in the extracted folder open a terminal and run
```
npm install
npx vercel --prod
```
Vercel uploads the folder with its structure intact and gives you the live link.

## 2. Supabase: create the database (once)
1. Supabase → your project → **SQL Editor → New query**.
2. Paste everything from `supabase/migrations/20261117000000_init.sql` → **Run**.
3. **Authentication → Sign In / Providers** → turn off "Allow new users to sign up".
4. **Project Settings → API**: copy the **Project URL**, the **anon** key and the **service_role** key.

## 3. Vercel: settings
Vercel → your project → **Settings → Environment Variables**. Add all four:

| Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | Project URL |
| `VITE_SUPABASE_ANON_KEY` | anon key |
| `SUPABASE_URL` | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key (secret) |

Then **Deployments → ⋯ → Redeploy**.
(New repository? In Vercel: **Add New → Project → Import** the new repository.)
(If Vercel asks: Framework = **Vite**, Root Directory = **./**, Build = `npm run build`, Output = `dist`.)

## 4. Create the sign-in accounts (once)
On your computer, in this folder (needs Node.js 20+):
```
npm install
copy .env.example .env      (then fill in the same 4 values in .env)
npm run accounts:create -- private/accounts.csv
```
`private/accounts.csv` is in the earlier project folder (`Downloads\campus\ourcampus\private`). Copy that `private` folder here first, and **never upload it to GitHub**.

## 5. Open your site
Open `https://<your-project>.vercel.app` and sign in as **ADMIN** first.
Check the API works: `https://<your-project>.vercel.app/api/health` should show `{"ok":true,"configured":true,…}`.
