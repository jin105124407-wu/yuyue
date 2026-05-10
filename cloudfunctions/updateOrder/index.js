// 云函数：updateOrder —— 管理员更新订单（状态/已读）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

async function isAdmin(openid) {
  const r = await db.collection('admins').where({ openid }).count();
  return r.total > 0;
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
