// 电脑端网页后台 API：手机号 + 后台密码登录，签名 token 鉴权。
const crypto = require('crypto');
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;
const ALLOWED_CATALOGS = ['services', 'staff'];

function jsonResponse(data, statusCode) {
  return {
    statusCode: statusCode || 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Content-Type': 'application/json; charset=utf-8'
    },
    body: JSON.stringify(data)
  };
}

function isHttpEvent(event = {}) {
  return !!(event.httpMethod || event.headers || typeof event.body === 'string');
}

function parseEvent(event = {}) {
  if (!isHttpEvent(event)) return event || {};
  if (event.httpMethod === 'OPTIONS') return { action: '__options' };
  const body = event.body || '{}';
  if (typeof body === 'object') return body;
  try {
    return JSON.parse(body || '{}');
  } catch (e) {
    return { action: '', parseError: '请求格式错误' };
  }
}

function base64url(value) {
  return Buffer.from(value).toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function fromBase64url(value) {
  let text = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  while (text.length % 4) text += '=';
  return Buffer.from(text, 'base64').toString('utf8');
}

function sha256(text) {
  return crypto.createHash('sha256').update(String(text || '')).digest('hex');
}

function tokenSecret() {
  return process.env.WEB_ADMIN_SECRET ||
    process.env.TCB_ENV ||
    process.env.SCF_NAMESPACE ||
    'moyo-web-admin-secret';
}

function sign(payload) {
  return crypto.createHmac('sha256', tokenSecret()).update(payload).digest('hex');
}

function makeToken(admin) {
  const payload = base64url(JSON.stringify({
    phone: normalizePhone(admin.phone || admin.purePhone || ''),
    name: admin.name || '',
    exp: Date.now() + TOKEN_TTL_MS
  }));
  return `${payload}.${sign(payload)}`;
}

function verifyTokenText(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  if (sign(payload) !== sig) return null;
  try {
    const data = JSON.parse(fromBase64url(payload));
    if (!data.exp || data.exp < Date.now()) return null;
    return data;
  } catch (e) {
    return null;
  }
}

function unique(list) {
  return Array.from(new Set(list.filter(Boolean)));
}

function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 13 && digits.indexOf('86') === 0) return digits.slice(2);
  return digits || String(value || '').trim();
}

function phoneCandidates(value) {
  const text = String(value || '').trim();
  const digits = text.replace(/\D/g, '');
  const out = [text, digits];
  if (digits.length === 11) out.push(`86${digits}`);
  if (digits.length === 13 && digits.indexOf('86') === 0) out.push(digits.slice(2));
  return unique(out);
}

async function findAdminByPhone(phone) {
  for (const candidate of phoneCandidates(phone)) {
    const phoneRes = await db.collection('admins').where({ phone: candidate }).limit(1).get();
    if (phoneRes.data && phoneRes.data[0] && phoneRes.data[0].enabled !== false) return phoneRes.data[0];
    const pureRes = await db.collection('admins').where({ purePhone: candidate }).limit(1).get();
    if (pureRes.data && pureRes.data[0] && pureRes.data[0].enabled !== false) return pureRes.data[0];
  }
  return null;
}

function passwordMatches(admin, password) {
  const text = String(password || '');
  if (!text) return false;
  if (admin.webPasswordHash && admin.webPasswordHash === sha256(text)) return true;
  if (admin.passwordHash && admin.passwordHash === sha256(text)) return true;
  if (admin.webPassword && String(admin.webPassword) === text) return true;
  if (admin.password && String(admin.password) === text) return true;
  return false;
}

async function login(input) {
  const phone = normalizePhone(input.phone);
  const password = String(input.password || '');
  if (!phone || !password) return { ok: false, reason: '请输入手机号和后台密码' };
  const admin = await findAdminByPhone(phone);
  if (!admin) return { ok: false, reason: '该手机号不是管理员' };
  if (!admin.webPasswordHash && !admin.passwordHash && !admin.webPassword && !admin.password) {
    return { ok: false, reason: '请先在 admins 集合配置后台密码' };
  }
  if (!passwordMatches(admin, password)) return { ok: false, reason: '手机号或密码不正确' };
  return {
    ok: true,
    token: makeToken(admin),
    admin: {
      phone: admin.phone || admin.purePhone || phone,
      name: admin.name || '管理员'
    }
  };
}

async function verifyToken(token) {
  const payload = verifyTokenText(token);
  if (!payload || !payload.phone) return null;
  const admin = await findAdminByPhone(payload.phone);
  return admin ? { ...payload, admin } : null;
}

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function normalizeBooking(item) {
  if (!item) return item;
  return {
    ...item,
    staffName: !item.staffName || item.staffName === '小美老师' ? '芬芬' : item.staffName
  };
}

async function stats(input) {
  const date = input.date || todayStr();
  const res = await db.collection('bookings').where({ date }).get();
  const list = res.data || [];
  const customerSet = new Set(list.map(item => item.openid || item.userSnapshot && item.userSnapshot.phone).filter(Boolean));
  const income = list
    .filter(item => item.status === 'done')
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  return {
    ok: true,
    today: date,
    customerCount: customerSet.size,
    orderCount: list.length,
    income
  };
}

async function listOrders(input) {
  if (input.countUnread) {
    const r = await db.collection('bookings').where({ adminRead: false }).count();
    return { ok: true, unreadCount: r.total };
  }
  const where = {};
  if (input.status) where.status = input.status;
  if (input.onlyUnread) where.adminRead = false;
  const limit = Math.min(Math.max(Number(input.limit) || 50, 1), 100);
  const skip = Math.max(Number(input.skip) || 0, 0);
  const res = await db.collection('bookings')
    .where(where)
    .orderBy('createdAt', 'desc')
    .skip(skip)
    .limit(limit)
    .get();
  return { ok: true, list: (res.data || []).map(normalizeBooking) };
}

async function updateOrder(input) {
  if (input.markAllRead) {
    await db.collection('bookings').where({ adminRead: false }).update({ data: { adminRead: true } });
    return { ok: true };
  }
  if (!input.bookingId) return { ok: false, reason: '缺少 bookingId' };
  const data = {};
  if (input.status) data.status = input.status;
  if (input.markRead) data.adminRead = true;
  if (Object.keys(data).length === 0) return { ok: false, reason: '无更新字段' };
  await db.collection('bookings').doc(input.bookingId).update({ data });
  return { ok: true };
}

function normalizeCatalogItem(collection, item) {
  if (collection !== 'staff' || !item) return item;
  return {
    ...item,
    name: !item.name || item.name === '小美老师' ? '芬芬' : item.name
  };
}

async function manageCatalog(input) {
  const collection = input.collection;
  const op = input.op || input.actionType || '';
  if (ALLOWED_CATALOGS.indexOf(collection) < 0) return { ok: false, reason: '非法集合' };
  const col = db.collection(collection);
  if (op === 'list') {
    const res = await col.orderBy('sortOrder', 'asc').get();
    return { ok: true, list: (res.data || []).map(item => normalizeCatalogItem(collection, item)) };
  }
  if (op === 'create') {
    const res = await col.add({ data: Object.assign({ enabled: true, createdAt: db.serverDate() }, input.data || {}) });
    return { ok: true, id: res._id };
  }
  if (op === 'update') {
    if (!input.id) return { ok: false, reason: '缺少 id' };
    await col.doc(input.id).update({ data: input.data || {} });
    return { ok: true };
  }
  if (op === 'remove') {
    if (!input.id) return { ok: false, reason: '缺少 id' };
    await col.doc(input.id).update({ data: { enabled: false } });
    return { ok: true };
  }
  return { ok: false, reason: '未知操作' };
}

async function getPendingVoiceNotices(input) {
  const limit = Math.min(Math.max(Number(input.limit) || 10, 1), 20);
  const res = await db.collection('bookings')
    .where({ voiceNoticeStatus: 'pending' })
    .orderBy('createdAt', 'asc')
    .limit(limit)
    .get();
  return { ok: true, list: res.data || [] };
}

async function markVoiceNoticePlayed(input) {
  const status = input.status || 'played';
  if (!input.bookingId) return { ok: false, reason: '缺少 bookingId' };
  await db.collection('bookings').doc(input.bookingId).update({
    data: {
      voiceNoticeStatus: status,
      voiceNoticeError: input.reason || '',
      voiceNoticePlayedAt: db.serverDate()
    }
  });
  return { ok: true };
}

async function dispatch(input) {
  if (input.action === 'stats') return stats(input);
  if (input.action === 'listOrders') return listOrders(input);
  if (input.action === 'updateOrder') return updateOrder(input);
  if (input.action === 'manageCatalog') return manageCatalog(input);
  if (input.action === 'getPendingVoiceNotices') return getPendingVoiceNotices(input);
  if (input.action === 'markVoiceNoticePlayed') return markVoiceNoticePlayed(input);
  return { ok: false, reason: '未知 action' };
}

exports.main = async (event = {}) => {
  const http = isHttpEvent(event);
  const input = parseEvent(event);
  let result;
  try {
    if (input.action === '__options') result = { ok: true };
    else if (input.parseError) result = { ok: false, reason: input.parseError };
    else if (input.action === 'login') result = await login(input);
    else {
      const admin = await verifyToken(input.token);
      result = admin ? await dispatch(input, admin) : { ok: false, reason: '登录已过期，请重新登录' };
    }
  } catch (e) {
    result = { ok: false, reason: e.message || String(e) };
  }
  return http ? jsonResponse(result) : result;
};
