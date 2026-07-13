// 时间段工具
const { BUFFER_MIN, LAST_END_MIN, DISABLED_SLOTS } = require('./constants');

function hhmmToMin(hhmm) {
  if (!hhmm) return 0;
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function minToHHmm(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// 给定开始时间与时长（分），计算结束时间（含 30 min 缓冲前）
function computeEnd(startHHmm, durationMin) {
  return minToHHmm(hhmmToMin(startHHmm) + durationMin);
}

// 占用区间（含缓冲）
function occupiedRange(startHHmm, durationMin) {
  const s = hhmmToMin(startHHmm);
  const e = s + durationMin + BUFFER_MIN;
  return [s, e];
}

// 两个区间是否重叠 [a1,a2) 与 [b1,b2)
function overlap(a1, a2, b1, b2) {
  return a1 < b2 && b1 < a2;
}

/**
 * 判断某预约是否合法
 * @param {string} startHHmm 起始时间
 * @param {number} durationMin 项目时长（分钟）
 * @param {Array<{startTime:string, durationMin:number}>} existing 同日同美容师已有订单
 * @returns {{ok: boolean, reason?: string}}
 */
function validateBooking(startHHmm, durationMin, existing = []) {
  if (!startHHmm || !durationMin) return { ok: false, reason: '请选择项目和时间' };
  if (DISABLED_SLOTS.indexOf(startHHmm) >= 0) {
    return { ok: false, reason: '该时间段不可预约' };
  }
  const startMin = hhmmToMin(startHHmm);
  const endMin = startMin + durationMin;
  if (endMin > LAST_END_MIN) {
    return { ok: false, reason: '时间不足，请选择其他时间段或日期哦' };
  }
  const [s, e] = occupiedRange(startHHmm, durationMin);
  for (const o of existing) {
    const [os, oe] = occupiedRange(o.startTime, o.durationMin);
    if (overlap(s, e, os, oe)) {
      return { ok: false, reason: '时间不足，请选择其他时间段或日期哦' };
    }
  }
  return { ok: true };
}

function buildUnavailableMap(times = [], durationMin, existing = []) {
  const out = {};
  times.forEach(time => {
    out[time] = !validateBooking(time, durationMin, existing).ok;
  });
  return out;
}

// 生成今天 + 未来 N 天的日期列表
function buildDateList(days = 30) {
  const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const out = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i <= days; i++) {
    const d = new Date(today.getTime() + i * 86400000);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    out.push({
      date: `${y}-${m}-${day}`,
      label: WEEK[d.getDay()],
      dayLabel: i === 0 ? '今天' : `${Number(m)}/${Number(day)}`,
      weekLabel: WEEK[d.getDay()],
      dayNum: `${Number(m)}/${Number(day)}`
    });
  }
  return out;
}

module.exports = {
  hhmmToMin,
  minToHHmm,
  computeEnd,
  occupiedRange,
  validateBooking,
  buildUnavailableMap,
  buildDateList
};
