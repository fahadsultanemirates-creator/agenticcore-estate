// Shared helpers for AgenticCore service modules.
// Plain ES module, no dependencies: importable by the Netlify function today
// and by future Telegram / WhatsApp / MCP adapters.

export const PROPERTY_TYPES = {
  house: 'House', flat: 'Flat / Apartment', upper_portion: 'Upper Portion', lower_portion: 'Lower Portion',
  room: 'Room', farm_house: 'Farm House', residential_plot: 'Residential Plot', commercial_plot: 'Commercial Plot',
  agricultural_land: 'Agricultural Land', office: 'Office', shop: 'Shop', warehouse: 'Warehouse / Factory', building: 'Building'
};
export const COMMERCIAL_TYPES = ['shop', 'office', 'building', 'warehouse', 'commercial_plot'];
export const UNIT_LABEL = { marla: 'Marla', kanal: 'Kanal', sqft: 'Sq. Ft.', sqyd: 'Sq. Yd.' };

// Everything is compared in marla. 1 kanal = 20 marla; 1 marla = 225 sq ft
// (the common Pakistani society convention) = 25 sq yd.
export function toMarla(value, unit) {
  const v = Number(value);
  if (!(v > 0)) return null;
  switch (unit) {
    case 'kanal': return v * 20;
    case 'sqft': return v / 225;
    case 'sqyd': return v / 25;
    default: return v;
  }
}

export function formatPKR(n) {
  n = Number(n) || 0;
  const trim = (x) => x.toFixed(2).replace(/\.?0+$/, '');
  if (n >= 10000000) return 'Rs ' + trim(n / 10000000) + ' crore';
  if (n >= 100000) return 'Rs ' + trim(n / 100000) + ' lac';
  return 'Rs ' + n.toLocaleString('en-PK');
}

export function formatSize(value, unit) {
  const v = Number(value);
  if (!(v > 0)) return '';
  return (Number.isInteger(v) ? v : v.toFixed(1)) + ' ' + (UNIT_LABEL[unit] || unit || 'Marla');
}

export function norm(s) {
  return String(s || '').toLowerCase().replace(/[’'`]/g, '')
    .replace(/[^a-z0-9./؀-ۿ]+/g, ' ')
    .replace(/\.(?!\d)|(?<!\d)\./g, ' ') // keep dots only inside numbers like 5.2
    .replace(/\s+/g, ' ').trim();
}

export function clampText(s, max) {
  s = String(s == null ? '' : s);
  return s.length > max ? s.slice(0, max) : s;
}

// Strip things that must never reach an AI provider: CNIC numbers, phone
// numbers, e-mail addresses. Property prices and sizes are kept.
export function redactPII(s) {
  return String(s || '')
    .replace(/\b\d{5}-?\d{7}-?\d\b/g, '[id removed]')
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email removed]')
    .replace(/(\+?92|0)3\d{2}[\s-]?\d{7}\b/g, '[phone removed]')
    .replace(/\+\d{1,3}[\s-]?\d{2,4}[\s-]?\d{3,4}[\s-]?\d{3,4}\b/g, '[phone removed]');
}
