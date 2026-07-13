// 云函数：manageService —— 管理员对 services 与 staff 的增删改
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

const ALLOWED = ['services', 'staff'];

function normalizeItem(collection, item) {
  if (collection !== 'staff' || !item) return item;
  return {
    ...item,
    name: !item.name || item.name === '小美老师' ? '芬芬' : item.name
  };
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!(await isAdmin(OPENID))) return { ok: false, reason: '无权限' };

  const { collection, action, id, data } = event || {};
  if (ALLOWED.indexOf(collection) < 0) return { ok: false, reason: '非法集合' };

  const col = db.collection(collection);

  if (action === 'list') {
    const res = await col.orderBy('sortOrder', 'asc').get();
    return { ok: true, list: (res.data || []).map(item => normalizeItem(collection, item)) };
  }
  if (action === 'create') {
    const res = await col.add({ data: Object.assign({ enabled: true, createdAt: db.serverDate() }, data || {}) });
    return { ok: true, id: res._id };
  }
  if (action === 'update') {
    if (!id) return { ok: false, reason: '缺少 id' };
    await col.doc(id).update({ data: data || {} });
    return { ok: true };
  }
  if (action === 'remove') {
    if (!id) return { ok: false, reason: '缺少 id' };
    await col.doc(id).update({ data: { enabled: false } });
    return { ok: true };
  }
  return { ok: false, reason: '未知 action' };
};
