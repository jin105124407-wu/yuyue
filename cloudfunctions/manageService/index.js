// 云函数：manageService —— 管理员对 services 与 staff 的增删改
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

async function isAdmin(openid) {
  const r = await db.collection('admins').where({ openid }).count();
  return r.total > 0;
}

const ALLOWED = ['services', 'staff'];

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!(await isAdmin(OPENID))) return { ok: false, reason: '无权限' };

  const { collection, action, id, data } = event || {};
  if (ALLOWED.indexOf(collection) < 0) return { ok: false, reason: '非法集合' };

  const col = db.collection(collection);

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
    await col.doc(id).remove();
    return { ok: true };
  }
  return { ok: false, reason: '未知 action' };
};
