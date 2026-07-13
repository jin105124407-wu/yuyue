// 云函数：updateOrder —— 管理员更新订单（状态/已读）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

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
  const phoneRes = await db.collection('admins').where({ phone }).count();
  if (phoneRes.total > 0) return true;
  const purePhoneRes = await db.collection('admins').where({ purePhone: phone }).count();
  return purePhoneRes.total > 0;
}

async function isAdmin(openid) {
  const r = await db.collection('admins').where({ openid }).count();
  if (r.total > 0) return true;
  const userRes = await db.collection('users').where({ openid }).limit(20).get();
  const phones = unique((userRes.data || []).reduce((all, user) => all.concat(phoneCandidatesFromUser(user)), []));
  for (const phone of phones) {
    if (await hasAdminPhone(phone)) return true;
  }
  return false;
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!(await isAdmin(OPENID))) return { ok: false, reason: '无权限' };

  const { bookingId, status, markRead, markAllRead } = event || {};

  if (markAllRead) {
    await db.collection('bookings').where({ adminRead: false }).update({ data: { adminRead: true } });
    return { ok: true };
  }

  if (!bookingId) return { ok: false, reason: '缺少 bookingId' };
  const data = {};
  if (status) data.status = status;
  if (markRead) data.adminRead = true;
  if (Object.keys(data).length === 0) return { ok: false, reason: '无更新字段' };

  await db.collection('bookings').doc(bookingId).update({ data });
  return { ok: true };
};
