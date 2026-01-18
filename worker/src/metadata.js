import * as cheerio from 'cheerio';

const TIMEOUT_MS = 5000;

export class InvalidUrlError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidUrlError';
  }
}

/**
 * Fetch and extract metadata from a URL
 * @param {string} url - The URL to fetch metadata from
 * @returns {Promise<{title?: string, description?: string, image?: string, url: string, partial?: boolean}>}
 */
export async function fetchMetadata(url) {
  // Validate URL
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('Invalid protocol');
    }
  } catch {
    throw new InvalidUrlError(`Invalid URL: ${url}`);
  }

  // Fetch with timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HipervinculosBot/1.0)',
      },
      redirect: 'follow',
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return { url: response.url || url, partial: true };
    }

    const html = await response.text();
    const finalUrl = response.url || url;

    const $ = cheerio.load(html);

    // Extract metadata with og: fallbacks
    const title =
      $('meta[property="og:title"]').attr('content') ||
      $('meta[name="twitter:title"]').attr('content') ||
      $('title').text() ||
      undefined;

    const description =
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="twitter:description"]').attr('content') ||
      $('meta[name="description"]').attr('content') ||
      undefined;

    const image =
      $('meta[property="og:image"]').attr('content') ||
      $('meta[name="twitter:image"]').attr('content') ||
      undefined;

    return {
      title: title || undefined,
      description: description || undefined,
      image: image || undefined,
      url: finalUrl,
    };
  } catch (error) {
    clearTimeout(timeoutId);

    // Return partial data on any error (timeout, network, etc.)
    return { url, partial: true };
  }
}
