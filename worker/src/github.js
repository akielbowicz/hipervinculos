import { Octokit } from '@octokit/rest';
import { Buffer } from 'node:buffer';
import crypto from 'node:crypto';

function normalizeUrl(url) {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    parsed.hash = '';

    if ((parsed.protocol === 'http:' && parsed.port === '80') ||
        (parsed.protocol === 'https:' && parsed.port === '443')) {
      parsed.port = '';
    }

    if (parsed.pathname !== '/') {
      parsed.pathname = parsed.pathname.replace(/\/+$/, '');
    }

    const normalized = parsed.toString();
    return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
  } catch {
    return url.replace(/\/+$/, '').trim();
  }
}

function hashUrl(url) {
  return crypto.createHash('sha256').update(url).digest('hex').slice(0, 16);
}

function findDuplicateBookmark(bookmarks, bookmark) {
  const normalizedUrl = normalizeUrl(bookmark.url_normalized || bookmark.url);
  const urlHash = bookmark.url_hash || (normalizedUrl ? hashUrl(normalizedUrl) : null);

  return bookmarks.find(existing => {
    const existingNormalized = normalizeUrl(existing.url_normalized || existing.url);
    const existingHash = existing.url_hash || (existingNormalized ? hashUrl(existingNormalized) : null);

    return (
      (normalizedUrl && existingNormalized === normalizedUrl) ||
      (urlHash && existingHash === urlHash) ||
      existing.url === bookmark.url
    );
  }) || null;
}

export class GitHubAdapter {
  constructor(env) {
    this.owner = env.GITHUB_OWNER;
    this.repo = env.GITHUB_REPO;
    this.octokit = new Octokit({
      auth: env.GITHUB_TOKEN,
    });
    this.path = 'data/bookmarks.jsonl';
  }

  async getBookmarkFile() {
    try {
      const { data } = await this.octokit.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path: this.path,
      });

      const content = Buffer.from(data.content, 'base64').toString('utf8');
      const bookmarks = content
        .trim()
        .split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line));

      return { bookmarks, sha: data.sha };
    } catch (error) {
      if (error.status === 404) {
        return { bookmarks: [], sha: null };
      }
      throw error;
    }
  }

  async saveBookmark(bookmark) {
    const maxRetries = 3;
    let attempt = 0;

    const normalizedUrl = normalizeUrl(bookmark.url_normalized || bookmark.url);
    const bookmarkToSave = {
      ...bookmark,
      ...(normalizedUrl ? { url_normalized: normalizedUrl } : {}),
      ...(normalizedUrl ? { url_hash: bookmark.url_hash || hashUrl(normalizedUrl) } : {}),
    };

    while (attempt < maxRetries) {
      try {
        const { bookmarks, sha } = await this.getBookmarkFile();

        const duplicate = findDuplicateBookmark(bookmarks, bookmarkToSave);
        if (duplicate) {
          return {
            status: 'duplicate',
            bookmark: duplicate,
          };
        }

        bookmarks.push(bookmarkToSave);

        const newContent = bookmarks
          .map(b => JSON.stringify(b))
          .join('\n') + '\n';

        const encodedContent = Buffer.from(newContent).toString('base64');

        await this.octokit.repos.createOrUpdateFileContents({
          owner: this.owner,
          repo: this.repo,
          path: this.path,
          message: `Add: ${bookmarkToSave.title || 'Untitled'}`,
          content: encodedContent,
          sha: sha || undefined,
        });

        return {
          status: 'created',
          bookmark: bookmarkToSave,
        };
      } catch (error) {
        if (error.status === 409) {
          console.log(`Conflict detected (attempt ${attempt + 1}), retrying...`);
          attempt++;
          await new Promise(r => setTimeout(r, Math.random() * 500 + 200));
        } else {
          throw error;
        }
      }
    }
    throw new Error('Failed to save bookmark after multiple retries due to conflicts.');
  }
}

export { normalizeUrl, findDuplicateBookmark };
