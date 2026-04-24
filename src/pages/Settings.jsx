import { useState, useEffect } from 'react';
import { api } from '../api.js';

const NOTIFY_OPTIONS = [1, 2, 3, 5, 7, 14];
const STATUS_LABELS = { sent: '✅ Отправлено', failed: '❌ Ошибка', pending: '⏳ Ожидает' };

const MONTHS_SHORT = ['','янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];

export default function Settings() {
  const [form,          setForm]          = useState(null);
  const [saving,        setSaving]        = useState(false);
  const [saved,         setSaved]         = useState(false);
  const [error,         setError]         = useState('');
  const [testing,       setTesting]       = useState(false);
  const [testResult,    setTestResult]    = useState('');
  const [running,       setRunning]       = useState(false);
  const [runResult,     setRunResult]     = useState('');
  const [logs,          setLogs]          = useState([]);
  const [showLogs,      setShowLogs]      = useState(false);
  const [loadingLogs,   setLoadingLogs]   = useState(false);

  useEffect(() => {
    api.getSettings().then(s => setForm(s));
  }, []);

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  async function save(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.updateSettings(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function testTelegram() {
    setTesting(true);
    setTestResult('');
    try {
      await api.testNotification();
      setTestResult('✅ Сообщение отправлено! Проверьте Telegram.');
    } catch (e) {
      setTestResult(`❌ Ошибка: ${e.message}`);
    } finally {
      setTesting(false);
    }
  }

  async function runScheduler() {
    setRunning(true);
    setRunResult('');
    try {
      await api.runScheduler();
      setRunResult('✅ Проверка выполнена. Уведомления отправлены при необходимости.');
    } catch (e) {
      setRunResult(`❌ Ошибка: ${e.message}`);
    } finally {
      setRunning(false);
    }
  }

  async function loadLogs() {
    setLoadingLogs(true);
    try {
      const data = await api.getNotifications();
      setLogs(data);
      setShowLogs(true);
    } finally {
      setLoadingLogs(false);
    }
  }

  if (!form) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-rose-400 animate-pulse">Загрузка...</div>
    </div>
  );

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Настройки</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={save} className="space-y-6">

        {/* ── Store Info ── */}
        <Section title="🌸 Информация о магазине">
          <Field label="Название магазина">
            <input
              type="text"
              value={form.store_name || ''}
              onChange={e => set('store_name', e.target.value)}
              placeholder="Цветочный магазин"
              className={inputCls}
            />
          </Field>
          <Field label="Телефон магазина">
            <input
              type="tel"
              value={form.store_phone || ''}
              onChange={e => set('store_phone', e.target.value)}
              placeholder="+7 999 000-00-00"
              className={inputCls}
            />
          </Field>
        </Section>

        {/* ── Notifications ── */}
        <Section title="🔔 Настройки уведомлений">
          <Field label="Уведомлять за (дней до даты)">
            <select
              value={form.notify_days_before || '3'}
              onChange={e => set('notify_days_before', e.target.value)}
              className={inputCls}
            >
              {NOTIFY_OPTIONS.map(n => (
                <option key={n} value={n}>{n} {n === 1 ? 'день' : n <= 4 ? 'дня' : 'дней'}</option>
              ))}
            </select>
          </Field>

          <Field label="Шаблон сообщения">
            <textarea
              rows={4}
              value={form.message_template || ''}
              onChange={e => set('message_template', e.target.value)}
              className={inputCls + ' resize-none font-mono text-xs'}
            />
            <p className="text-xs text-gray-400 mt-1">
              Переменные: <code className="bg-gray-100 px-1 rounded">{'{client_name}'}</code>{' '}
              <code className="bg-gray-100 px-1 rounded">{'{occasion}'}</code>{' '}
              <code className="bg-gray-100 px-1 rounded">{'{date}'}</code>{' '}
              <code className="bg-gray-100 px-1 rounded">{'{discount}'}</code>{' '}
              <code className="bg-gray-100 px-1 rounded">{'{phone}'}</code>
            </p>
          </Field>
        </Section>

        {/* ── Telegram Bot ── */}
        <Section title="✈️ Telegram бот (автоуведомления)">
          <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 text-xs text-sky-700 mb-3 space-y-1">
            <p className="font-semibold">Как настроить:</p>
            <ol className="list-decimal list-inside space-y-0.5">
              <li>Создайте бота через <strong>@BotFather</strong> в Telegram → скопируйте токен</li>
              <li>Напишите вашему боту любое сообщение</li>
              <li>Узнайте ваш Chat ID через <strong>@userinfobot</strong></li>
              <li>Вставьте токен и Chat ID ниже и нажмите «Сохранить»</li>
              <li>Нажмите «Тест» для проверки</li>
            </ol>
          </div>

          <Field label="Telegram Bot Token">
            <input
              type="text"
              value={form.telegram_bot_token || ''}
              onChange={e => set('telegram_bot_token', e.target.value)}
              placeholder="1234567890:AAF..."
              className={inputCls + ' font-mono text-xs'}
            />
          </Field>
          <Field label="Ваш Telegram Chat ID">
            <input
              type="text"
              value={form.telegram_chat_id || ''}
              onChange={e => set('telegram_chat_id', e.target.value)}
              placeholder="123456789"
              className={inputCls}
            />
          </Field>

          {/* Test button */}
          <div>
            <button
              type="button"
              onClick={testTelegram}
              disabled={testing || !form.telegram_bot_token || !form.telegram_chat_id}
              className="px-4 py-2 bg-sky-500 text-white rounded-xl text-sm font-medium hover:bg-sky-600 disabled:opacity-40 transition-colors"
            >
              {testing ? 'Отправка...' : '📨 Тест соединения'}
            </button>
            {testResult && (
              <p className="mt-2 text-sm text-gray-700">{testResult}</p>
            )}
          </div>
        </Section>

        {/* ── Save ── */}
        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-rose-500 text-white rounded-xl text-sm font-bold hover:bg-rose-600 disabled:opacity-50 transition-colors shadow-sm"
          >
            {saving ? 'Сохранение...' : '💾 Сохранить настройки'}
          </button>
          {saved && <span className="text-green-600 text-sm font-medium">✅ Сохранено!</span>}
        </div>
      </form>

      {/* ── Scheduler ── */}
      <div className="mt-8 pt-6 border-t border-gray-100">
        <h2 className="font-semibold text-gray-800 mb-3">⚙️ Управление рассылкой</h2>
        <p className="text-sm text-gray-500 mb-3">
          Рассылка запускается автоматически каждый день в 9:00. Вы также можете запустить её вручную.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={runScheduler}
            disabled={running}
            className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-sm font-medium hover:bg-emerald-600 disabled:opacity-40 transition-colors shadow-sm"
          >
            {running ? 'Проверяю...' : '▶️ Запустить проверку сейчас'}
          </button>
          <button
            type="button"
            onClick={loadLogs}
            disabled={loadingLogs}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 disabled:opacity-40 transition-colors"
          >
            {loadingLogs ? 'Загрузка...' : '📋 История уведомлений'}
          </button>
        </div>
        {runResult && (
          <p className="mt-3 text-sm text-gray-700">{runResult}</p>
        )}
      </div>

      {/* ── Notification log ── */}
      {showLogs && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-gray-800">История ({logs.length})</h3>
            <button
              onClick={() => setShowLogs(false)}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Скрыть
            </button>
          </div>

          {logs.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">История пуста</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-auto">
              {logs.map(l => (
                <div
                  key={l.id}
                  className="bg-white border border-gray-100 rounded-xl p-3 text-sm flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-gray-800 truncate">{l.client_name} · {l.occasion}</p>
                    <p className="text-xs text-gray-400">
                      {formatDate(l.sent_at)} · {l.channel}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs">{STATUS_LABELS[l.status] || l.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
      <h2 className="font-semibold text-gray-800 pb-2 border-b border-gray-50">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getDate()} ${['','янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'][d.getMonth() + 1]} ${d.getFullYear()}`;
}

const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 bg-white';
