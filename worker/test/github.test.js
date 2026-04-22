import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitHubAdapter, normalizeUrl } from '../src/github.js';

// Mock Octokit
const mockGetContent = vi.fn();
const mockCreateOrUpdate = vi.fn();

vi.mock('@octokit/rest', () => {
  return {
    Octokit: class {
      constructor() {
        this.request = vi.fn();
        this.repos = {
          getContent: mockGetContent,
          createOrUpdateFileContents: mockCreateOrUpdate,
        };
      }
    },
  };
});

describe('normalizeUrl', () => {
  it('should normalize equivalent URLs', () => {
    expect(normalizeUrl('https://github.com/michaelwhitford/nucleus/')).toBe(
      'https://github.com/michaelwhitford/nucleus'
    );
  });
});

describe('GitHubAdapter', () => {
  let adapter;
  const mockEnv = {
    GITHUB_TOKEN: 'fake-token',
    GITHUB_OWNER: 'user',
    GITHUB_REPO: 'repo'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new GitHubAdapter(mockEnv);
  });

  describe('getBookmarkFile', () => {
    it('should fetch and parse JSONL file', async () => {
      const mockContent = Buffer.from('{"id":"1"}\n{"id":"2"}').toString('base64');
      mockGetContent.mockResolvedValue({
        data: {
          content: mockContent,
          sha: 'abc-123'
        }
      });

      const result = await adapter.getBookmarkFile();
      
      expect(result.bookmarks).toHaveLength(2);
      expect(result.bookmarks[0].id).toBe('1');
      expect(result.sha).toBe('abc-123');
      expect(mockGetContent).toHaveBeenCalledWith({
        owner: 'user',
        repo: 'repo',
        path: 'data/bookmarks.jsonl',
      });
    });

    it('should return empty array if file does not exist (404)', async () => {
      mockGetContent.mockRejectedValue({ status: 404 });
      
      const result = await adapter.getBookmarkFile();
      
      expect(result.bookmarks).toEqual([]);
      expect(result.sha).toBeNull();
    });
  });

  describe('saveBookmark', () => {
    it('should append bookmark and commit', async () => {
      // Mock existing file
      mockGetContent.mockResolvedValue({
        data: {
          content: Buffer.from('{"id":"1"}').toString('base64'),
          sha: 'sha-1'
        }
      });

      // Mock successful update
      mockCreateOrUpdate.mockResolvedValue({ status: 200 });

      const result = await adapter.saveBookmark({
        id: '2',
        title: 'New',
        url: 'https://example.com/new/',
      });

      expect(mockCreateOrUpdate).toHaveBeenCalledWith(expect.objectContaining({
        owner: 'user',
        repo: 'repo',
        path: 'data/bookmarks.jsonl',
        message: 'Add: New',
        sha: 'sha-1',
        // Content should be base64 of line 1 + line 2
      }));
      expect(result).toEqual(expect.objectContaining({ status: 'created' }));
      
      // Verify content decoding
      const callArgs = mockCreateOrUpdate.mock.calls[0][0];
      const decoded = Buffer.from(callArgs.content, 'base64').toString('utf8');
      expect(decoded).toContain('{"id":"1"}');
      expect(decoded).toContain('"id":"2"');
      expect(decoded).toContain('"url":"https://example.com/new/"');
      expect(decoded).toContain('"url_normalized":"https://example.com/new"');
      expect(decoded).toContain('"url_hash":');
    });

    it('should skip duplicates based on normalized URL', async () => {
      mockGetContent.mockResolvedValue({
        data: {
          content: Buffer.from(JSON.stringify({
            id: '1',
            title: 'Existing',
            url: 'https://github.com/michaelwhitford/nucleus',
            url_normalized: 'https://github.com/michaelwhitford/nucleus',
            url_hash: 'existing-hash',
          })).toString('base64'),
          sha: 'sha-1'
        }
      });

      const result = await adapter.saveBookmark({
        id: '2',
        title: 'Duplicate',
        url: 'https://github.com/michaelwhitford/nucleus/',
      });

      expect(result).toEqual({
        status: 'duplicate',
        bookmark: expect.objectContaining({
          id: '1',
          url: 'https://github.com/michaelwhitford/nucleus',
        }),
      });
      expect(mockCreateOrUpdate).not.toHaveBeenCalled();
    });

    it('should retry on 409 Conflict', async () => {
      // First read: sha-1
      mockGetContent.mockResolvedValueOnce({
        data: { content: Buffer.from('[]').toString('base64'), sha: 'sha-1' }
      });

      // First write: Fail with 409
      mockCreateOrUpdate.mockRejectedValueOnce({ status: 409 });

      // Second read (during retry): sha-2
      mockGetContent.mockResolvedValueOnce({
        data: { content: Buffer.from('[]').toString('base64'), sha: 'sha-2' }
      });

      // Second write: Success
      mockCreateOrUpdate.mockResolvedValueOnce({ status: 200 });

      await adapter.saveBookmark({ id: '1', title: 'Retry', url: 'https://example.com/retry' });

      expect(mockCreateOrUpdate).toHaveBeenCalledTimes(2);
      expect(mockGetContent).toHaveBeenCalledTimes(2);
      // Verify second attempt used new sha
      expect(mockCreateOrUpdate.mock.calls[1][0].sha).toBe('sha-2');
    });
  });
});
