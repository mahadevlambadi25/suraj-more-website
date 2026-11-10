// Recognises the YouTube / Vimeo links an admin is likely to paste and extracts what the embed needs.
// Pure (no server/client dependencies) so validation, rendering and tests share one rule.

export type ParsedVideo = { provider: 'youtube' | 'vimeo'; id: string; hash?: string };

const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const YT_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com']);
const VIMEO_HOSTS = new Set(['vimeo.com', 'www.vimeo.com', 'player.vimeo.com']);

/**
 * Supported:
 *   YouTube  https://www.youtube.com/watch?v=ID · https://youtu.be/ID · /embed/ID · /shorts/ID · /live/ID
 *   Vimeo    https://vimeo.com/123456789 · https://vimeo.com/123456789/abcdef1234 (unlisted)
 *            https://player.vimeo.com/video/123456789?h=abcdef1234 · https://vimeo.com/channels/x/123456789
 * Returns null for anything else (other sites, playlists/channels without a video, malformed links).
 */
export function parseVideoUrl(input: string): ParsedVideo | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split('/').filter(Boolean);

  if (host === 'youtu.be') {
    return parts[0] && YT_ID.test(parts[0]) ? { provider: 'youtube', id: parts[0] } : null;
  }
  if (YT_HOSTS.has(host)) {
    const id = parts[0] === 'watch' || parts.length === 0 ? url.searchParams.get('v') : ['embed', 'shorts', 'live', 'v'].includes(parts[0]) ? parts[1] : null;
    return id && YT_ID.test(id) ? { provider: 'youtube', id } : null;
  }
  if (VIMEO_HOSTS.has(host)) {
    // player.vimeo.com/video/ID?h=HASH  |  vimeo.com/ID[/HASH]  |  vimeo.com/channels|groups/x/(videos/)ID
    const idx = host === 'player.vimeo.com' ? (parts[0] === 'video' ? 1 : -1) : parts.findIndex((p) => /^\d{6,12}$/.test(p));
    const id = idx >= 0 ? parts[idx] : undefined;
    if (!id || !/^\d{6,12}$/.test(id)) return null;
    const hash = url.searchParams.get('h') ?? (host !== 'player.vimeo.com' && /^[0-9a-f]{6,20}$/i.test(parts[idx + 1] ?? '') ? parts[idx + 1] : undefined);
    return { provider: 'vimeo', id, ...(hash && /^[0-9a-f]{6,20}$/i.test(hash) ? { hash } : {}) };
  }
  return null;
}
