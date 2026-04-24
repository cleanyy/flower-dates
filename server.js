import express from 'express';
import Database from 'better-sqlite3';
import cron from 'node-cron';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

// ─── Database ───────────────────────────────────────────────────────────────

const db = new Database('./dates.db');
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS clients (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    name               TEXT    NOT NULL,
    phone              TEXT    NOT NULL,
    telegram_username  TEXT,
    max_username       TEXT,
    discount_percent   INTEGER DEFAULT 10,
    is_vip             INTEGER DEFAULT 0,
    notes              TEXT,
    created_at         TEXT    DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS memorable_dates (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id          INTEGER NOT NULL,
    occasion           TEXT    NOT NULL,
    day                INTEGER NOT NULL,
    month              INTEGER NOT NULL,
    notify_days_before INTEGER DEFAULT 3,
    is_active          INTEGER DEFAULT 1,
    created_at         TEXT    DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS notification_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id  INTEGER NOT NULL,
    date_id    INTEGER NOT NULL,
    year       INTEGER NOT NULL,
    sent_at    TEXT    DEFAULT CURRENT_TIMESTAMP,
    message    TEXT,
    channel    TEXT    DEFAULT 'telegram',
    status     TEXT    DEFAULT 'pending'
  );
`);

try { db.exec('ALTER TABLE clients ADD COLUMN max_username TEXT'); } catch {}

const DEFAULTS = {
  notify_days_before: '3',
  telegram_bot_token: '',
  telegram_chat_id: '',
  store_name: 'Цветочный магазин',
  store_phone: '',
  message_template: 'Уважаемый {client_name}! Приближается "{occasion}" ({date}). Ваша скидка {discount}%. Ждём вас в нашем магазине!',
};

const initSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
for (const [k, v] of Object.entries(DEFAULTS)) initSetting.run(k, v);

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MONTHS_RU = ['','января','февраля','марта','апреля','мая','июня',
  'июля','августа','сентября','октября','ноября','декабря'];

function nextOccurrence(day, month) {
  const now = new Date();
  const y = now.getFullYear();
  const candidate = new Date(y, month - 1, day);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return candidate >= today ? candidate : new Date(y + 1, month - 1, day);
}

function daysUntil(day, month) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const next = nextOccurrence(day, month);
  next.setHours(0, 0, 0, 0);
  return Math.round((next - today) / 86400000);
}

function getSettings() {
  return Object.fromEntries(
    db.prepare('SELECT key, value FROM settings').all().map(r => [r.key, r.value])
  );
}

function optionalText(value) {
  const text = (value || '').trim();
  return text || null;
}

function formatMaxContact(contact) {
  const text = optionalText(contact);
  if (!text) return '';
  if (/^https?:\/\//i.test(text) || /^(web\.)?max\.ru\//i.test(text)) return text;
  return `@${text.replace(/^@/, '')}`;
}

// ─── API: Dashboard ──────────────────────────────────────────────────────────

app.get('/api/dashboard', (req, res) => {
  const days = parseInt(req.query.days) || 30;
  const rows = db.prepare(`
    SELECT md.*, c.name AS client_name, c.phone, c.telegram_username, c.max_username,
           c.discount_percent, c.is_vip
    FROM   memorable_dates md
    JOIN   clients c ON md.client_id = c.id
    WHERE  md.is_active = 1
  `).all();

  const upcoming = rows
    .map(d => ({
      ...d,
      days_until: daysUntil(d.day, d.month),
      next_date:  nextOccurrence(d.day, d.month).toISOString().split('T')[0],
    }))
    .filter(d => d.days_until <= days)
    .sort((a, b) => a.days_until - b.days_until);

  res.json(upcoming);
});

app.get('/api/stats', (req, res) => {
  const totalClients = db.prepare('SELECT COUNT(*) AS n FROM clients').get().n;
  const vipClients   = db.prepare('SELECT COUNT(*) AS n FROM clients WHERE is_vip=1').get().n;
  const totalDates   = db.prepare('SELECT COUNT(*) AS n FROM memorable_dates WHERE is_active=1').get().n;

  const rows = db.prepare(`
    SELECT md.day, md.month FROM memorable_dates md WHERE md.is_active=1
  `).all();

  const today  = rows.filter(d => daysUntil(d.day, d.month) === 0).length;
  const week   = rows.filter(d => daysUntil(d.day, d.month) <= 7).length;
  const month  = rows.filter(d => daysUntil(d.day, d.month) <= 30).length;

  res.json({ totalClients, vipClients, totalDates, today, week, month });
});

// ─── API: Clients ─────────────────────────────────────────────────────────────

app.get('/api/clients', (req, res) => {
  const { search, filter } = req.query;

  if (filter === 'today' || filter === 'week' || filter === 'month') {
    const maxDays = filter === 'today' ? 0 : filter === 'week' ? 7 : 30;
    const allDates = db.prepare(
      'SELECT client_id, day, month FROM memorable_dates WHERE is_active=1'
    ).all();
    const clientIds = [...new Set(
      allDates
        .filter(d => daysUntil(d.day, d.month) <= maxDays)
        .map(d => d.client_id)
    )];
    if (clientIds.length === 0) return res.json([]);
    const ph = clientIds.map(() => '?').join(',');
    let q = `
      SELECT c.*, COUNT(md.id) AS dates_count
      FROM   clients c
      LEFT JOIN memorable_dates md ON md.client_id = c.id AND md.is_active = 1
      WHERE  c.id IN (${ph})
    `;
    const params = [...clientIds];
    if (search) {
      q += ' AND (c.name LIKE ? OR c.phone LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    q += ' GROUP BY c.id ORDER BY c.created_at DESC';
    return res.json(db.prepare(q).all(...params));
  }

  let q = `
    SELECT c.*, COUNT(md.id) AS dates_count
    FROM   clients c
    LEFT JOIN memorable_dates md ON md.client_id = c.id AND md.is_active = 1
  `;
  const params = [];
  if (filter === 'vip') {
    q += ' WHERE c.is_vip = 1';
    if (search) {
      q += ' AND (c.name LIKE ? OR c.phone LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
  } else if (search) {
    q += ' WHERE c.name LIKE ? OR c.phone LIKE ?';
    params.push(`%${search}%`, `%${search}%`);
  }
  q += ' GROUP BY c.id ORDER BY c.created_at DESC';
  res.json(db.prepare(q).all(...params));
});

app.post('/api/clients', (req, res) => {
  const { name, phone, telegram_username, max_username, discount_percent, is_vip, notes } = req.body;
  if (!name?.trim() || !phone?.trim()) {
    return res.status(400).json({ error: 'Имя и телефон обязательны' });
  }
  const r = db.prepare(`
    INSERT INTO clients (name, phone, telegram_username, max_username, discount_percent, is_vip, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(name.trim(), phone.trim(), optionalText(telegram_username), optionalText(max_username),
         discount_percent || 10, is_vip ? 1 : 0, optionalText(notes));
  res.status(201).json(db.prepare('SELECT * FROM clients WHERE id=?').get(r.lastInsertRowid));
});

app.get('/api/clients/:id', (req, res) => {
  const client = db.prepare('SELECT * FROM clients WHERE id=?').get(req.params.id);
  if (!client) return res.status(404).json({ error: 'Клиент не найден' });
  const dates = db.prepare(
    'SELECT * FROM memorable_dates WHERE client_id=? ORDER BY month, day'
  ).all(req.params.id);
  res.json({ ...client, dates });
});

app.put('/api/clients/:id', (req, res) => {
  const { name, phone, telegram_username, max_username, discount_percent, is_vip, notes } = req.body;
  if (!name?.trim() || !phone?.trim()) {
    return res.status(400).json({ error: 'Имя и телефон обязательны' });
  }
  db.prepare(`
    UPDATE clients
    SET name=?, phone=?, telegram_username=?, max_username=?, discount_percent=?, is_vip=?, notes=?
    WHERE id=?
  `).run(name.trim(), phone.trim(), optionalText(telegram_username), optionalText(max_username),
         discount_percent || 10, is_vip ? 1 : 0, optionalText(notes), req.params.id);
  const client = db.prepare('SELECT * FROM clients WHERE id=?').get(req.params.id);
  const dates  = db.prepare('SELECT * FROM memorable_dates WHERE client_id=? ORDER BY month, day').all(req.params.id);
  res.json({ ...client, dates });
});

app.delete('/api/clients/:id', (req, res) => {
  db.prepare('DELETE FROM clients WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ─── API: Memorable Dates ────────────────────────────────────────────────────

app.post('/api/clients/:id/dates', (req, res) => {
  const { occasion, day, month, notify_days_before } = req.body;
  if (!occasion || !day || !month) {
    return res.status(400).json({ error: 'Повод, день и месяц обязательны' });
  }
  const r = db.prepare(`
    INSERT INTO memorable_dates (client_id, occasion, day, month, notify_days_before)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.params.id, occasion, day, month, notify_days_before || 3);

  // Auto-promote to VIP when 3+ active dates
  const cnt = db.prepare(
    'SELECT COUNT(*) AS n FROM memorable_dates WHERE client_id=? AND is_active=1'
  ).get(req.params.id).n;
  if (cnt >= 3) {
    db.prepare('UPDATE clients SET is_vip=1 WHERE id=? AND is_vip=0').run(req.params.id);
  }

  res.status(201).json(db.prepare('SELECT * FROM memorable_dates WHERE id=?').get(r.lastInsertRowid));
});

app.put('/api/dates/:id', (req, res) => {
  const { occasion, day, month, notify_days_before, is_active } = req.body;
  db.prepare(`
    UPDATE memorable_dates
    SET occasion=?, day=?, month=?, notify_days_before=?, is_active=?
    WHERE id=?
  `).run(occasion, day, month, notify_days_before || 3, is_active ? 1 : 0, req.params.id);
  res.json(db.prepare('SELECT * FROM memorable_dates WHERE id=?').get(req.params.id));
});

app.delete('/api/dates/:id', (req, res) => {
  db.prepare('DELETE FROM memorable_dates WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ─── API: Settings ───────────────────────────────────────────────────────────

app.get('/api/settings', (req, res) => res.json(getSettings()));

app.put('/api/settings', (req, res) => {
  const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  const tx = db.transaction(s => {
    for (const [k, v] of Object.entries(s)) stmt.run(k, String(v));
  });
  tx(req.body);
  res.json(getSettings());
});

// ─── API: Notifications ──────────────────────────────────────────────────────

app.get('/api/notifications', (req, res) => {
  res.json(db.prepare(`
    SELECT nl.*, c.name AS client_name, c.phone, md.occasion
    FROM   notification_log nl
    JOIN   clients c  ON nl.client_id = c.id
    JOIN   memorable_dates md ON nl.date_id = md.id
    ORDER  BY nl.sent_at DESC
    LIMIT  100
  `).all());
});

app.post('/api/test-notification', async (req, res) => {
  const s = getSettings();
  if (!s.telegram_bot_token || !s.telegram_chat_id) {
    return res.status(400).json({ error: 'Укажите Telegram токен и Chat ID в настройках' });
  }
  try {
    const r = await fetch(
      `https://api.telegram.org/bot${s.telegram_bot_token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: s.telegram_chat_id,
          text: `✅ Тест уведомления из "<b>${s.store_name}</b>"!\n\nПодключение работает корректно.`,
          parse_mode: 'HTML',
        }),
      }
    );
    const data = await r.json();
    if (!data.ok) throw new Error(data.description);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Scheduler ───────────────────────────────────────────────────────────────

async function runScheduler() {
  const s = getSettings();
  const notifyBefore = parseInt(s.notify_days_before) || 3;
  const year = new Date().getFullYear();

  const dates = db.prepare(`
    SELECT md.*, c.name AS client_name, c.phone, c.telegram_username, c.max_username, c.discount_percent
    FROM   memorable_dates md
    JOIN   clients c ON md.client_id = c.id
    WHERE  md.is_active = 1
  `).all();

  for (const d of dates) {
    const days = daysUntil(d.day, d.month);
    if (days > notifyBefore) continue;

    const already = db.prepare(
      'SELECT id FROM notification_log WHERE date_id=? AND year=?'
    ).get(d.id, year);
    if (already) continue;

    const dateStr = `${d.day} ${MONTHS_RU[d.month]}`;
    const message = (s.message_template || '')
      .replace('{client_name}', d.client_name)
      .replace('{occasion}', d.occasion)
      .replace('{date}', dateStr)
      .replace('{discount}', d.discount_percent)
      .replace('{phone}', d.phone);

    let status = 'pending';

    if (s.telegram_bot_token && s.telegram_chat_id) {
      const text =
        `🌸 <b>Памятная дата приближается!</b>\n\n` +
        `👤 <b>Клиент:</b> ${d.client_name}\n` +
        `📅 <b>Повод:</b> ${d.occasion}\n` +
        `🗓 <b>Дата:</b> ${dateStr}\n` +
        `⏰ <b>Осталось:</b> ${days === 0 ? '🔴 Сегодня!' : `${days} дн.`}\n` +
        `📞 <b>Телефон:</b> ${d.phone}\n` +
        (d.telegram_username ? `💬 <b>Telegram:</b> @${d.telegram_username.replace(/^@/, '')}\n` : '') +
        (d.max_username ? `💬 <b>Max:</b> ${formatMaxContact(d.max_username)}\n` : '') +
        `🎁 <b>Скидка клиента:</b> ${d.discount_percent}%\n\n` +
        `<i>${message}</i>`;

      try {
        const r = await fetch(
          `https://api.telegram.org/bot${s.telegram_bot_token}/sendMessage`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: s.telegram_chat_id, text, parse_mode: 'HTML' }),
          }
        );
        const data = await r.json();
        status = data.ok ? 'sent' : 'failed';
      } catch {
        status = 'failed';
      }
    }

    db.prepare(`
      INSERT INTO notification_log (client_id, date_id, year, message, channel, status)
      VALUES (?, ?, ?, ?, 'telegram', ?)
    `).run(d.client_id, d.id, year, message, status);
  }
}

// Every day at 09:00
cron.schedule('0 9 * * *', runScheduler);

app.post('/api/run-scheduler', async (req, res) => {
  try {
    await runScheduler();
    res.json({ ok: true, message: 'Проверка завершена' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Serve React app (production) ────────────────────────────────────────────

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    }
  });
}

app.listen(PORT, () => {
  console.log(`🌸 Памятные даты → http://localhost:${PORT}`);
});
