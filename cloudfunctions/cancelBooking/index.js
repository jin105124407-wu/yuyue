const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

function buildCancelNoticeText(booking) {
  const userSnapshot = booking.userSnapshot || {};
  const customer = userSnapshot.nickname || '顾客';
  const phone = userSnapshot.phone ? `，电话${userSnapshot.phone}` : '';
  return [
    '取消预约提醒',
    `${customer}${phone}`,
    `已取消${booking.serviceName || '预约项目'}`,
    `原预约时间${booking.date || ''} ${booking.startTime || ''}`,
    `服务美容师${booking.staffName || '未指定'}`
  ].join('。');
}

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
        adminRead: false,
        voiceNoticeStatus: 'pending',
        voiceNoticeType: 'canceled',
        voiceNoticeText: buildCancelNoticeText(booking.data),
        voiceNoticePlayedAt: null,
        voiceNoticeError: ''
      }
    });

    return { ok: true, status: 'canceled' };
  } catch (e) {
    return { ok: false, reason: e.message || String(e) };
  }
};
