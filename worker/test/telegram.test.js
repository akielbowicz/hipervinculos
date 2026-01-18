import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  verifyWebhookSignature,
  handleUpdate,
  extractUrl,
  sendMessage,
} from '../src/telegram.js';

// Mock dependencies
vi.mock('../src/metadata.js', () => ({
  fetchMetadata: vi.fn(),
}));

vi.mock('../src/github.js', () => ({
  GitHubAdapter: vi.fn().mockImplementation(() => ({
    saveBookmark: vi.fn(),
  })),
}));

// Mock global fetch for sendMessage
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock crypto.randomUUID
vi.stubGlobal('crypto', {
  randomUUID: vi.fn(() => 'test-uuid-1234'),
});

import { fetchMetadata } from '../src/metadata.js';
import { GitHubAdapter } from '../src/github.js';

describe('verifyWebhookSignature', () => {
  it('should return true for valid signature', () => {
    const request = {
      headers: {
        get: (name) => name === 'X-Telegram-Bot-Api-Secret-Token' ? 'my-secret' : null,
      },
    };
    expect(verifyWebhookSignature(request, 'my-secret')).toBe(true);
  });

  it('should return false for invalid signature', () => {
    const request = {
      headers: {
        get: (name) => name === 'X-Telegram-Bot-Api-Secret-Token' ? 'wrong-secret' : null,
      },
    };
    expect(verifyWebhookSignature(request, 'my-secret')).toBe(false);
  });

  it('should return false for missing signature', () => {
    const request = {
      headers: {
        get: () => null,
      },
    };
    expect(verifyWebhookSignature(request, 'my-secret')).toBe(false);
  });
});

describe('extractUrl', () => {
  it('should extract URL from text', () => {
    const text = 'Check out https://example.com/page please';
    expect(extractUrl(text)).toBe('https://example.com/page');
  });

  it('should extract first URL when multiple present', () => {
    const text = 'First https://first.com and second https://second.com';
    expect(extractUrl(text)).toBe('https://first.com');
  });

  it('should extract http URLs', () => {
    const text = 'Link: http://example.com/path';
    expect(extractUrl(text)).toBe('http://example.com/path');
  });

  it('should return null for text without URL', () => {
    const text = 'No links here, just text';
    expect(extractUrl(text)).toBeNull();
  });

  it('should return null for empty text', () => {
    expect(extractUrl('')).toBeNull();
    expect(extractUrl(null)).toBeNull();
    expect(extractUrl(undefined)).toBeNull();
  });

  it('should handle URLs with query strings and fragments', () => {
    const text = 'Link: https://example.com/path?foo=bar&baz=qux#section';
    expect(extractUrl(text)).toBe('https://example.com/path?foo=bar&baz=qux#section');
  });
});

describe('sendMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call Telegram API with correct parameters', async () => {
    mockFetch.mockResolvedValue({ ok: true });
    const env = { TELEGRAM_BOT_TOKEN: 'bot-token-123' };

    await sendMessage(12345, 'Hello!', env);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.telegram.org/botbot-token-123/sendMessage',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: 12345,
          text: 'Hello!',
        }),
      })
    );
  });
});

describe('handleUpdate', () => {
  let mockEnv;
  let mockKV;
  let mockGitHubAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: true });

    mockKV = {
      put: vi.fn(),
      get: vi.fn(),
      delete: vi.fn(),
    };

    mockGitHubAdapter = {
      saveBookmark: vi.fn(),
    };
    GitHubAdapter.mockImplementation(() => mockGitHubAdapter);

    mockEnv = {
      TELEGRAM_BOT_TOKEN: 'test-token',
      GITHUB_TOKEN: 'gh-token',
      GITHUB_OWNER: 'owner',
      GITHUB_REPO: 'repo',
      RETRY_QUEUE: mockKV,
    };
  });

  it('should respond to /start command with welcome message', async () => {
    const update = {
      message: {
        chat: { id: 123 },
        text: '/start',
      },
    };

    await handleUpdate(update, mockEnv);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/sendMessage'),
      expect.objectContaining({
        body: expect.stringContaining('Welcome'),
      })
    );
  });

  it('should extract URL and save bookmark from message', async () => {
    fetchMetadata.mockResolvedValue({
      title: 'Test Page',
      description: 'A test description',
      image: 'https://example.com/img.jpg',
      url: 'https://example.com/page',
    });
    mockGitHubAdapter.saveBookmark.mockResolvedValue();

    const update = {
      message: {
        chat: { id: 123 },
        text: 'Save this https://example.com/page',
      },
    };

    await handleUpdate(update, mockEnv);

    expect(fetchMetadata).toHaveBeenCalledWith('https://example.com/page');
    expect(mockGitHubAdapter.saveBookmark).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'test-uuid-1234',
        url: 'https://example.com/page',
        title: 'Test Page',
        description: 'A test description',
        image: 'https://example.com/img.jpg',
        source: 'telegram',
        chat_id: 123,
      })
    );
    // Should send success response
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/sendMessage'),
      expect.objectContaining({
        body: expect.stringContaining('✅'),
      })
    );
  });

  it('should extract URL from photo caption', async () => {
    fetchMetadata.mockResolvedValue({
      title: 'Captioned Page',
      url: 'https://example.com/captioned',
    });
    mockGitHubAdapter.saveBookmark.mockResolvedValue();

    const update = {
      message: {
        chat: { id: 456 },
        photo: [{ file_id: 'photo123' }],
        caption: 'Check this out https://example.com/captioned',
      },
    };

    await handleUpdate(update, mockEnv);

    expect(fetchMetadata).toHaveBeenCalledWith('https://example.com/captioned');
    expect(mockGitHubAdapter.saveBookmark).toHaveBeenCalled();
  });

  it('should respond with help for unknown commands', async () => {
    const update = {
      message: {
        chat: { id: 123 },
        text: '/unknown',
      },
    };

    await handleUpdate(update, mockEnv);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/sendMessage'),
      expect.objectContaining({
        body: expect.stringMatching(/help|usage|commands/i),
      })
    );
  });

  it('should ignore non-URL text messages gracefully', async () => {
    const update = {
      message: {
        chat: { id: 123 },
        text: 'Just some random text without links',
      },
    };

    await handleUpdate(update, mockEnv);

    // Should not try to fetch metadata or save
    expect(fetchMetadata).not.toHaveBeenCalled();
    expect(mockGitHubAdapter.saveBookmark).not.toHaveBeenCalled();
  });

  it('should queue to KV and reply with ⏳ on GitHub failure', async () => {
    fetchMetadata.mockResolvedValue({
      title: 'Test',
      url: 'https://example.com/fail',
    });
    mockGitHubAdapter.saveBookmark.mockRejectedValue(new Error('GitHub API error'));

    const update = {
      message: {
        chat: { id: 123 },
        text: 'https://example.com/fail',
      },
    };

    await handleUpdate(update, mockEnv);

    // Should queue to KV
    expect(mockKV.put).toHaveBeenCalledWith(
      expect.stringMatching(/^retry:/),
      expect.any(String)
    );
    // Should reply with queued message
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/sendMessage'),
      expect.objectContaining({
        body: expect.stringContaining('⏳'),
      })
    );
  });
});
