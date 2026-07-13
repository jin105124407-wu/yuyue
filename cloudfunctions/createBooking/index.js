// 云函数：createBooking —— 云端二次校验并写入 bookings
const cloud = require('wx-server-sdk');
const { buildOrderNo } = require('./orderNo');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const BUFFER_MIN = 30;
const LAST_END_MIN = 20 * 60;
const DISABLED_SLOTS = ['08:30', '09:00', '19:30', '20:00'];

function hhmmToMin(s) { const [h, m] = s.split(':').map(Number); return h * 60 + m; }
function minToHHmm(n) {
  const h = Math.floor(n / 60), m = n % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
function overlap(a1, a2, b1, b2) { return a1 < b2 && b1 < a2; }
function normalizeStaffName(name) { return !name || name === '小美老师' ? '芬芬' : name; }
function buildVoiceNoticeText(booking) {
  const customer = booking.userSnapshot.nickname || '顾客';
  const phone = booking.userSnapshot.phone ? `，电话${booking.userSnapshot.phone}` : '';
  const remark = booking.remark ? `，备注${booking.remark}` : '';
  return [
    '新预约提醒',
    `${customer}${phone}`,
    `预约${booking.serviceName}`,
    `时间${booking.date} ${booking.startTime}`,
    `服务美容师${booking.staffName}${remark}`
  ].join('。');
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { staffId, serviceId, date, startTime, remark } = event || {};

  if (!staffId || !serviceId || !date || !startTime) {
    return { ok: false, reason: '参数缺失' };
  }
  if (DISABLED_SLOTS.indexOf(startTime) >= 0) {
    return { ok: false, reason: '该时间段不可预约' };
  }

  // 取项目
  const serviceDoc = await db.collection('services').doc(serviceId).get().catch(() => null);
  if (!serviceDoc || !serviceDoc.data) return { ok: false, reason: '项目不存在' };
  const service = serviceDoc.data;
  const durationMin = service.durationMin;
  const startMin = hhmmToMin(startTime);
  const endMin = startMin + durationMin;
  if (endMin > LAST_END_MIN) {
    return { ok: false, reason: '时间不足，请选择其他时间段或日期哦' };
  }

  // 取美容师
  const staffDoc = await db.collection('staff').doc(staffId).get().catch(() => null);
  if (!staffDoc || !staffDoc.data) return { ok: false, reason: '美容师不存在' };

  // 同日同美容师冲突校验
  const existRes = await db.collection('bookings').where({
    date, staffId, status: _.in(['pending', 'confirmed', 'done'])
  }).get();
  const s1 = startMin;
  const e1 = startMin + durationMin + BUFFER_MIN;
  for (const b of existRes.data) {
    const bs = hhmmToMin(b.startTime);
    const be = bs + b.durationMin + BUFFER_MIN;
    if (overlap(s1, e1, bs, be)) {
      return { ok: false, reason: '时间不足，请选择其他时间段或日期哦' };
    }
  }

  // 取用户快照
  const userRes = await db.collection('users').where({ openid: OPENID }).limit(1).get();
  const user = userRes.data[0] || {};
  const orderNo = buildOrderNo(date);

  const bookingData = {
    orderNo,
    openid: OPENID,
    userSnapshot: {
      nickname: user.nickname || '',
      avatar: user.avatar || '',
      phone: user.phone || ''
    },
    staffId,
    staffName: normalizeStaffName(staffDoc.data.name),
    staffAvatar: staffDoc.data.avatar || '',
    serviceId,
    serviceName: service.name,
    durationMin,
    date,
    startTime,
    endTime: minToHHmm(endMin),
    remark: remark || '',
    status: 'pending',
    amount: service.price || 0,
    adminRead: false,
    voiceNoticeStatus: 'pending',
    voiceNoticeType: 'new',
    voiceNoticePlayedAt: null,
    createdAt: db.serverDate()
  };
  bookingData.voiceNoticeText = buildVoiceNoticeText(bookingData);

  const addRes = await db.collection('bookings').add({
    data: {
      ...bookingData
    }
  });

  return { ok: true, bookingId: addRes._id, orderNo };
};
