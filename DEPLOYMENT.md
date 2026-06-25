# Joblynk - Afrihost Deployment Guide

## Overview
This guide covers deploying Joblynk to Afrihost shared hosting using Git version control deployment.

---

## 1. Afrihost Setup

### 1.1 Purchase Hosting
- Go to [afrihost.com](https://afrihost.com) → Web Hosting → choose a Linux cPanel plan
- Register or point your domain (e.g., `joblynk.co.za`)

### 1.2 Login to cPanel
- URL: `https://yourdomain.co.za:2083` or via Afrihost ClientZone
- Note your MySQL and FTP credentials

---

## 2. Database Setup

### 2.1 Create MySQL Database (cPanel)
1. cPanel → **MySQL Databases**
2. Create a new database (e.g., `joblynk`)
3. Create a new user with a strong password
4. Add the user to the database with **ALL PRIVILEGES**
5. Note the database name, username, and password (the DB name will be prefixed like `cpuser_joblynk`)

### 2.2 Import Schema
1. cPanel → **phpMyAdmin**
2. Select your new database
3. Go to the **Import** tab
4. Upload `api/schema.sql`
5. Click **Go** to run the import

---

## 3. Git Deployment Setup

### 3.1 Create a Git Repository on GitHub/GitLab
```bash
cd c:\laragon\www\joblynk
git init
git add .
git commit -m "Initial commit - Joblynk production ready"
git branch -M main
git remote add origin https://github.com/yourusername/joblynk.git
git push -u origin main
```

### 3.2 Setup Git Version Control in cPanel
1. cPanel → **Git™ Version Control**
2. Click **Create**
3. Fill in:
   - **Clone URL**: `https://github.com/yourusername/joblynk.git`
   - **Repository Path**: `/home/cpuser/public_html` (or subdomain directory)
   - **Repository Name**: `joblynk`
4. Click **Create**

### 3.3 Deploy Updates
Every time you push to your repo, go to cPanel → Git Version Control → click **Update from Remote** then **Deploy HEAD Commit**.

#### Automatic Deployment (Webhook)
You can also set up a webhook for auto-deploy:
1. In cPanel → Git Version Control, copy the **Deploy URL**  
2. In GitHub → Settings → Webhooks → Add webhook
3. Paste the deploy URL as the Payload URL
4. Set Content type to `application/json`
5. Save

---

## 4. Environment Configuration

### 4.1 Create the .env File on Server
Since `.env` is gitignored, you must create it manually on the server.

**Option A: via cPanel File Manager**
1. cPanel → **File Manager** → navigate to `public_html`
2. Click **+ File** → name it `.env`
3. Right-click → **Edit** → paste your production values:

```env
APP_ENV=production
APP_URL=https://yourdomain.co.za
APP_NAME=Joblynk

DB_HOST=localhost
DB_NAME=cpuser_joblynk
DB_USER=cpuser_dbuser
DB_PASS=your_strong_password

RESEND_API_KEY=re_your_live_api_key
RESEND_FROM_EMAIL="Joblynk <noreply@yourdomain.co.za>"

PAYFAST_MERCHANT_ID=your_live_merchant_id
PAYFAST_MERCHANT_KEY=your_live_merchant_key
PAYFAST_PASSPHRASE=your_live_passphrase
PAYFAST_SANDBOX=false

PAYSTACK_SECRET_KEY=sk_live_xxxx
PAYSTACK_PUBLIC_KEY=pk_live_xxxx
```

**Option B: via SSH (if available)**
```bash
ssh cpuser@yourdomain.co.za
cd public_html
nano .env
# Paste your production values and save
```

---

## 5. SSL/HTTPS Setup

### 5.1 Enable SSL
1. cPanel → **SSL/TLS Status** or **AutoSSL**
2. Run AutoSSL to get a free Let's Encrypt certificate
3. Wait for it to provision (usually a few minutes)

### 5.2 Force HTTPS
Once SSL is active, edit the `.htaccess` file and uncomment the HTTPS redirect:
```apache
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
```

---

## 6. Domain Configuration

### 6.1 Point Domain to Afrihost
Set your domain's nameservers to Afrihost's:
- `ns1.afrihost.com`
- `ns2.afrihost.com`

Or create an A record pointing to your Afrihost server IP (found in cPanel → **Server Information**).

### 6.2 Update APP_URL
Make sure your `.env` file has the correct `APP_URL` matching your domain.

---

## 7. Post-Deployment Checklist

- [ ] Database imported and accessible
- [ ] `.env` file created on server with production values
- [ ] SSL certificate active and HTTPS forced
- [ ] PayFast set to production mode (`PAYFAST_SANDBOX=false`)
- [ ] Paystack using live keys (`sk_live_`, `pk_live_`)
- [ ] Resend using verified sender domain
- [ ] Test user registration, login, email verification
- [ ] Test payment flow
- [ ] Test CV/Cover Letter builder
- [ ] Test job posting (recruiter)
- [ ] Remove or protect seed-database.php / install-mock-data.php

---

## 9. Weekly Job Feed (Adzuna — no cron required)

Add these variables to your server `.env`:

```
ADZUNA_APP_ID=your_app_id
ADZUNA_APP_KEY=your_app_key
JOBS_SYNC_ENABLED=1
```

Optional tuning (defaults are fine):

```
ADZUNA_MAX_API_CALLS=180
ADZUNA_MAX_PAGES_PER_QUERY=5
```

Register for free Adzuna API keys at https://developer.adzuna.com/signup (country: South Africa / `za`).

### 9.1 Weekly refresh (recommended)

1. Deploy the latest code to Afrihost
2. Add `ADZUNA_APP_ID` and `ADZUNA_APP_KEY` to `.env`
3. Log in as **admin**
4. Go to **Admin → Job Listings**
5. Click **Refresh job feed (weekly)** once

The refresh runs for several minutes, imports thousands of SA jobs from Adzuna (up to the free daily API limit), and closes Adzuna listings from the previous batch that were not re-imported.

Repeat **once per week** — no cPanel cron jobs needed.

### 9.2 Optional: CLI or cron

If you prefer automation later, you can run via SSH/CLI:

```bash
php /home/cpuser/public_html/api/jobs/sync-adzuna.php
```

Optional HTTP trigger (only if you set `SYNC_SECRET` in `.env`):

```
GET https://yourdomain.co.za/api/jobs/sync-adzuna.php?secret=YOUR_SYNC_SECRET
```

### 9.3 DPSA government vacancies (optional)

Upload a parsed DPSA vacancy circular JSON via **Admin → Job Listings → Import DPSA JSON**.

---

## 10. Ongoing Deployment Workflow

```
# Local development
1. Make code changes locally
2. Test on Laragon (http://joblynk.net)
3. Commit and push:
   git add .
   git commit -m "Description of changes"
   git push origin main

# Production
4. cPanel → Git Version Control → Update from Remote → Deploy
   (or automatic via webhook)
```

---

## 11. Troubleshooting

| Issue | Solution |
|-------|----------|
| 500 Internal Server Error | Check `error_log` in File Manager; verify `.htaccess` syntax |
| Database connection failed | Verify DB credentials in `.env`; ensure user has privileges |
| CORS errors | Verify `APP_URL` in `.env` matches your actual domain |
| Emails not sending | Check Resend API key; verify sender domain in Resend dashboard |
| Sessions not persisting | Ensure `session.save_path` is writable; check PHP version |
| Git deploy fails | Check repository path; ensure `.cpanel.yml` exists if needed |

---

## 12. PHP Version

Afrihost supports multiple PHP versions. This app requires **PHP 7.4+** (PHP 8.x recommended).
Set this in cPanel → **MultiPHP Manager** → select your domain → choose PHP 8.1 or 8.2.
