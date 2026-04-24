# Handoff Summary — flower-dates

> Дата: 21 апреля 2026  
> Сервер: `144.31.196.251`  
> Приложение: **http://144.31.196.251:5173** (production, фронт + `/api`)

---

## Что это за приложение

CRM для цветочного магазина. Хранит клиентов и их памятные даты (дни рождения родственников, годовщины и т.д.), чтобы флорист мог заблаговременно связаться с клиентом и предложить цветы со скидкой. Уведомления отправляются через Telegram-бота.

---

## Стек

| Слой | Технология |
|---|---|
| Frontend | React 18, React Router 6, Tailwind CSS 3, Vite 5 |
| Backend | Node.js, Express 4, better-sqlite3 |
| БД | SQLite (`dates.db` в корне проекта) |
| Уведомления | Telegram Bot API, node-cron (9:00 ежедневно) |
| Иконки | lucide-react |

---

## Запуск

```bash
# Режим разработки (фронт + бэк одновременно)
npx concurrently "node server.js" "vite --host"

# Продакшн (раздаёт собранный dist/ и API с одного порта)
npm run build
NODE_ENV=production PORT=5173 node server.js
```

**Важно:** публичный `5173` теперь обслуживается не Vite dev server, а production Express под systemd:

```bash
sudo systemctl status flower-dates.service
sudo systemctl restart flower-dates.service
```

Порт 5173 открыт в `ufw` (`sudo ufw allow 5173/tcp`). API доступен с того же origin через `/api`.

---

## Структура файлов

```
flower-dates/
├── server.js              # Express API + SQLite + cron-планировщик
├── dates.db               # SQLite база данных (WAL-режим)
├── vite.config.js         # Vite конфиг
├── src/
│   ├── main.jsx           # Точка входа React
│   ├── App.jsx            # Роутер + сайдбар
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
| telegram_username | TEXT | `@username` без обязательного `@` |
| max_username | TEXT | Ник Max или ссылка на чат из веб-версии |
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

**Фильтры на главной:**
- `today` — `days_until === 0`
- `week` — `days_until <= 7`
- `month` — `days_until <= 30`
- `vip` — `is_vip = 1`

Логика `daysUntil` вычисляется в JS (не в SQL), поэтому для фильтров `today/week/month` сервер подтягивает все даты, считает `days_until` в памяти и возвращает уникальные `client_id`.

---

## Что было сделано в этой сессии

1. **Открыт доступ к приложению** — Vite запущен с флагом `--host`, открыт порт `5173` в `ufw`.

2. **Кликабельные статблоки на главной** — `StatCard` (`Dashboard.jsx:109`) превращён в `<Link>` с `to="/clients?filter=..."`. Добавлен hover-эффект (`hover:shadow-md hover:scale-[1.02]`).

3. **Фильтрация клиентов по статблокам** — расширен `GET /api/clients` в `server.js` для поддержки параметра `?filter`. `Clients.jsx` читает `filter` из `useSearchParams`, передаёт в `api.getClients()`. При активном фильтре показывается цветной баннер с кнопкой «Сбросить».

4. **Группировка дат по клиенту на главной** — раздел «Ближайшие даты» в `Dashboard.jsx` переработан: вместо отдельной карточки на каждую дату теперь один блок на клиента. Добавлена функция `groupByClient()`, компонент `DateCard` заменён на `ClientCard` + `DateRow`. Структура карточки: шапка с именем клиента, телефоном, VIP-статусом, скидкой и кнопками «Позвонить» / «Telegram» / «Max»; ниже — строки дат с поводом, датой, бейджем «Через N дней» и кнопками WhatsApp / Max / СМС под каждый повод. Цвет рамки карточки определяется по ближайшей дате клиента.

5. **Добавлен канал Max** — у клиента есть поле `max_username`, куда можно сохранить ник или ссылку на чат. В карточках клиента появилась кнопка Max по сохранённому контакту, а в кнопках памятных дат Max открывает официальный шаринг `https://max.ru/:share` с подготовленным текстом сообщения.

6. **Публичный запуск переведён на systemd** — добавлен `flower-dates.service`, старый Vite dev server на `5173` остановлен. Теперь `http://144.31.196.251:5173` отдаёт production-сборку из `dist/`, а API работает по `/api` на том же порту.

---

## Возможные доработки

- [ ] Поиск и фильтр работают независимо; можно объединить (AND-логику уже заложили в сервер)
- [ ] Нет пагинации в списке клиентов
- [ ] Нет защиты API (аутентификация/авторизация)
- [ ] Telegram-уведомления только владельцу магазина (chat_id один); нет рассылки самим клиентам
- [ ] `daysUntil` для фильтров считается в JS — при большой базе можно перенести в SQL
- [ ] Нет резервного копирования `dates.db`
