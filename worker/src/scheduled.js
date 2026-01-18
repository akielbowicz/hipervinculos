import { GitHubAdapter } from './github.js';

const MAX_ATTEMPTS = 3;

/**
 * Handle scheduled cron job to process retry queue
 * @param {object} env - Environment bindings
 */
export async function handleScheduled(env) {
  const github = new GitHubAdapter(env);

  // List all retry keys
  const { keys } = await env.RETRY_QUEUE.list({ prefix: 'retry:' });

  for (const { name: key } of keys) {
    try {
      const data = await env.RETRY_QUEUE.get(key);
      if (!data) continue;

      const retryData = JSON.parse(data);
      const { bookmark, attempts } = retryData;

      try {
        await github.saveBookmark(bookmark);

        // Success - delete the retry key
        await env.RETRY_QUEUE.delete(key);
        console.log(`Retry succeeded for ${key}`);
      } catch (error) {
        // Failed - check if we should retry again or give up
        if (attempts >= MAX_ATTEMPTS) {
          // Max attempts reached, delete the key
          await env.RETRY_QUEUE.delete(key);
          console.error(`Max retries exceeded for ${key}:`, error.message);
        } else {
          // Update with incremented attempt count
          const updatedData = {
            ...retryData,
            attempts: attempts + 1,
            lastError: error.message,
            lastAttempt: new Date().toISOString(),
          };
          await env.RETRY_QUEUE.put(key, JSON.stringify(updatedData));
          console.log(`Retry failed for ${key}, attempt ${attempts + 1}`);
        }
      }
    } catch (error) {
      // Error processing this key, continue with others
      console.error(`Error processing retry key ${key}:`, error);
    }
  }
}
