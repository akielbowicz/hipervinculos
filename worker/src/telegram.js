import { fetchMetadata } from './metadata.js';
import { GitHubAdapter } from './github.js';

// URL regex pattern - matches http/https URLs
const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/i;

/**
 * Verify the webhook signature from Telegram
 * @param {Request} request - The incoming request
 * @param {string} secret - The expected secret token
 * @returns {boolean}
 */
export function verifyWebhookSignature(request, secret) {
  const token = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
  return token === secret;
}

/**
 * Extract the first URL from text
 * @param {string|null|undefined} text
 * @returns {string|null}
 */
export function extractUrl(text) {
  if (!text) return null;
  const match = text.match(URL_REGEX);
  return match ? match[0] : null;
}

/**
 * Send a message via Telegram API
 * @param {number} chatId
 * @param {string} text
 * @param {object} env
 */
export async function sendMessage(chatId, text, env) {
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
    }),
  });
}

/**
 * Handle incoming Telegram update
 * @param {object} update - Telegram update object
 * @param {object} env - Environment bindings
 */
export async function handleUpdate(update, env) {
  const message = update.message;
  if (!message) return;

  const chatId = message.chat.id;
  const text = message.text || message.caption || '';

  // Handle commands
  if (text.startsWith('/')) {
    const command = text.split(' ')[0].toLowerCase();

    if (command === '/start') {
      await sendMessage(
        chatId,
        'Welcome to Hipervínculos! 🔗\n\nSend me a URL and I\'ll save it to your bookmarks.',
        env
      );
      return;
    }

    // Unknown command
    await sendMessage(
      chatId,
      'Unknown command. Just send me a URL to save it as a bookmark.\n\nCommands:\n/start - Show welcome message',
      env
    );
    return;
  }

  // Extract URL from message
  const url = extractUrl(text);
  if (!url) {
    // No URL found, ignore silently
    return;
  }

  // Fetch metadata
  const metadata = await fetchMetadata(url);

  // Create bookmark
  const bookmark = {
    id: crypto.randomUUID(),
    url: metadata.url || url,
    title: metadata.title || undefined,
    description: metadata.description || undefined,
    image: metadata.image || undefined,
    tags: [],
    source: 'telegram',
    timestamp: new Date().toISOString(),
    chat_id: chatId,
  };

  // Try to save to GitHub
  const github = new GitHubAdapter(env);

  try {
    await github.saveBookmark(bookmark);

    await sendMessage(
      chatId,
      `✅ Saved: ${bookmark.title || bookmark.url}`,
      env
    );
  } catch (error) {
    // Queue for retry
    const retryKey = `retry:${bookmark.id}`;
    const retryData = {
      bookmark,
      attempts: 1,
      lastError: error.message,
      createdAt: new Date().toISOString(),
    };

    await env.RETRY_QUEUE.put(retryKey, JSON.stringify(retryData));

    await sendMessage(
      chatId,
      `⏳ Queued for retry: ${bookmark.title || bookmark.url}`,
      env
    );
  }
}
