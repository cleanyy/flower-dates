import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { formatPhoneDisplay, getOccasionEmoji } from '../utils.js';

const FILTER_LABELS = {
  today: { text: 'Сегодня', emoji: '🔴' },
  week:  { text: 'На этой неделе', emoji: '🟡' },
  month: { text: 'В ближайшие 30 дней', emoji: '📅' },
  vip:   { text: 'VIP клиенты', emoji: '⭐' },
};

export default function Clients() {
  const [searchParams] = useSearchParams();
  const filter = searchParams.get('filter') || '';
  const [clients, setClients] = useState([]);
  const [search,  setSearch]  = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api.getClients(search, filter)
      .then(setClients)
      .finally(() => setLoading(false));
  }, [search, filter]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const filterInfo = filter ? FILTER_LABELS[filter] : null;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Клиенты</h1>
        <Link
          to="/clients/new"
          className="px-4 py-2 bg-rose-500 text-white rounded-xl text-sm font-medium hover:bg-rose-600 transition-colors shadow-sm"
        >
          + Добавить клиента
        </Link>
      </div>

      {/* Active filter banner */}
      {filterInfo && (
        <div className="flex items-center justify-between mb-4 px-4 py-2.5 bg-rose-50 border border-rose-200 rounded-xl text-sm">
          <span className="text-rose-700 font-medium">{filterInfo.emoji} {filterInfo.text}</span>
          <Link to="/clients" className="text-rose-400 hover:text-rose-600 text-xs font-medium">
            Сбросить ✕
          </Link>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-5">
        <span className="absolute left-3.5 top-3.5 text-gray-400 text-lg select-none">🔍</span>
        <input
          type="text"
          placeholder="Поиск по имени или телефону..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl bg-white focus:outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 text-sm"
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400 animate-pulse">Загрузка...</div>
      ) : clients.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <div className="text-5xl mb-4">👥</div>
          <p className="text-lg font-medium">
            {search ? 'Клиенты не найдены' : 'Список клиентов пуст'}
          </p>
          {!search && (
            <Link
              to="/clients/new"
              className="inline-block mt-5 px-6 py-2.5 bg-rose-500 text-white rounded-xl text-sm font-medium hover:bg-rose-600 transition-colors"
            >
              + Добавить первого клиента
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {clients.map(c => (
            <ClientCard key={c.id} client={c} />
          ))}
          <p className="text-center text-xs text-gray-400 pt-2">
            {clients.length} {pluralClients(clients.length)}
          </p>
        </div>
      )}
    </div>
  );
}

function ClientCard({ client: c }) {
  return (
    <Link
      to={`/clients/${c.id}`}
      className="flex items-center gap-4 bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:shadow-md hover:border-rose-200 transition-all group"
    >
      {/* Avatar */}
      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center text-white font-bold text-xl shrink-0 shadow">
        {(c.name || '?')[0].toUpperCase()}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-800 truncate">{c.name}</span>
          {c.is_vip ? (
            <span className="shrink-0 text-xs bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full font-medium">
              ⭐ VIP
            </span>
          ) : null}
        </div>
        <p className="text-gray-500 text-sm">{formatPhoneDisplay(c.phone)}</p>
        <p className="text-xs text-gray-400 mt-0.5">
          {c.dates_count} {pluralDates(c.dates_count)}
          {' · '}
          Скидка <span className="text-rose-500 font-medium">{c.discount_percent}%</span>
        </p>
      </div>

      <span className="text-gray-300 group-hover:text-rose-400 text-xl transition-colors">›</span>
    </Link>
  );
}

function pluralClients(n) {
  if (n % 10 === 1 && n % 100 !== 11) return 'клиент';
  if ([2,3,4].includes(n % 10) && ![12,13,14].includes(n % 100)) return 'клиента';
  return 'клиентов';
}

function pluralDates(n) {
  if (n % 10 === 1 && n % 100 !== 11) return 'памятная дата';
  if ([2,3,4].includes(n % 10) && ![12,13,14].includes(n % 100)) return 'памятных даты';
  return 'памятных дат';
}
