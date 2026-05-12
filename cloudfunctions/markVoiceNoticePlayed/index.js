// 云函数：markVoiceNoticePlayed —— 管理员标记预约语音已播报
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

  const { bookingId, status = 'played', reason = '' } = event || {};
  if (!bookingId) return { ok: false, reason: '缺少 bookingId' };

  await db.collection('bookings').doc(bookingId).update({
    data: {
      voiceNoticeStatus: status,
      voiceNoticeError: reason,
      voiceNoticePlayedAt: db.serverDate()
    }
  });

  return { ok: true };
};
