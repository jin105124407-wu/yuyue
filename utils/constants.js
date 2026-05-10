// 预约时间表：4 行，每行若干个时间点
const TIME_ROWS = [
  ['08:30', '09:00', '09:30', '10:00', '10:30', '11:00'],
  ['11:30', '12:00', '12:30', '13:00', '13:30', '14:00'],
  ['14:30', '15:00', '15:30', '16:00', '16:30', '17:00'],
  ['17:30', '18:00', '18:30', '19:00', '19:30', '20:00']
];

// 默认不可预约时段
const DISABLED_SLOTS = ['08:30', '09:00', '19:30', '20:00'];

// 每个项目结束后的收拾与准备缓冲时间（分钟）
const BUFFER_MIN = 30;

// 一天最晚可服务到的时间（分钟）= 20:00 = 1200
const LAST_END_MIN = 20 * 60;

// 订单状态
const ORDER_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  DONE: 'done',
  CANCELED: 'canceled'
};

module.exports = {
  TIME_ROWS,
  DISABLED_SLOTS,
  BUFFER_MIN,
  LAST_END_MIN,
  ORDER_STATUS
};
