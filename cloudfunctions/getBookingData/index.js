// 云函数：getBookingData
// 入参 { date, staffId }
// 返回 { staff[], services[], existingBookings[] }
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

function normalizeStaffName(name) {
  return !name || name === '小美老师' ? '芬芬' : name;
}

exports.main = async (event) => {
  const { date, staffId } = event || {};

  const [staffRes, serviceRes] = await Promise.all([
    db.collection('staff').where({ enabled: _.neq(false) }).orderBy('sortOrder', 'asc').get(),
    db.collection('services').where({ enabled: _.neq(false) }).orderBy('sortOrder', 'asc').get()
  ]);

  let existingBookings = [];
  if (date && staffId) {
    const bookingRes = await db.collection('bookings').where({
      date,
      staffId,
      status: _.in(['pending', 'confirmed', 'done'])
    }).field({ startTime: true, durationMin: true, endTime: true }).get();
    existingBookings = bookingRes.data;
  }

  return {
    staff: (staffRes.data || []).map(item => ({
      ...item,
      name: normalizeStaffName(item.name)
    })),
    services: serviceRes.data,
    existingBookings
  };
};
