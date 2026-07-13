function datePart(date) {
  return String(date || '').replace(/\D/g, '');
}

function randomSuffix() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
}

function buildOrderNo(date, suffix) {
  const safeSuffix = String(suffix || randomSuffix()).replace(/[^0-9A-Za-z]/g, '').toUpperCase();
  return `MOYO${datePart(date)}${safeSuffix}`;
}

module.exports = { buildOrderNo };
