const BASE = '/api';

async function request(url, opts = {}) {
  const res = await fetch(BASE + url, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка запроса');
  return data;
}

export const api = {
  getDashboard:      (days = 30) => request(`/dashboard?days=${days}`),
  getStats:          ()          => request('/stats'),

  getClients: (search = '', filter = '') => {
    const p = new URLSearchParams();
    if (search) p.set('search', search);
    if (filter) p.set('filter', filter);
    const qs = p.toString();
    return request(`/clients${qs ? `?${qs}` : ''}`);
  },
  getClient:         (id)          => request(`/clients/${id}`),
  createClient:      (data)        => request('/clients',    { method: 'POST',   body: JSON.stringify(data) }),
  updateClient:      (id, data)    => request(`/clients/${id}`, { method: 'PUT',  body: JSON.stringify(data) }),
  deleteClient:      (id)          => request(`/clients/${id}`, { method: 'DELETE' }),

  addDate:           (clientId, data) => request(`/clients/${clientId}/dates`, { method: 'POST', body: JSON.stringify(data) }),
  updateDate:        (id, data)       => request(`/dates/${id}`, { method: 'PUT',    body: JSON.stringify(data) }),
  deleteDate:        (id)             => request(`/dates/${id}`, { method: 'DELETE' }),

  getSettings:       ()     => request('/settings'),
  updateSettings:    (data) => request('/settings', { method: 'PUT', body: JSON.stringify(data) }),

  getNotifications:  ()     => request('/notifications'),
  testNotification:  ()     => request('/test-notification', { method: 'POST' }),
  runScheduler:      ()     => request('/run-scheduler',     { method: 'POST' }),
};
