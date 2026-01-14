import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitHubAdapter } from '../src/github.js';

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

      const newBookmark = { id: '2', title: 'New' };
      await adapter.saveBookmark(newBookmark);

      expect(mockCreateOrUpdate).toHaveBeenCalledWith(expect.objectContaining({
        owner: 'user',
        repo: 'repo',
        path: 'data/bookmarks.jsonl',
        message: 'Add: New',
        sha: 'sha-1',
        // Content should be base64 of line 1 + line 2
      }));
      
      // Verify content decoding
      const callArgs = mockCreateOrUpdate.mock.calls[0][0];
      const decoded = Buffer.from(callArgs.content, 'base64').toString('utf8');
      expect(decoded).toContain('{"id":"1"}');
      expect(decoded).toContain('{"id":"2","title":"New"}');
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

      await adapter.saveBookmark({ id: '1', title: 'Retry' });

      expect(mockCreateOrUpdate).toHaveBeenCalledTimes(2);
      expect(mockGetContent).toHaveBeenCalledTimes(2);
      // Verify second attempt used new sha
      expect(mockCreateOrUpdate.mock.calls[1][0].sha).toBe('sha-2');
    });
  });
});
