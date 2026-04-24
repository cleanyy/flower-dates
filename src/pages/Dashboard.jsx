import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import {
  MONTHS_FULL,
  getOccasionEmoji,
  getWhatsAppLink,
  getTelegramLink,
  getMaxContactLink,
  getMaxShareLink,
  formatPhoneDisplay,
  daysLabel,
  daysColorClass,
  daysCardBorder,
} from '../utils.js';

const TODAY = new Date();
const TODAY_STR = `${TODAY.getDate()} ${MONTHS_FULL[TODAY.getMonth() + 1]} ${TODAY.getFullYear()}`;

const FILTERS = [
  { label: '7 дней',  value: 7  },
  { label: '14 дней', value: 14 },
  { label: '30 дней', value: 30 },
  { label: '60 дней', value: 60 },
];

export default function Dashboard() {
  const [dates,    setDates]    = useState([]);
  const [stats,    setStats]    = useState(null);
  const [settings, setSettings] = useState({});
  const [filter,   setFilter]   = useState(30);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getDashboard(filter),
      api.getStats(),
      api.getSettings(),
    ]).then(([d, s, cfg]) => {
      setDates(d);
      setStats(s);
      setSettings(cfg);
    }).finally(() => setLoading(false));
  }, [filter]);

  function buildMessage(d) {
    const tpl = settings.message_template || '';
    return tpl
      .replace('{client_name}', d.client_name)
      .replace('{occasion}',    d.occasion)
      .replace('{date}',        `${d.day} ${MONTHS_FULL[d.month]}`)
      .replace('{discount}',    d.discount_percent)
      .replace('{phone}',       settings.store_phone || '');
  }

  if (loading) return <Loader />;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Главная</h1>
        <p className="text-gray-500 text-sm mt-0.5">{TODAY_STR}</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <StatCard emoji="🔴" label="Сегодня"      value={stats.today}        accent="rose"   to="/clients?filter=today" />
          <StatCard emoji="🟡" label="На неделе"    value={stats.week}         accent="amber"  to="/clients?filter=week" />
          <StatCard emoji="📅" label="За 30 дней"   value={stats.month}        accent="blue"   to="/clients?filter=month" />
          <StatCard emoji="⭐" label="VIP клиентов" value={stats.vipClients}   accent="violet" to="/clients?filter=vip" />
        </div>
      )}

      {/* Filter + title */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-800">Ближайшие даты</h2>
        <div className="flex gap-1.5">
          {FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                filter === f.value
                  ? 'bg-rose-500 text-white shadow-sm'
                  : 'bg-white text-gray-500 border border-gray-200 hover:border-rose-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Dates */}
      {dates.length === 0 ? (
        <Empty />
      ) : (
        <div className="space-y-3">
          {groupByClient(dates).map(({ client, dates: clientDates }) => (
            <ClientCard
              key={client.client_id}
              client={client}
              dates={clientDates}
              buildMessage={buildMessage}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ emoji, label, value, accent, to }) {
  const colors = {
    rose:   'border-rose-200   bg-rose-50   text-rose-600',
    amber:  'border-amber-200  bg-amber-50  text-amber-600',
    blue:   'border-blue-200   bg-blue-50   text-blue-600',
    violet: 'border-violet-200 bg-violet-50 text-violet-600',
  };
  const inner = (
    <>
      <div className="text-2xl mb-1">{emoji}</div>
      <div className="text-2xl font-bold text-gray-800">{value ?? '—'}</div>
      <div className="text-xs font-medium mt-0.5">{label}</div>
    </>
  );
  if (to) {
    return (
      <Link to={to} className={`block rounded-2xl border p-4 ${colors[accent]} hover:shadow-md hover:scale-[1.02] transition-all`}>
        {inner}
      </Link>
    );
  }
  return <div className={`rounded-2xl border p-4 ${colors[accent]}`}>{inner}</div>;
}

function groupByClient(dates) {
  const map = new Map();
  for (const d of dates) {
    if (!map.has(d.client_id)) {
      map.set(d.client_id, {
        client: {
          client_id: d.client_id,
          client_name: d.client_name,
          phone: d.phone,
          telegram_username: d.telegram_username,
          max_username: d.max_username,
          discount_percent: d.discount_percent,
          is_vip: d.is_vip,
        },
        dates: [],
      });
    }
    map.get(d.client_id).dates.push(d);
  }
  return Array.from(map.values());
}

function ClientCard({ client, dates, buildMessage }) {
  const tgLink  = getTelegramLink(client.telegram_username);
  const maxLink = getMaxContactLink(client.max_username);
  const earliest = dates[0];

  return (
    <div className={`rounded-2xl border p-4 shadow-sm hover:shadow-md transition-shadow ${daysCardBorder(earliest.days_until)}`}>
      {/* Client header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-3">
        <div className="min-w-0">
          <Link
            to={`/clients/${client.client_id}`}
            className="font-semibold text-rose-500 hover:text-rose-700 text-sm leading-tight"
          >
            {client.client_name}
          </Link>
          <p className="text-gray-500 text-xs mt-0.5">
            {formatPhoneDisplay(client.phone)}
            {client.is_vip ? ' · ⭐ VIP' : ''}
            {' · Скидка '}
            <span className="font-semibold text-rose-500">{client.discount_percent}%</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 shrink-0">
          <a
            href={`tel:${client.phone}`}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-medium hover:bg-blue-100 transition-colors"
          >
            📞 Позвонить
          </a>
          {tgLink && (
            <a
              href={tgLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-50 text-sky-700 text-xs font-medium hover:bg-sky-100 transition-colors"
            >
              ✈️ Telegram
            </a>
          )}
          {maxLink && (
            <a
              href={maxLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-violet-50 text-violet-700 text-xs font-medium hover:bg-violet-100 transition-colors"
            >
              💬 Max
            </a>
          )}
        </div>
      </div>

      {/* Dates list */}
      <div className="space-y-0 divide-y divide-black/5">
        {dates.map(d => (
          <DateRow key={d.id} date={d} message={buildMessage(d)} phone={client.phone} />
        ))}
      </div>
    </div>
  );
}

function DateRow({ date: d, message, phone }) {
  const emoji   = getOccasionEmoji(d.occasion);
  const waLink  = getWhatsAppLink(phone, message);
  const maxLink = getMaxShareLink(message);

  return (
    <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between py-2.5">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="text-xl leading-none">{emoji}</span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-800 leading-tight">{d.occasion}</p>
          <p className="text-xs text-gray-500">{d.day} {MONTHS_FULL[d.month]}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end shrink-0">
        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${daysColorClass(d.days_until)}`}>
          {daysLabel(d.days_until)}
        </span>
        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs font-medium hover:bg-green-100 transition-colors"
        >
          💬 WhatsApp
        </a>
        <a
          href={maxLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-violet-50 text-violet-700 text-xs font-medium hover:bg-violet-100 transition-colors"
        >
          💬 Max
        </a>
        <a
          href={`sms:${phone}?body=${encodeURIComponent(message)}`}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-purple-50 text-purple-700 text-xs font-medium hover:bg-purple-100 transition-colors"
        >
          ✉️ СМС
        </a>
      </div>
    </div>
  );
}

function Empty() {
  return (
    <div className="text-center py-20 text-gray-400">
      <div className="text-5xl mb-4">🌸</div>
      <p className="text-lg font-medium">Нет ближайших дат</p>
      <p className="text-sm mt-1">Добавьте клиентов и укажите их памятные даты</p>
      <Link
        to="/clients/new"
        className="inline-block mt-5 px-6 py-2.5 bg-rose-500 text-white rounded-xl text-sm font-medium hover:bg-rose-600 transition-colors shadow"
      >
        + Добавить клиента
      </Link>
    </div>
  );
}

function Loader() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-rose-400 text-lg animate-pulse">Загрузка...</div>
    </div>
  );
}
