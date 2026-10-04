/**
 * Media & Avatar URL Resolution Utility
 *
 * Derives the backend origin from VITE_API_URL and resolves relative media paths
 * (e.g. "/uploads/avatars/...") to fully-qualified URLs pointing to the backend origin.
 */

export function getOriginFromApiUrl(apiUrl?: string): string {
  const raw =
    apiUrl ||
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) ||
    'http://localhost:5000/api/v1';

  try {
    return new URL(raw, 'http://localhost:5000').origin;
  } catch {
    return '';
  }
}

const DEFAULT_BACKEND_ORIGIN = getOriginFromApiUrl();

/**
 * Resolves a media or avatar URL against the backend origin.
 *
 * Rules:
 * 1. Falsy input (null, undefined, empty string): returned unchanged.
 * 2. Absolute URL ("http://", "https://"): returned unchanged.
 * 3. Protocol-relative ("//...") or data/blob URI ("data:", "blob:"): returned unchanged.
 * 4. Path with leading slash ("/uploads/..."): resolved as origin + path.
 * 5. Path without leading slash ("uploads/..."): prefixed with "/" and resolved as origin + path.
 */
export function resolveMediaUrl(
  url?: string | null,
  backendOrigin: string = DEFAULT_BACKEND_ORIGIN
): string | null | undefined {
  if (!url) {
    return url;
  }

  // Preserve absolute HTTP/HTTPS URLs
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  // Preserve protocol-relative, data, or blob URLs (e.g. client-side upload previews)
  if (url.startsWith('//') || url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }

  const origin = backendOrigin || DEFAULT_BACKEND_ORIGIN;
  const normalizedPath = url.startsWith('/') ? url : `/${url}`;

  return origin ? `${origin}${normalizedPath}` : normalizedPath;
}
