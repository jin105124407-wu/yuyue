const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

function normalizeBooking(item) {
  if (!item) return item;
  return {
    ...item,
    staffName: !item.staffName || item.staffName === '小美老师' ? '芬芬' : item.staffName
  };
}

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext();
  const { limit = 50 } = event;

  if (!OPENID) {
    return { ok: false, reason: '未获取到用户身份', list: [] };
  }

  try {
    const res = await db.collection('bookings')
      .where({ openid: OPENID })
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    return { ok: true, openid: OPENID, list: (res.data || []).map(normalizeBooking) };
  } catch (e) {
    return { ok: false, openid: OPENID, reason: e.message || String(e), list: [] };
  }
};
