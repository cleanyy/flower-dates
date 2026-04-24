import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api.js';
import {
  MONTHS_FULL,
  MONTHS_NAMES,
  OCCASION_PRESETS,
  getOccasionEmoji,
  getWhatsAppLink,
  getTelegramLink,
  getMaxContactLink,
  getMaxShareLink,
  formatMaxContact,
  formatPhoneDisplay,
  daysLabel,
  daysColorClass,
} from '../utils.js';

const DAYS   = Array.from({ length: 31 }, (_, i) => i + 1);
const MONTHS = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: MONTHS_NAMES[i + 1] }));

function daysUntil(day, month) {
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const y     = now.getFullYear();
  const cand  = new Date(y, month - 1, day);
  const next  = cand >= today ? cand : new Date(y + 1, month - 1, day);
  return Math.round((next - today) / 86400000);
}

const EMPTY_DATE = { occasion: '', day: 1, month: 1, notify_days_before: 3 };
const EMPTY_CLIENT = { name: '', phone: '', telegram_username: '', max_username: '', discount_percent: 10, is_vip: false, notes: '' };

export default function ClientDetail({ isNew = false }) {
  const { id }    = useParams();
  const navigate  = useNavigate();

  const [client,   setClient]   = useState(EMPTY_CLIENT);
  const [dates,    setDates]    = useState([]);
  const [settings, setSettings] = useState({});
  const [editing,  setEditing]  = useState(isNew);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(!isNew);

  // Date form state
  const [showAddDate, setShowAddDate] = useState(false);
  const [newDate,     setNewDate]     = useState(EMPTY_DATE);
  const [editDateId,  setEditDateId]  = useState(null);
  const [editDateVal, setEditDateVal] = useState(EMPTY_DATE);

  useEffect(() => {
    if (isNew) return;
    setLoading(true);
    Promise.all([api.getClient(id), api.getSettings()])
      .then(([c, s]) => {
        const { dates: d, ...rest } = c;
        setClient({ ...rest, is_vip: Boolean(rest.is_vip) });
        setDates(d);
        setSettings(s);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  useEffect(() => {
    if (isNew) {
      api.getSettings().then(setSettings);
    }
  }, [isNew]);

  // ── Save client ──────────────────────────────────────────────────────────

  async function saveClient(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = {
        ...client,
        discount_percent: Number(client.discount_percent) || 10,
        is_vip: Boolean(client.is_vip),
      };
      if (isNew) {
        const created = await api.createClient(payload);
        navigate(`/clients/${created.id}`, { replace: true });
      } else {
        const updated = await api.updateClient(id, payload);
        const { dates: d, ...rest } = updated;
        setClient({ ...rest, is_vip: Boolean(rest.is_vip) });
        setDates(d);
        setEditing(false);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  // ── Delete client ────────────────────────────────────────────────────────

  async function deleteClient() {
    if (!confirm(`Удалить клиента "${client.name}"? Все даты также будут удалены.`)) return;
    await api.deleteClient(id);
    navigate('/clients', { replace: true });
  }

  // ── Add memorable date ────────────────────────────────────────────────────

  async function addDate(e) {
    e.preventDefault();
    setError('');
    try {
      const created = await api.addDate(id, {
        ...newDate,
        day: Number(newDate.day),
        month: Number(newDate.month),
        notify_days_before: Number(newDate.notify_days_before),
      });
      setDates(prev => [...prev, created]);
      setNewDate(EMPTY_DATE);
      setShowAddDate(false);
      // Refresh to get updated is_vip status
      api.getClient(id).then(c => {
        setClient(prev => ({ ...prev, is_vip: Boolean(c.is_vip) }));
      });
    } catch (e) {
      setError(e.message);
    }
  }

  // ── Edit memorable date ───────────────────────────────────────────────────

  function startEditDate(d) {
    setEditDateId(d.id);
    setEditDateVal({
      occasion: d.occasion,
      day: d.day,
      month: d.month,
      notify_days_before: d.notify_days_before,
      is_active: Boolean(d.is_active),
    });
  }

  async function saveDate(e) {
    e.preventDefault();
    try {
      const updated = await api.updateDate(editDateId, {
        ...editDateVal,
        day: Number(editDateVal.day),
        month: Number(editDateVal.month),
        notify_days_before: Number(editDateVal.notify_days_before),
        is_active: editDateVal.is_active ? 1 : 0,
      });
      setDates(prev => prev.map(d => d.id === editDateId ? updated : d));
      setEditDateId(null);
    } catch (e) {
      setError(e.message);
    }
  }

  async function removeDate(dateId) {
    if (!confirm('Удалить эту дату?')) return;
    await api.deleteDate(dateId);
    setDates(prev => prev.filter(d => d.id !== dateId));
  }

  // ── Message builder ───────────────────────────────────────────────────────

  function buildMessage(d) {
    return (settings.message_template || '')
      .replace('{client_name}', client.name)
      .replace('{occasion}',    d.occasion)
      .replace('{date}',        `${d.day} ${MONTHS_FULL[d.month]}`)
      .replace('{discount}',    client.discount_percent)
      .replace('{phone}',       settings.store_phone || '');
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-rose-400 animate-pulse">Загрузка...</div>
    </div>
  );

  const waLink  = getWhatsAppLink(client.phone);
  const tgLink  = getTelegramLink(client.telegram_username);
  const maxLink = getMaxContactLink(client.max_username);

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      {/* Back */}
      <Link to="/clients" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-rose-500 mb-5">
        ← Клиенты
      </Link>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
          {error}
        </div>
      )}

      {/* ── Client card ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-5">
        {editing ? (
          /* Edit / Create form */
          <form onSubmit={saveClient} className="space-y-4">
            <h2 className="text-lg font-bold text-gray-800 mb-4">
              {isNew ? '+ Новый клиент' : 'Редактировать'}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Имя *" required>
                <input
                  type="text"
                  required
                  placeholder="Иван Иванов"
                  value={client.name}
                  onChange={e => setClient(p => ({ ...p, name: e.target.value }))}
                  className={inputCls}
                />
              </Field>
              <Field label="Телефон *" required>
                <input
                  type="tel"
                  required
                  placeholder="+7 999 123-45-67"
                  value={client.phone}
                  onChange={e => setClient(p => ({ ...p, phone: e.target.value }))}
                  className={inputCls}
                />
              </Field>
              <Field label="Telegram (необязательно)">
                <input
                  type="text"
                  placeholder="@username"
                  value={client.telegram_username || ''}
                  onChange={e => setClient(p => ({ ...p, telegram_username: e.target.value }))}
                  className={inputCls}
                />
              </Field>
              <Field label="Max: ссылка или ник (необязательно)">
                <input
                  type="text"
                  placeholder="https://web.max.ru/... или @username"
                  value={client.max_username || ''}
                  onChange={e => setClient(p => ({ ...p, max_username: e.target.value }))}
                  className={inputCls}
                />
              </Field>
              <Field label="Скидка (%)">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={client.discount_percent}
                  onChange={e => setClient(p => ({ ...p, discount_percent: e.target.value }))}
                  className={inputCls}
                />
              </Field>
            </div>

            <Field label="Заметки">
              <textarea
                rows={2}
                placeholder="Дополнительная информация..."
                value={client.notes || ''}
                onChange={e => setClient(p => ({ ...p, notes: e.target.value }))}
                className={inputCls + ' resize-none'}
              />
            </Field>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={Boolean(client.is_vip)}
                onChange={e => setClient(p => ({ ...p, is_vip: e.target.checked }))}
                className="w-4 h-4 accent-rose-500"
              />
              <span className="text-sm text-gray-700">⭐ VIP клиент (скидки, приоритет)</span>
            </label>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 bg-rose-500 text-white rounded-xl text-sm font-medium hover:bg-rose-600 disabled:opacity-50 transition-colors shadow-sm"
              >
                {saving ? 'Сохранение...' : (isNew ? 'Создать клиента' : 'Сохранить')}
              </button>
              {!isNew && (
                <button
                  type="button"
                  onClick={() => { setEditing(false); setError(''); }}
                  className="px-5 py-2 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors"
                >
                  Отмена
                </button>
              )}
            </div>
          </form>
        ) : (
          /* View mode */
          <div>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center text-white text-2xl font-bold shadow">
                  {(client.name || '?')[0].toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-gray-800">{client.name}</h2>
                    {client.is_vip && (
                      <span className="text-xs bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full font-semibold">
                        ⭐ VIP
                      </span>
                    )}
                  </div>
                  <p className="text-gray-500 text-sm">{formatPhoneDisplay(client.phone)}</p>
                  {client.telegram_username && (
                    <p className="text-sky-500 text-xs">@{client.telegram_username}</p>
                  )}
                  {client.max_username && (
                    <p className="text-violet-500 text-xs">Max: {formatMaxContact(client.max_username)}</p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditing(true)}
                  className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                >
                  ✏️ Изменить
                </button>
                <button
                  onClick={deleteClient}
                  className="px-3 py-1.5 bg-red-50 text-red-500 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors"
                >
                  🗑️
                </button>
              </div>
            </div>

            {/* Info pills */}
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="px-3 py-1 bg-rose-50 text-rose-600 rounded-full text-xs font-medium">
                Скидка {client.discount_percent}%
              </span>
              <span className="px-3 py-1 bg-gray-50 text-gray-600 rounded-full text-xs font-medium">
                {dates.length} {pluralDates(dates.length)}
              </span>
            </div>

            {client.notes && (
              <p className="text-sm text-gray-500 bg-gray-50 rounded-lg px-3 py-2 mb-4">
                📝 {client.notes}
              </p>
            )}

            {/* VIP promo banner */}
            {dates.length >= 3 && (
              <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-xl p-3 mb-4 text-sm text-amber-700">
                🎉 Постоянный клиент! Действуют специальные условия и скидка {client.discount_percent}%.
              </div>
            )}

            {/* Contact buttons */}
            <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-50">
              <a
                href={`tel:${client.phone}`}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 transition-colors shadow-sm"
              >
                📞 Позвонить
              </a>
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-green-500 text-white text-sm font-medium hover:bg-green-600 transition-colors shadow-sm"
              >
                💬 WhatsApp
              </a>
              {tgLink && (
                <a
                  href={tgLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-500 text-white text-sm font-medium hover:bg-sky-600 transition-colors shadow-sm"
                >
                  ✈️ Telegram
                </a>
              )}
              {maxLink && (
                <a
                  href={maxLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-500 text-white text-sm font-medium hover:bg-violet-600 transition-colors shadow-sm"
                >
                  💬 Max
                </a>
              )}
              <a
                href={`sms:${client.phone}`}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-500 text-white text-sm font-medium hover:bg-purple-600 transition-colors shadow-sm"
              >
                ✉️ СМС
              </a>
            </div>
          </div>
        )}
      </div>

      {/* ── Memorable Dates (only when viewing existing client) ── */}
      {!isNew && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800">Памятные даты</h3>
            {dates.length < 10 && !showAddDate && (
              <button
                onClick={() => setShowAddDate(true)}
                className="px-3 py-1.5 bg-rose-500 text-white rounded-xl text-sm font-medium hover:bg-rose-600 transition-colors shadow-sm"
              >
                + Добавить
              </button>
            )}
          </div>

          {/* Add date form */}
          {showAddDate && (
            <form
              onSubmit={addDate}
              className="bg-white rounded-2xl border border-rose-200 p-4 mb-3 shadow-sm"
            >
              <h4 className="font-medium text-gray-800 mb-3">Новая памятная дата</h4>
              <DateForm
                value={newDate}
                onChange={setNewDate}
                onCancel={() => { setShowAddDate(false); setNewDate(EMPTY_DATE); }}
                submitLabel="Добавить дату"
              />
            </form>
          )}

          {/* Dates list */}
          {dates.length === 0 && !showAddDate ? (
            <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-gray-200 text-gray-400">
              <div className="text-3xl mb-2">📅</div>
              <p className="text-sm">Нет памятных дат</p>
              <p className="text-xs mt-1">Добавьте хотя бы 3 даты для статуса VIP</p>
            </div>
          ) : (
            <div className="space-y-3">
              {dates.map(d => (
                <div key={d.id}>
                  {editDateId === d.id ? (
                    <form
                      onSubmit={saveDate}
                      className="bg-white rounded-2xl border border-blue-200 p-4 shadow-sm"
                    >
                      <h4 className="font-medium text-gray-800 mb-3">Редактировать дату</h4>
                      <DateForm
                        value={editDateVal}
                        onChange={setEditDateVal}
                        onCancel={() => setEditDateId(null)}
                        submitLabel="Сохранить"
                        showActive
                      />
                    </form>
                  ) : (
                    <DateItem
                      date={d}
                      message={buildMessage(d)}
                      phone={client.phone}
                      telegramUsername={client.telegram_username}
                      onEdit={() => startEditDate(d)}
                      onDelete={() => removeDate(d.id)}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {dates.length > 0 && dates.length < 3 && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mt-3 text-center">
              💡 Добавьте ещё {3 - dates.length} {pluralDates(3 - dates.length, true)} — клиент получит статус VIP
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Date Item ──────────────────────────────────────────────────────────────

function DateItem({ date: d, message, phone, telegramUsername, onEdit, onDelete }) {
  const days    = daysUntil(d.day, d.month);
  const emoji   = getOccasionEmoji(d.occasion);
  const waLink  = getWhatsAppLink(phone, message);
  const tgLink  = getTelegramLink(telegramUsername);
  const maxLink = getMaxShareLink(message);

  return (
    <div className={`bg-white rounded-2xl border p-4 shadow-sm ${d.is_active ? 'border-gray-100' : 'border-gray-100 opacity-60'}`}>
      <div className="flex items-start gap-3">
        <span className="text-xl mt-0.5">{emoji}</span>
        <div className="flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-gray-800">{d.occasion}</p>
            <div className="flex items-center gap-1.5">
              {d.is_active ? (
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${daysColorClass(days)}`}>
                  {daysLabel(days)}
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-400">неактивна</span>
              )}
              <button onClick={onEdit}   className="p-1 text-gray-400 hover:text-blue-500 transition-colors" title="Редактировать">✏️</button>
              <button onClick={onDelete} className="p-1 text-gray-400 hover:text-red-500 transition-colors" title="Удалить">🗑️</button>
            </div>
          </div>
          <p className="text-sm text-gray-500">
            {d.day} {MONTHS_FULL[d.month]}
            {' · '}уведомить за {d.notify_days_before} дн.
          </p>

          {d.is_active && (
            <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-gray-50">
              <a href={`tel:${phone}`} className="text-xs px-2.5 py-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors">📞 Позвонить</a>
              <a href={waLink} target="_blank" rel="noopener noreferrer" className="text-xs px-2.5 py-1 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors">💬 WhatsApp</a>
              {tgLink && <a href={tgLink} target="_blank" rel="noopener noreferrer" className="text-xs px-2.5 py-1 bg-sky-50 text-sky-600 rounded-lg hover:bg-sky-100 transition-colors">✈️ Telegram</a>}
              <a href={maxLink} target="_blank" rel="noopener noreferrer" className="text-xs px-2.5 py-1 bg-violet-50 text-violet-600 rounded-lg hover:bg-violet-100 transition-colors">💬 Max</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Date Form (reusable) ───────────────────────────────────────────────────

function DateForm({ value, onChange, onCancel, submitLabel, showActive = false }) {
  const set = (field, val) => onChange(prev => ({ ...prev, [field]: val }));

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Повод *</label>
        <input
          list="occasion-presets"
          required
          placeholder="День рождения жены..."
          value={value.occasion}
          onChange={e => set('occasion', e.target.value)}
          className={inputCls}
        />
        <datalist id="occasion-presets">
          {OCCASION_PRESETS.map(p => <option key={p} value={p} />)}
        </datalist>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">День *</label>
          <select
            required
            value={value.day}
            onChange={e => set('day', e.target.value)}
            className={inputCls}
          >
            {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Месяц *</label>
          <select
            required
            value={value.month}
            onChange={e => set('month', e.target.value)}
            className={inputCls}
          >
            {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Уведомить за (дней)</label>
        <select
          value={value.notify_days_before}
          onChange={e => set('notify_days_before', e.target.value)}
          className={inputCls}
        >
          {[1, 2, 3, 5, 7, 14].map(n => (
            <option key={n} value={n}>{n} {n === 1 ? 'день' : n <= 4 ? 'дня' : 'дней'}</option>
          ))}
        </select>
      </div>

      {showActive && (
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={Boolean(value.is_active)}
            onChange={e => set('is_active', e.target.checked)}
            className="w-4 h-4 accent-rose-500"
          />
          <span className="text-sm text-gray-700">Активна</span>
        </label>
      )}

      <div className="flex gap-3 pt-1">
        <button
          type="submit"
          className="px-4 py-2 bg-rose-500 text-white rounded-xl text-sm font-medium hover:bg-rose-600 transition-colors shadow-sm"
        >
          {submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors"
        >
          Отмена
        </button>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────

function Field({ label, children, required }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

function pluralDates(n, genitive = false) {
  if (genitive) {
    if (n % 10 === 1 && n % 100 !== 11) return 'дату';
    if ([2,3,4].includes(n % 10) && ![12,13,14].includes(n % 100)) return 'даты';
    return 'дат';
  }
  if (n % 10 === 1 && n % 100 !== 11) return 'памятная дата';
  if ([2,3,4].includes(n % 10) && ![12,13,14].includes(n % 100)) return 'памятных даты';
  return 'памятных дат';
}

const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 bg-white';
