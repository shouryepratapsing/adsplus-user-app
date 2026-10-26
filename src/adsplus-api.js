const TOKEN_KEY = 'adsplus.accessToken';
let cachedConfig;

export async function readApiConfig(force = false) {
  if (cachedConfig && !force) return cachedConfig;
  try {
    const response = await fetch(`/adsplus-config.json${force ? `?t=${Date.now()}` : ''}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Config request failed (${response.status})`);
    const config = await response.json();
    cachedConfig = { apiBaseUrl: String(config.apiBaseUrl || '').trim().replace(/\/+$/, '') };
  } catch {
    cachedConfig = { apiBaseUrl: '' };
  }
  return cachedConfig;
}

export function getAccessToken() {
  try { return window.localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
}

export function clearAccessToken() {
  try { window.localStorage.removeItem(TOKEN_KEY); } catch { /* storage may be unavailable */ }
  try { window.dispatchEvent(new Event('adsplus:logged-out')); } catch { /* event support may be unavailable */ }
}

export async function apiRequest(path, { method = 'GET', body, signal } = {}) {
  const { apiBaseUrl } = await readApiConfig();
  if (!apiBaseUrl) throw new Error('Backend URL is not set. Configure public/adsplus-config.json first.');
  const headers = { Accept: 'application/json' };
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
      mode: 'cors',
      credentials: 'omit',
    });
  } catch {
    throw new Error('Ads+ backend could not be reached. Check the server URL, internet and CORS settings.');
  }
  const raw = await response.text();
  let payload = {};
  try { payload = raw ? JSON.parse(raw) : {}; } catch { payload = { message: raw }; }
  if (!response.ok) {
    if (response.status === 401) clearAccessToken();
    const message = payload?.message || payload?.error || `Ads+ service returned ${response.status}`;
    throw new Error(String(message));
  }
  return payload;
}

export async function startEmailSignIn(email) {
  return apiRequest('/api/v1/auth/email/start', { method: 'POST', body: { email } });
}

export async function verifyEmailSignIn(email, code) {
  const result = await apiRequest('/api/v1/auth/email/verify', {
    method: 'POST',
    body: { email, code },
  });
  const token = result?.access_token || result?.accessToken || result?.token;
  if (!token) throw new Error('The server did not return an access token. Check the email-login API contract.');
  try { window.localStorage.setItem(TOKEN_KEY, token); } catch {
    throw new Error('This browser could not save your sign-in session.');
  }
  return result;
}

export function formatINRFromPaise(value) {
  if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(Number(value) / 100);
}

export function formatDateTime(value) {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(date);
}
