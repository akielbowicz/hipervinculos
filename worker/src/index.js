import { Hono } from 'hono';
import { verifyWebhookSignature, handleUpdate } from './telegram.js';
import { handleScheduled } from './scheduled.js';

const app = new Hono();

// Health check endpoint
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// Telegram webhook endpoint
app.post('/webhook', async (c) => {
  const env = c.env;

  // Verify webhook signature
  if (!verifyWebhookSignature(c.req.raw, env.WEBHOOK_SECRET)) {
    console.warn('Invalid webhook signature');
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const update = await c.req.json();
    await handleUpdate(update, env);
    return c.json({ ok: true });
  } catch (error) {
    console.error('Error handling webhook:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Error handling middleware
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

// Export handlers for Cloudflare Workers
export default {
  // HTTP handler
  fetch: app.fetch,

  // Scheduled handler (cron)
  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleScheduled(env));
  },
};
