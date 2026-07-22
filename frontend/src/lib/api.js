/**
 * Central API client.
 * All requests go through here so auth headers are attached
 * consistently and 401 responses are handled in one place.
 */

const BASE_URL = '/api';

function getToken() {
  return localStorage.getItem('token');
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401 && !path.includes('/auth/login')) {
    // Token expired or invalid — clear storage and redirect to login
    localStorage.removeItem('token');
    localStorage.removeItem('auth');
    window.location.href = '/login';
    return new Promise(() => {}); // Halt execution so calling code doesn't crash on undefined
  }

  if (res.status === 403) {
    window.dispatchEvent(new Event('auth:refresh'));
  }

  const data = await res.json();

  if (!res.ok) {
    const err = new Error(data.error || 'Request failed');
    err.status = res.status;
    throw err;
  }

  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path, body) => request(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: (path, body) => request(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (path) => request(path, { method: 'DELETE' }),
};
