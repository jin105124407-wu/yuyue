// 云函数：listOrders —— 管理员查询订单列表 / 未读数
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

function unique(list) {
  return Array.from(new Set(list.filter(Boolean)));
}

function phoneCandidatesFromUser(user = {}) {
  const raw = [user.phone, user.purePhone];
  const out = [];
  raw.forEach(value => {
    const text = String(value || '').trim();
    const digits = text.replace(/\D/g, '');
    if (text) out.push(text);
    if (digits) out.push(digits);
    if (digits.length === 13 && digits.indexOf('86') === 0) out.push(digits.slice(2));
  });
  return unique(out);
}

async function hasAdminPhone(phone) {
  if (!phone) return false;
  const phoneRes = await db.collection('admins').where({ phone }).limit(1).get();
  if (phoneRes.data.length > 0) return true;
  const purePhoneRes = await db.collection('admins').where({ purePhone: phone }).limit(1).get();
  return purePhoneRes.data.length > 0;
}

async function isAdmin(openid) {
  const r = await db.collection('admins').where({ openid }).limit(1).get();
  if (r.data.length > 0) return true;
  const userRes = await db.collection('users').where({ openid }).limit(20).get();
  const phones = unique((userRes.data || []).reduce((all, user) => all.concat(phoneCandidatesFromUser(user)), []));
  for (const phone of phones) {
    if (await hasAdminPhone(phone)) return true;
  }
  return false;
}

function normalizeBooking(item) {
  if (!item) return item;
  return {
    ...item,
    staffName: !item.staffName || item.staffName === '小美老师' ? '芬芬' : item.staffName
  };
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!(await isAdmin(OPENID))) return { ok: false, reason: '无权限' };

  const { status, onlyUnread, limit = 50, skip = 0, countUnread } = event || {};

  if (countUnread) {
    const r = await db.collection('bookings').where({ adminRead: false }).count();
    return { ok: true, unreadCount: r.total };
  }

  const where = {};
  if (status) where.status = status;
  if (onlyUnread) where.adminRead = false;

  const res = await db.collection('bookings')
    .where(where)
    .orderBy('createdAt', 'desc')
    .skip(skip).limit(limit)
    .get();

  return { ok: true, list: (res.data || []).map(normalizeBooking) };
};
