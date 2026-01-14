import { Octokit } from '@octokit/rest';
import { Buffer } from 'node:buffer';

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

    while (attempt < maxRetries) {
      try {
        const { bookmarks, sha } = await this.getBookmarkFile();
        
        // Append new bookmark
        bookmarks.push(bookmark);
        
        const newContent = bookmarks
          .map(b => JSON.stringify(b))
          .join('\n') + '\n';
        
        const encodedContent = Buffer.from(newContent).toString('base64');

        await this.octokit.repos.createOrUpdateFileContents({
          owner: this.owner,
          repo: this.repo,
          path: this.path,
          message: `Add: ${bookmark.title || 'Untitled'}`,
          content: encodedContent,
          sha: sha || undefined, // undefined for new file
        });

        return; // Success
      } catch (error) {
        if (error.status === 409) {
          console.log(`Conflict detected (attempt ${attempt + 1}), retrying...`);
          attempt++;
          // Wait random time to reduce collision probability
          await new Promise(r => setTimeout(r, Math.random() * 500 + 200));
        } else {
          throw error;
        }
      }
    }
    throw new Error('Failed to save bookmark after multiple retries due to conflicts.');
  }
}
