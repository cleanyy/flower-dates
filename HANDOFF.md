# Handoff Summary — flower-dates

> Дата: 25 апреля 2026  
> Сервер: `144.31.196.251`  
> Приложение: **http://144.31.196.251:5173** (production, фронт + `/api`)  
> Репозиторий: **https://github.com/cleanyy/flower-dates**

---

## Что это за приложение

CRM для цветочного магазина. Хранит клиентов и их памятные даты (дни рождения родственников, годовщины и т.д.), чтобы флорист мог заблаговременно связаться с клиентом и предложить цветы со скидкой. Уведомления отправляются через Telegram-бота.

---

## Стек

| Слой | Технология |
|---|---|
| Frontend | React 18, React Router 6, Tailwind CSS 3, Vite 5 |
| Backend | Node.js, Express 4, better-sqlite3 v12 |
| БД | SQLite (`dates.db` в корне проекта) |
| Уведомления | Telegram Bot API, node-cron (9:00 ежедневно) |
| Иконки | lucide-react |

---

## Запуск локально (Windows/Mac/Linux)

```bash
git clone https://github.com/cleanyy/flower-dates.git
cd flower-dates
npm run setup    # npm install + vite build
npm start        # http://localhost:3001
```

**Важно для Windows:** `better-sqlite3` требует компиляции нативного модуля.  
На Node.js 24 всё работает без Visual Studio (используется better-sqlite3 v12 с prebuild).

### Режим разработки

```bash
npm run dev      # API на :3001, Vite dev server на :5173
```

---

## Запуск на сервере (production)

На сервере `144.31.196.251` production-режим запущен через systemd:

```bash
sudo systemctl status flower-dates.service
sudo systemctl restart flower-dates.service
```

Порт `5173` открыт в `ufw`. API доступен с того же origin через `/api`.

---

## Структура файлов

```
flower-dates/
├── server.js              # Express API + SQLite + cron-планировщик
├── dates.db               # SQLite база данных (WAL-режим, не в git)
├── flower-dates.service   # systemd unit для сервера
├── vite.config.js         # Vite конфиг (proxy /api → localhost:3001 в dev)
├── src/
│   ├── main.jsx           # Точка входа React
│   ├── App.jsx            # Роутер + сайдбар (desktop) + нижняя навигация (mobile)
│   ├── api.js             # Все fetch-вызовы к /api
│   ├── utils.js           # Хелперы: эмодзи, форматирование, цвета
│   ├── index.css          # Tailwind base
│   └── pages/
│       ├── Dashboard.jsx  # Главная: статы + ближайшие даты
│       ├── Clients.jsx    # Список клиентов с поиском и фильтрами
│       ├── ClientDetail.jsx # Карточка клиента + CRUD памятных дат
│       └── Settings.jsx   # Настройки магазина + Telegram + логи
```

---

## База данных

### `clients`
| Поле | Тип | Описание |
|---|---|---|
| id | INTEGER PK | |
| name | TEXT | Имя клиента |
| phone | TEXT | Телефон |
| telegram_username | TEXT | `@username` |
| max_username | TEXT | Ник Max или ссылка на чат |
| discount_percent | INTEGER | Скидка, default 10 |
| is_vip | INTEGER | 0/1 — автоматически ставится в 1 при ≥3 активных датах |
| notes | TEXT | Свободный текст |
| created_at | TEXT | ISO timestamp |

### `memorable_dates`
| Поле | Тип | Описание |
|---|---|---|
| id | INTEGER PK | |
| client_id | INTEGER FK | CASCADE DELETE |
| occasion | TEXT | Повод (из OCCASION_PRESETS или произвольный) |
| day / month | INTEGER | День и месяц (без года — ежегодное событие) |
| notify_days_before | INTEGER | За сколько дней уведомлять, default 3 |
| is_active | INTEGER | 0/1 |

### `notification_log`
Лог отправленных уведомлений. Статусы: `pending` / `sent` / `failed`. Одно уведомление на `date_id` в год.

### `settings`
KV-таблица. Ключи: `store_name`, `store_phone`, `notify_days_before`, `telegram_bot_token`, `telegram_chat_id`, `message_template`.

---

## API эндпоинты

```
GET  /api/dashboard?days=30         Даты в ближайшие N дней (default 30)
GET  /api/stats                     Счётчики: today/week/month/vipClients/totalClients/totalDates

GET  /api/clients                   Список клиентов
     ?search=строка                 Поиск по имени/телефону
     ?filter=today|week|month|vip   Фильтр по статистическим блокам
POST /api/clients                   Создать клиента
GET  /api/clients/:id               Клиент + его даты
PUT  /api/clients/:id               Обновить клиента
DEL  /api/clients/:id               Удалить клиента (CASCADE удаляет даты)

POST /api/clients/:id/dates         Добавить дату клиенту
PUT  /api/dates/:id                 Обновить дату
DEL  /api/dates/:id                 Удалить дату

GET  /api/settings                  Получить все настройки
PUT  /api/settings                  Сохранить настройки (bulk upsert)

GET  /api/notifications             Лог уведомлений (последние 100)
POST /api/test-notification         Тест Telegram-бота
POST /api/run-scheduler             Запустить планировщик вручную
```

---

## Бизнес-логика

**VIP-статус** — автоматически присваивается при добавлении 3-й активной памятной даты (`server.js:213`). Можно также выставить вручную через форму клиента.

**Планировщик** — запускается в 9:00 каждый день. Проверяет все активные даты, смотрит `days_until <= notify_days_before`. Если уведомление за текущий год ещё не отправлялось — отправляет в Telegram и пишет в лог.

**Шаблон сообщения** — поддерживает переменные `{client_name}`, `{occasion}`, `{date}`, `{discount}`, `{phone}`.

---

## Адаптивность

- **Desktop (md+):** боковое меню слева (w-60)
- **Mobile:** боковое меню скрыто, внизу экрана фиксированная навигация (Главная / Клиенты / Настройки)
- Отступы страниц: `p-4` на mobile, `p-6` на desktop

---

## Возможные доработки

- [ ] Поиск и фильтр работают независимо; можно объединить (AND-логику уже заложили в сервер)
- [ ] Нет пагинации в списке клиентов
- [ ] Нет защиты API (аутентификация/авторизация)
- [ ] Telegram-уведомления только владельцу магазина (chat_id один); нет рассылки самим клиентам
- [ ] `daysUntil` для фильтров считается в JS — при большой базе можно перенести в SQL
- [ ] Нет резервного копирования `dates.db`
