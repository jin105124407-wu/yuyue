// 云函数：listOrders —— 管理员查询订单列表 / 未读数
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

async function isAdmin(openid) {
  const r = await db.collection('admins').where({ openid }).limit(1).get();
  return r.data.length > 0;
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
