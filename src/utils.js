export const MONTHS_FULL = [
  '', 'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

export const MONTHS_NAMES = [
  '', 'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

export const OCCASION_PRESETS = [
  'День рождения жены',
  'День рождения мужа',
  'День рождения мамы',
  'День рождения папы',
  'День рождения дочери',
  'День рождения сына',
  'День рождения бабушки',
  'День рождения дедушки',
  'День рождения подруги',
  'День рождения друга',
  'Годовщина свадьбы',
  'День святого Валентина',
  'Международный женский день',
  'День учителя',
];

export function getOccasionEmoji(occasion) {
  const o = (occasion || '').toLowerCase();
  if (o.includes('жен') || o.includes('мам') || o.includes('матер') || o.includes('бабуш') || o.includes('подруг') || o.includes('дочер')) return '👩';
  if (o.includes('муж') || o.includes('пап') || o.includes('отец') || o.includes('дедуш') || o.includes('сын') || o.includes('брат')) return '👨';
  if (o.includes('рожд')) return '🎂';
  if (o.includes('годовщин') || o.includes('свадьб') || o.includes('валент')) return '💑';
  if (o.includes('учител')) return '📚';
  if (o.includes('8 март') || o.includes('женск')) return '💐';
  return '🌸';
}

export function getWhatsAppLink(phone, message = '') {
  const digits = (phone || '').replace(/\D/g, '').replace(/^8/, '7');
  return `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
}

export function getTelegramLink(username) {
  if (!username) return null;
  return `https://t.me/${username.replace(/^@/, '')}`;
}

export function getMaxContactLink(contact) {
  const value = (contact || '').trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (/^(web\.)?max\.ru\//i.test(value)) return `https://${value}`;

  return `https://max.ru/${encodeURIComponent(value.replace(/^@/, ''))}`;
}

export function getMaxShareLink(message = '') {
  const text = (message || '').trim();
  return `https://max.ru/:share${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

export function formatMaxContact(contact) {
  const value = (contact || '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value) || /^(web\.)?max\.ru\//i.test(value)) return 'ссылка на чат';
  return `@${value.replace(/^@/, '')}`;
}

export function formatPhoneDisplay(phone) {
  const d = (phone || '').replace(/\D/g, '');
  if (d.length === 11 && (d[0] === '7' || d[0] === '8')) {
    return `+7 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7, 9)}-${d.slice(9, 11)}`;
  }
  return phone;
}

export function daysLabel(n) {
  if (n === 0) return 'Сегодня!';
  if (n === 1) return 'Завтра';
  if (n <= 4) return `Через ${n} дня`;
  return `Через ${n} дней`;
}

export function daysColorClass(n) {
  if (n === 0) return 'bg-red-500 text-white';
  if (n <= 3)  return 'bg-orange-500 text-white';
  if (n <= 7)  return 'bg-yellow-400 text-gray-800';
  return 'bg-emerald-500 text-white';
}

export function daysCardBorder(n) {
  if (n === 0) return 'border-red-200 bg-red-50';
  if (n <= 3)  return 'border-orange-200 bg-orange-50';
  if (n <= 7)  return 'border-yellow-200 bg-yellow-50';
  return 'border-gray-100 bg-white';
}
