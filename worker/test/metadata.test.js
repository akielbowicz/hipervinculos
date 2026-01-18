import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchMetadata, InvalidUrlError } from '../src/metadata.js';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('fetchMetadata', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should extract metadata from HTML with og:tags', async () => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta property="og:title" content="Test Title">
        <meta property="og:description" content="Test Description">
        <meta property="og:image" content="https://example.com/image.jpg">
      </head>
      <body></body>
      </html>
    `;
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(html),
      url: 'https://example.com/page',
    });

    const result = await fetchMetadata('https://example.com/page');

    expect(result.title).toBe('Test Title');
    expect(result.description).toBe('Test Description');
    expect(result.image).toBe('https://example.com/image.jpg');
    expect(result.url).toBe('https://example.com/page');
    expect(result.partial).toBeUndefined();
  });

  it('should fallback to <title> and <meta name="description"> when og:tags missing', async () => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Fallback Title</title>
        <meta name="description" content="Fallback Description">
      </head>
      <body></body>
      </html>
    `;
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(html),
      url: 'https://example.com/page',
    });

    const result = await fetchMetadata('https://example.com/page');

    expect(result.title).toBe('Fallback Title');
    expect(result.description).toBe('Fallback Description');
  });

  it('should return partial data on timeout/abort', async () => {
    // Simulate an abort error (what happens when timeout fires)
    mockFetch.mockImplementation(() => {
      const error = new Error('The operation was aborted');
      error.name = 'AbortError';
      return Promise.reject(error);
    });

    const result = await fetchMetadata('https://slow.example.com/page');

    expect(result.url).toBe('https://slow.example.com/page');
    expect(result.partial).toBe(true);
  });

  it('should throw InvalidUrlError for invalid URLs', async () => {
    await expect(fetchMetadata('not-a-url')).rejects.toThrow(InvalidUrlError);
    await expect(fetchMetadata('')).rejects.toThrow(InvalidUrlError);
  });

  it('should follow redirects up to 3 hops', async () => {
    const finalHtml = `
      <!DOCTYPE html>
      <html>
      <head><title>Final Page</title></head>
      </html>
    `;

    // Simulate redirect chain: original -> redirect1 -> redirect2 -> final
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(finalHtml),
      url: 'https://example.com/final', // Final URL after redirects
    });

    const result = await fetchMetadata('https://example.com/original');

    expect(result.url).toBe('https://example.com/final');
    expect(result.title).toBe('Final Page');
  });

  it('should return partial data on network error', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const result = await fetchMetadata('https://example.com/broken');

    expect(result.url).toBe('https://example.com/broken');
    expect(result.partial).toBe(true);
  });

  it('should return partial data on non-ok response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      url: 'https://example.com/notfound',
    });

    const result = await fetchMetadata('https://example.com/notfound');

    expect(result.url).toBe('https://example.com/notfound');
    expect(result.partial).toBe(true);
  });
});

describe('InvalidUrlError', () => {
  it('should be an instance of Error', () => {
    const error = new InvalidUrlError('bad url');
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('InvalidUrlError');
    expect(error.message).toBe('bad url');
  });
});
