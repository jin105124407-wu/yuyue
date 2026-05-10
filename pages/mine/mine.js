Page({
  data: {
    user: null,
    bookings: [],
    activeBookingCount: 0,
    isLogged: false,
    displayName: '微信用户',
    displayLevel: '普通用户',
    displayAvatar: '/assets/images/login-avatar-eastern.png',
    displayPhone: '',
    showServiceModal: false
  },

  storeFallback: {
    name: 'Moyo Beauty',
    address: '广东省深圳市南山区方大城T4栋13楼1306',
    latitude: 22.556853755461958,
    longitude: 113.972840651337
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().refreshForRole();
    }
    this.loadMine();
  },

  async loadMine() {
    const openid = wx.getStorageSync('openid');
    const db = wx.cloud.database();
    let user = wx.getStorageSync('userInfo') || null;
    let bookings = [];

    if (!openid) {
      this.setLoggedOutState();
      return;
    }

    try {
      const res = await wx.cloud.callFunction({
        name: 'getMyBookings',
        data: { limit: 20 }
      });
      const r = res.result || {};
      if (r.ok) {
        bookings = r.list || [];
        if (!openid && r.openid) wx.setStorageSync('openid', r.openid);
      }
    } catch (e) {
      console.error(e);
      bookings = wx.getStorageSync('recentBookings') || [];
    }

    if (openid) {
      try {
        const u = await db.collection('users').where({ openid }).limit(20).get();
        user = this.pickBestUser(u.data, user);
        if (user) wx.setStorageSync('userInfo', user);
      } catch (e) {
        console.error(e);
      }
    }

    const isLogged = !!(user && (user.openid || user._openid || user.phone || user.nickname));
    const phone = user && user.phone ? String(user.phone) : '';
    const avatar = user && user.avatar && user.avatar.indexOf('http://tmp/') !== 0
      ? user.avatar
      : '/assets/images/login-avatar-eastern.png';

    this.setData({
      user,
      bookings,
      activeBookingCount: bookings.filter(item => item && item.status !== 'canceled').length,
      isLogged,
      displayName: user && user.nickname ? user.nickname : (isLogged ? '已登录用户' : '微信用户'),
      displayLevel: user && user.level ? user.level : '普通用户',
      displayAvatar: avatar,
      displayPhone: phone ? this.maskPhone(phone) : ''
    });
  },

  pickBestUser(list = [], fallback = null) {
    const candidates = list.concat(fallback ? [fallback] : []);
    if (!candidates.length) return fallback;
    return candidates.sort((a, b) => this.userScore(b) - this.userScore(a))[0];
  },

  userScore(user = {}) {
    let score = 0;
    if (user.nickname) score += 100;
    if (user.avatar) score += 40;
    if (user.phone || user.purePhone) score += 20;
    if (user.birthday) score += 10;
    if (user.updatedAt) score += 5;
    return score;
  },

  maskPhone(phone) {
    if (!phone || phone.length < 7) return phone;
    return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
  },

  goPointsDetail() {
    wx.navigateTo({ url: '/pages/points/points' });
  },

  goProfileEdit() {
    wx.navigateTo({ url: '/pages/mine/profile-edit/profile-edit' });
  },

  goBookingHistory() {
    wx.navigateTo({ url: '/pages/mine/booking-history/booking-history' });
  },

  goBooking() {
    wx.navigateTo({ url: '/pages/booking/booking' });
  },

  callService() {
    this.dialPhone('13632684631');
  },

  closeServiceModal() {
    this.setData({ showServiceModal: false });
  },

  stopBubble() {},

  callDirect() {
    this.dialPhone('13632684631');
    this.setData({ showServiceModal: false });
  },

  callStore() {
    const store = getApp().globalData.store || {};
    this.dialPhone(store.phone || '13632684631');
  },

  dialPhone(phoneNumber) {
    wx.makePhoneCall({
      phoneNumber,
      fail: () => wx.showToast({ title: `请拨打 ${phoneNumber}`, icon: 'none' })
    });
  },

  openMap() {
    const app = getApp();
    const store = (app.globalData && app.globalData.store) || {};
    const target = Object.assign({}, this.storeFallback, store);
    const latitude = Number(target.latitude);
    const longitude = Number(target.longitude);
    if (!latitude || !longitude) {
      wx.showToast({ title: '门店坐标未设置', icon: 'none' });
      return;
    }
    wx.openLocation({
      latitude,
      longitude,
      name: target.name || this.storeFallback.name,
      address: target.address || this.storeFallback.address
    });
  },

  showProfileTip() {
    wx.showToast({ title: '完善资料功能即将开放', icon: 'none' });
  },

  showReferralTip() {
    wx.showToast({ title: '推荐有礼功能即将开放', icon: 'none' });
  },

  showRewardTip() {
    wx.showToast({ title: '参与任务得奖励功能即将开放', icon: 'none' });
  },

  goMall() {
    wx.switchTab({ url: '/pages/mall/mall' });
  },

  goPoints() {
    wx.switchTab({ url: '/pages/points/points' });
  },

  setLoggedOutState() {
    this.setData({
      user: null,
      bookings: [],
      activeBookingCount: 0,
      isLogged: false,
      displayName: '微信用户',
      displayLevel: '普通用户',
      displayAvatar: '/assets/images/login-avatar-eastern.png',
      displayPhone: ''
    });
  },

  async onResetLogin() {
    const confirm = await new Promise(r => wx.showModal({
      title: '退出登录？',
      content: '将退出当前账号，本机需要重新授权后才能查看预约记录。',
      success: x => r(x.confirm)
    }));
    if (!confirm) return;

    const app = getApp();
    if (app && app.globalData) {
      app.globalData.openid = '';
      app.globalData.isAdmin = false;
      app.globalData.userInfo = null;
    }
    wx.removeStorageSync('openid');
    wx.removeStorageSync('isAdmin');
    wx.removeStorageSync('userInfo');
    wx.removeStorageSync('recentBookings');
    this.setLoggedOutState();
    wx.showToast({ title: '已退出登录', icon: 'none' });

    setTimeout(() => {
      wx.switchTab({ url: '/pages/index/index' });
    }, 800);
  }
});
