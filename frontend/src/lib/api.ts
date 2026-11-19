export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  const lsToken = localStorage.getItem('mailr_token');
  if (lsToken) return lsToken;
  try {
    const match = document.cookie.match(/(?:^|;\s*)mailr_token=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

export function setAuthToken(token: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('mailr_token', token);
    try {
      document.cookie = `mailr_token=${encodeURIComponent(token)}; path=/; max-age=604800; SameSite=Lax`;
    } catch {}
  }
}

export function removeAuthToken() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('mailr_token');
    localStorage.removeItem('mailr_user');
    try {
      document.cookie = 'mailr_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
    } catch {}
  }
}

export async function apiFetch<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Normalize endpoint so callers passing either "/api/path" or "/path" work seamlessly
  const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/+$/, '');
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const finalPath = cleanEndpoint.startsWith('/api/') ? cleanEndpoint.substring(4) : cleanEndpoint;
  const fullUrl = `${baseUrl}${finalPath}`;

  const res = await fetch(fullUrl, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || data.message || `Request failed with status ${res.status}`);
  }

  return data as T;
}
