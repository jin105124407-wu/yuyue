// 云函数：getPendingVoiceNotices —— 管理员拉取待语音播报的新预约
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

async function isAdmin(openid) {
  const r = await db.collection('admins').where({ openid }).limit(1).get();
  return r.data.length > 0;
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
