// 云函数：getPendingVoiceNotices —— 管理员拉取待语音播报的新预约
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

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!(await isAdmin(OPENID))) return { ok: false, reason: '无权限' };

  const { limit = 5 } = event || {};
  const res = await db.collection('bookings')
    .where({ voiceNoticeStatus: 'pending' })
    .orderBy('createdAt', 'asc')
    .limit(Math.min(Math.max(Number(limit) || 5, 1), 20))
    .get();

  return { ok: true, list: res.data || [] };
};
