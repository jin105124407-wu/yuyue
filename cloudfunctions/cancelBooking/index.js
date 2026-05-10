const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext();
  const { bookingId } = event;

  if (!OPENID) return { ok: false, reason: '未获取到用户身份' };
  if (!bookingId) return { ok: false, reason: '缺少预约ID' };

  try {
    const booking = await db.collection('bookings').doc(bookingId).get();
    if (!booking.data) return { ok: false, reason: '预约不存在' };
    if (booking.data.openid !== OPENID) return { ok: false, reason: '只能取消自己的预约' };
    if (booking.data.status === 'canceled') return { ok: true, status: 'canceled' };

    await db.collection('bookings').doc(bookingId).update({
      data: {
        status: 'canceled',
        canceledAt: db.serverDate(),
        adminRead: false
      }
    });

    return { ok: true, status: 'canceled' };
  } catch (e) {
    return { ok: false, reason: e.message || String(e) };
  }
};
