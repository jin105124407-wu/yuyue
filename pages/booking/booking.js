const { TIME_ROWS, DISABLED_SLOTS } = require('../../utils/constants');
const { buildDateList, validateBooking, buildUnavailableMap, hhmmToMin } = require('../../utils/time');

const BOOKING_TIME_ROWS = [
  { icon: 'sunrise', symbol: '◒', times: TIME_ROWS[0] },
  { icon: 'sun', symbol: '☼', times: TIME_ROWS[1] },
  { icon: 'sunset', symbol: '◐', times: TIME_ROWS[2] },
  { icon: 'cup', symbol: '♨', times: TIME_ROWS[3] }
];

const ALL_TIMES = TIME_ROWS.reduce((all, row) => all.concat(row), []);

const FALLBACK_SERVICES = [
  {
    _id: 'clean',
    name: '清洁补水',
    description: '清黑头、油脂、补水',
    durationMin: 60
  },
  {
    _id: 'water',
    name: '吨吨补水',
    description: '深层补水，仪器配合产品',
    durationMin: 60
  },
  {
    _id: 'bojin',
    name: '面部拨筋+眼部拨筋',
    description: '疏通经络，促进血液循环',
    durationMin: 90
  },
  {
    _id: 'sensitive',
    name: '敏肌屏障维养',
    description: '修复易敏皮肤',
    durationMin: 60
  },
  {
    _id: 'acne',
    name: '痘肌管理',
    description: '改善痘痘、粉刺',
    durationMin: 120
  },
  {
    _id: 'queen',
    name: '以色列 S 女王',
    description: '面部提拉紧致',
    durationMin: 60
  },
  {
    _id: 'white',
    name: '全身美白仓',
    description: '补水保湿，美白嫩肤',
    durationMin: 40
  },
  {
    _id: 'magnet',
    name: '5D 磁量子',
    description: '身体塑形，单部位',
    durationMin: 40
  },
  {
    _id: 'hair',
    name: '冰点脱毛',
    description: '针对全身',
    durationMin: 120
  },
  {
    _id: 'neck',
    name: '肩颈',
    description: '劳损、低头族护理',
    durationMin: 40
  }
];

function normalizeStaffName(name) {
  return !name || name === '小美老师' ? '芬芬' : name;
}

Page({
  data: {
    staff: [],
    currentStaff: null,
    services: [],
    dates: [],
    timeRows: BOOKING_TIME_ROWS,
    disabledSlots: DISABLED_SLOTS,
    selectedStaffId: '',
    selectedServiceId: '',
    selectedDate: '',
    selectedTime: '15:30',
    occupiedMap: {},   // { 'HH:mm': true }
    unavailableMap: {},
    existingBookings: [],
    remark: '',
    submitting: false,
    resultModal: null  // 成功弹窗数据
  },

  onLoad() {
    // 今天起连续 30 天，即一个月的可预约日期。
    const dates = buildDateList(29).map((item, index) => ({
      ...item,
      dayLabel: item.dayLabel || (index === 0 ? '今天' : item.dayNum),
      weekLabel: item.weekLabel || item.label
    }));
    this.setData({
      dates,
      selectedDate: dates[0].date,
      services: FALLBACK_SERVICES,
      selectedServiceId: FALLBACK_SERVICES[0]._id
    });
    this.fetchBookingData();
  },

  async fetchBookingData() {
    wx.showLoading({ title: '加载中' });
    try {
      const res = await wx.cloud.callFunction({
        name: 'getBookingData',
        data: { date: this.data.selectedDate, staffId: this.data.selectedStaffId }
      });
      const r = res.result || {};
      const staff = (r.staff || []).map(item => Object.assign({}, item, {
        name: normalizeStaffName(item.name)
      }));
      const services = (r.services && r.services.length) ? r.services : FALLBACK_SERVICES;
      const existingBookings = r.existingBookings || [];
      const patch = { staff, services, existingBookings };
      if (!this.data.selectedStaffId && staff.length > 0) {
        patch.selectedStaffId = r.selectedStaffId || staff[0]._id;
      }
      const nextStaffId = patch.selectedStaffId || this.data.selectedStaffId;
      patch.currentStaff = staff.find(item => item._id === nextStaffId) || null;
      const hasSelectedService = services.some(item => item._id === this.data.selectedServiceId);
      if ((!this.data.selectedServiceId || !hasSelectedService) && services.length > 0) {
        patch.selectedServiceId = services[0]._id;
      }
      this.setData(patch);
      this.computeOccupiedMap(existingBookings);
    } catch (e) {
      console.error(e);
      this.setData({
        services: FALLBACK_SERVICES,
        selectedServiceId: this.data.selectedServiceId || FALLBACK_SERVICES[0]._id,
        existingBookings: []
      });
      this.computeOccupiedMap([]);
      wx.showToast({ title: '已使用默认预约项目', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  computeOccupiedMap(existingBookings = []) {
    const occupied = {};
    existingBookings.forEach(b => {
      const s = hhmmToMin(b.startTime);
      const e = s + b.durationMin + 30;
      TIME_ROWS.forEach(row => row.forEach(t => {
      const tm = hhmmToMin(t);
        if (tm >= s && tm < e) occupied[t] = true;
      }));
    });
    const service = this.data.services.find(s => s._id === this.data.selectedServiceId);
    const unavailableMap = service
      ? buildUnavailableMap(ALL_TIMES, service.durationMin, existingBookings)
      : {};
    this.setData({ occupiedMap: occupied, unavailableMap });
  },

  onStaffTap(e) {
    const id = e.currentTarget.dataset.id;
    const currentStaff = this.data.staff.find(item => item._id === id) || null;
    this.setData({ selectedStaffId: id, currentStaff, selectedTime: '' });
    this.fetchBookingData();
  },

  onDateTap(e) {
    const date = e.currentTarget.dataset.date;
    this.setData({ selectedDate: date, selectedTime: '' });
    this.fetchBookingData();
  },

  onTimeTap(e) {
    const t = e.currentTarget.dataset.time;
    if (DISABLED_SLOTS.indexOf(t) >= 0) return;
    if (this.data.occupiedMap[t]) {
      wx.showToast({ title: '该时段已被预约', icon: 'none' });
      return;
    }
    if (this.data.unavailableMap[t]) {
      wx.showToast({ title: '时间不足，请选择其他时间段或日期哦', icon: 'none' });
      return;
    }
    this.setData({ selectedTime: t });
  },

  onServiceTap(e) {
    const id = e.currentTarget.dataset.id;
    const service = this.data.services.find(s => s._id === id);
    const unavailableMap = service
      ? buildUnavailableMap(ALL_TIMES, service.durationMin, this.data.existingBookings)
      : {};
    const patch = { selectedServiceId: id, unavailableMap };
    if (this.data.selectedTime && service) {
      const check = validateBooking(this.data.selectedTime, service.durationMin, this.data.existingBookings);
      if (!check.ok) {
        wx.showToast({ title: check.reason, icon: 'none' });
        patch.selectedTime = '';
      }
    }
    this.setData(patch);
  },

  onRemarkInput(e) {
    this.setData({ remark: e.detail.value });
  },

  async onSubmit() {
    const { selectedStaffId, selectedServiceId, selectedDate, selectedTime, services, staff, remark } = this.data;
    if (!selectedStaffId) return wx.showToast({ title: '请选择美容师', icon: 'none' });
    if (!selectedServiceId) return wx.showToast({ title: '请选择项目', icon: 'none' });
    if (!selectedDate || !selectedTime) return wx.showToast({ title: '请选择预约时间', icon: 'none' });

    const service = services.find(s => s._id === selectedServiceId);
    const preCheck = validateBooking(selectedTime, service.durationMin, this.data.existingBookings);
    if (!preCheck.ok) {
      wx.showModal({ title: '提示', content: preCheck.reason, showCancel: false });
      return;
    }

    this.setData({ submitting: true });
    try {
      const res = await wx.cloud.callFunction({
        name: 'createBooking',
        data: {
          staffId: selectedStaffId,
          serviceId: selectedServiceId,
          date: selectedDate,
          startTime: selectedTime,
          remark
        }
      });
      const r = res.result || {};
      if (!r.ok) {
        wx.showModal({ title: '预约失败', content: r.reason || '请稍后重试', showCancel: false });
        return;
      }
      const staffObj = staff.find(s => s._id === selectedStaffId) || {};
      const staffName = normalizeStaffName(staffObj.name);
      const staffAvatar = staffObj.avatar || '/assets/images/staff-fenfen.jpg';
      const app = getApp();
      const store = app.globalData.store || {};
      this.setData({
        resultModal: {
          bookingId: r.bookingId,
          orderNo: r.orderNo,
          date: selectedDate,
          startTime: selectedTime,
          staffName,
          staffAvatar,
          serviceName: service.name,
          durationMin: service.durationMin,
          phone: store.phone || '13632684631',
          address: store.address || ''
        }
      });
      this.cacheLatestBooking({
        _id: r.bookingId || `local-${Date.now()}`,
        orderNo: r.orderNo || '',
        openid: wx.getStorageSync('openid') || '',
        date: selectedDate,
        startTime: selectedTime,
        staffId: selectedStaffId,
        staffName,
        staffAvatar,
        serviceId: selectedServiceId,
        serviceName: service.name,
        durationMin: service.durationMin,
        remark: remark || '',
        status: 'pending',
        createdAtText: new Date().toISOString()
      });
      this.fetchBookingData();
    } catch (e) {
      console.error(e);
      wx.showToast({ title: '网络异常', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },

  closeResult() {
    this.setData({ resultModal: null, selectedTime: '' });
  },

  showReselectTip() {
    wx.showToast({ title: '请在下方左右滑动选择项目', icon: 'none' });
  },

  cacheLatestBooking(booking) {
    const list = wx.getStorageSync('recentBookings') || [];
    const next = [booking]
      .concat(list.filter(item => item && item._id !== booking._id))
      .slice(0, 10);
    wx.setStorageSync('recentBookings', next);
  },

  goBookingHistory() {
    wx.navigateTo({ url: '/pages/mine/booking-history/booking-history' });
  },

  goHome() {
    wx.switchTab({ url: '/pages/index/index' });
  }
});
