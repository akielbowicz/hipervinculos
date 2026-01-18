# Setup Guide: Telegram Bookmark Bot

Step-by-step guide to deploy this Cloudflare Worker.

## Prerequisites

- Node.js installed
- Cloudflare account
- Telegram account
- GitHub repository for storing bookmarks

## 1. Create Telegram Bot

1. Open Telegram and search for `@BotFather`
2. Send `/newbot`
3. Follow prompts to name your bot
4. Save the token (format: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

## 2. Create GitHub Token

1. Go to https://github.com/settings/tokens?type=beta
2. Click "Generate new token"
3. Set:
   - **Repository access**: Only select repositories → choose your bookmarks repo
   - **Permissions**: Contents → Read and write
4. Save the token

## 3. Install Dependencies

```bash
cd worker
npm install
```

## 4. Configure Local Environment

```bash
cp .dev.vars.example .dev.vars
```

Edit `.dev.vars`:
```
TELEGRAM_BOT_TOKEN=your_telegram_token
GITHUB_TOKEN=ghp_your_github_token
WEBHOOK_SECRET=any_random_string
```

## 5. Test Locally

```bash
npx wrangler dev
```

Test with curl:
```bash
curl -X POST http://localhost:8787/webhook \
  -H "X-Telegram-Bot-Api-Secret-Token: your_webhook_secret" \
  -H "Content-Type: application/json" \
  -d '{"message":{"chat":{"id":123},"text":"https://example.com"}}'
```

## 6. Deploy to Cloudflare

### Login

Create API token at https://dash.cloudflare.com/profile/api-tokens using "Edit Cloudflare Workers" template.

```bash
export CLOUDFLARE_API_TOKEN=your_token
```

### Create KV Namespace

```bash
npx wrangler kv namespace create RETRY_QUEUE
```

Update `wrangler.toml` with the returned ID:
```toml
[[kv_namespaces]]
binding = "RETRY_QUEUE"
id = "the_id_from_above"
```

### Set Secrets

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put GITHUB_TOKEN
npx wrangler secret put WEBHOOK_SECRET
```

### Deploy

```bash
npx wrangler deploy
```

Note the URL (e.g., `https://hipervinculos-worker.your-subdomain.workers.dev`)

## 7. Configure Telegram Webhook

```bash
curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook?url=https://your-worker-url/webhook&secret_token=${WEBHOOK_SECRET}"
```

## 8. Test

Send a URL to your bot on Telegram. It should:
1. Reply with ✅ and the page title
2. Save the bookmark to `data/bookmarks.jsonl` in your GitHub repo

## Troubleshooting

### Unauthorized error
- Verify `WEBHOOK_SECRET` matches between worker secrets and Telegram webhook registration

### GitHub save fails
- Check token has write permissions to the repository
- Verify `GITHUB_OWNER` and `GITHUB_REPO` in `wrangler.toml`

### View logs
```bash
npx wrangler tail
```
