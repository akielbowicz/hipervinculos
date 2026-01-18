import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleScheduled } from '../src/scheduled.js';

// Mock GitHubAdapter
vi.mock('../src/github.js', () => ({
  GitHubAdapter: vi.fn().mockImplementation(() => ({
    saveBookmark: vi.fn(),
  })),
}));

import { GitHubAdapter } from '../src/github.js';

describe('handleScheduled', () => {
  let mockEnv;
  let mockKV;
  let mockGitHubAdapter;

  beforeEach(() => {
    vi.clearAllMocks();

    mockKV = {
      list: vi.fn(),
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    };

    mockGitHubAdapter = {
      saveBookmark: vi.fn(),
    };
    GitHubAdapter.mockImplementation(() => mockGitHubAdapter);

    mockEnv = {
      GITHUB_TOKEN: 'gh-token',
      GITHUB_OWNER: 'owner',
      GITHUB_REPO: 'repo',
      RETRY_QUEUE: mockKV,
    };
  });

  it('should process retry:* keys from KV', async () => {
    const bookmark = {
      id: 'test-id',
      url: 'https://example.com',
      title: 'Test',
    };
    const retryData = {
      bookmark,
      attempts: 1,
      lastError: 'Previous error',
      createdAt: '2026-01-18T00:00:00Z',
    };

    mockKV.list.mockResolvedValue({
      keys: [{ name: 'retry:test-id' }],
    });
    mockKV.get.mockResolvedValue(JSON.stringify(retryData));
    mockGitHubAdapter.saveBookmark.mockResolvedValue();

    await handleScheduled(mockEnv);

    expect(mockKV.list).toHaveBeenCalledWith({ prefix: 'retry:' });
    expect(mockKV.get).toHaveBeenCalledWith('retry:test-id');
    expect(mockGitHubAdapter.saveBookmark).toHaveBeenCalledWith(bookmark);
  });

  it('should delete KV key on successful retry', async () => {
    const retryData = {
      bookmark: { id: 'success-id', url: 'https://example.com' },
      attempts: 1,
    };

    mockKV.list.mockResolvedValue({
      keys: [{ name: 'retry:success-id' }],
    });
    mockKV.get.mockResolvedValue(JSON.stringify(retryData));
    mockGitHubAdapter.saveBookmark.mockResolvedValue();

    await handleScheduled(mockEnv);

    expect(mockKV.delete).toHaveBeenCalledWith('retry:success-id');
  });

  it('should increment attempt count on failed retry', async () => {
    const retryData = {
      bookmark: { id: 'fail-id', url: 'https://example.com' },
      attempts: 1,
      lastError: 'Old error',
    };

    mockKV.list.mockResolvedValue({
      keys: [{ name: 'retry:fail-id' }],
    });
    mockKV.get.mockResolvedValue(JSON.stringify(retryData));
    mockGitHubAdapter.saveBookmark.mockRejectedValue(new Error('GitHub down'));

    await handleScheduled(mockEnv);

    expect(mockKV.put).toHaveBeenCalledWith(
      'retry:fail-id',
      expect.stringContaining('"attempts":2')
    );
    expect(mockKV.put).toHaveBeenCalledWith(
      'retry:fail-id',
      expect.stringContaining('GitHub down')
    );
  });

  it('should delete key after 3 failed attempts', async () => {
    const retryData = {
      bookmark: { id: 'maxed-id', url: 'https://example.com' },
      attempts: 3,
      lastError: 'Previous error',
    };

    mockKV.list.mockResolvedValue({
      keys: [{ name: 'retry:maxed-id' }],
    });
    mockKV.get.mockResolvedValue(JSON.stringify(retryData));
    mockGitHubAdapter.saveBookmark.mockRejectedValue(new Error('Still failing'));

    await handleScheduled(mockEnv);

    // Should delete, not update with attempt 4
    expect(mockKV.delete).toHaveBeenCalledWith('retry:maxed-id');
    expect(mockKV.put).not.toHaveBeenCalled();
  });

  it('should handle empty KV (no retries pending)', async () => {
    mockKV.list.mockResolvedValue({ keys: [] });

    await handleScheduled(mockEnv);

    expect(mockKV.get).not.toHaveBeenCalled();
    expect(mockGitHubAdapter.saveBookmark).not.toHaveBeenCalled();
  });

  it('should process multiple retry keys', async () => {
    const retryData1 = {
      bookmark: { id: 'id-1', url: 'https://one.com' },
      attempts: 1,
    };
    const retryData2 = {
      bookmark: { id: 'id-2', url: 'https://two.com' },
      attempts: 1,
    };

    mockKV.list.mockResolvedValue({
      keys: [{ name: 'retry:id-1' }, { name: 'retry:id-2' }],
    });
    mockKV.get
      .mockResolvedValueOnce(JSON.stringify(retryData1))
      .mockResolvedValueOnce(JSON.stringify(retryData2));
    mockGitHubAdapter.saveBookmark.mockResolvedValue();

    await handleScheduled(mockEnv);

    expect(mockGitHubAdapter.saveBookmark).toHaveBeenCalledTimes(2);
    expect(mockKV.delete).toHaveBeenCalledTimes(2);
  });

  it('should continue processing if one retry fails', async () => {
    const retryData1 = {
      bookmark: { id: 'fail-id', url: 'https://fail.com' },
      attempts: 1,
    };
    const retryData2 = {
      bookmark: { id: 'success-id', url: 'https://success.com' },
      attempts: 1,
    };

    mockKV.list.mockResolvedValue({
      keys: [{ name: 'retry:fail-id' }, { name: 'retry:success-id' }],
    });
    mockKV.get
      .mockResolvedValueOnce(JSON.stringify(retryData1))
      .mockResolvedValueOnce(JSON.stringify(retryData2));
    mockGitHubAdapter.saveBookmark
      .mockRejectedValueOnce(new Error('First fails'))
      .mockResolvedValueOnce();

    await handleScheduled(mockEnv);

    // Second one should still succeed and be deleted
    expect(mockKV.delete).toHaveBeenCalledWith('retry:success-id');
  });
});
