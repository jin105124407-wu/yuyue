const app = getApp();
const { getZodiac } = require('../../utils/zodiac');

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

Page({
  data: {
    banners: [],
    storyImages: [],
    store: {},
    userInfo: null,
    logged: false,
    agreePrivacy: false,
    phoneAuthTip: '',
    focusPhone: false,
    todayStr: todayStr()
  },

  onLoad() { this.loadData(); },

  safeAvatar(avatar) {
    if (!avatar || avatar.indexOf('http://tmp/') === 0) return '';
    return avatar;
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().refreshForRole();
    }
    this.refreshUser();
  },

  async loadData() {
    const db = wx.cloud.database();
    try {
      const [bannerRes, storeRes] = await Promise.all([
        db.collection('banners').where({ enabled: true }).orderBy('sortOrder', 'asc').get(),
        db.collection('store').limit(1).get()
      ]);
      const store = storeRes.data[0] || {};
      this.setData({
        banners: bannerRes.data,
        store,
        storyImages: store.storyImages || []
      });
      app.globalData.store = store;
    } catch (e) { console.log('loadData error', e); }
  },

  async refreshUser() {
    const openid = wx.getStorageSync('openid');
    if (!openid) { this.setData({ logged: false, userInfo: null }); return; }
    const cachedUser = wx.getStorageSync('userInfo');
    if (cachedUser && cachedUser.nickname) {
      cachedUser.avatar = this.safeAvatar(cachedUser.avatar);
      this.setData({ logged: true, userInfo: cachedUser });
    }
    const db = wx.cloud.database();
    try {
      const r = await db.collection('users').where({ openid }).limit(1).get();
      const u = r.data[0];
      if (u && u.nickname) {
        u.avatar = this.safeAvatar(u.avatar);
        wx.setStorageSync('userInfo', u);
        this.setData({ logged: true, userInfo: u });
      } else if (!cachedUser) {
        this.setData({ logged: false, userInfo: u || null });
      }
    } catch (e) {
      console.warn('refreshUser failed', e);
      if (!cachedUser) this.setData({ logged: false, userInfo: null });
    }
  },

  onChooseAvatar(e) {
    const avatarUrl = e.detail.avatarUrl;
    const u = this.data.userInfo || {};
    this.setData({ userInfo: Object.assign({}, u, { avatar: avatarUrl }) });
  },

  onNicknameInput(e) {
    const u = this.data.userInfo || {};
    this.setData({ userInfo: Object.assign({}, u, { nickname: e.detail.value }) });
  },

  // 关键：微信"使用微信昵称"建议条只会在 input 失焦时把值塞进来
  onNicknameBlur(e) {
    const val = (e.detail && e.detail.value) || '';
    if (!val) return;
    const u = this.data.userInfo || {};
    this.setData({ userInfo: Object.assign({}, u, { nickname: val }) });
  },

  ensurePrivacyAuthorize() {
    if (typeof wx.requirePrivacyAuthorize !== 'function') {
      return Promise.resolve(true);
    }
    return new Promise(resolve => {
      wx.requirePrivacyAuthorize({
        success: () => resolve(true),
        fail: () => resolve(false)
      });
    });
  },

  onPickBirthday(e) {
    const birthday = e.detail.value;
    const zodiac = getZodiac(birthday);
    const u = this.data.userInfo || {};
    this.setData({ userInfo: Object.assign({}, u, { birthday, zodiac }) });
    wx.showModal({
      title: '确认生日',
      content: `出生日期：${birthday}\n对应星座：${zodiac}\n确认无误后点击"确定"`,
      success: (r) => {
        if (!r.confirm) {
          const u2 = this.data.userInfo || {};
          this.setData({ userInfo: Object.assign({}, u2, { birthday: '', zodiac: '' }) });
        }
      }
    });
  },

  async onGetPhone(e) {
    const privacyOk = await this.ensurePrivacyAuthorize();
    if (!privacyOk) {
      this.setData({
        focusPhone: true,
        phoneAuthTip: '请同意隐私授权，或前往登录页手动输入手机号'
      });
      wx.showToast({ title: '请手动输入手机号', icon: 'none' });
      return;
    }
    const detail = e.detail || {};
    if (detail.errMsg && detail.errMsg.indexOf('ok') < 0) {
      this.setData({
        focusPhone: true,
        phoneAuthTip: '你取消了手机号授权，请前往登录页手动输入手机号'
      });
      wx.showToast({ title: '请手动输入手机号', icon: 'none' });
      return;
    }
    if (!detail.code) {
      this.setData({
        focusPhone: true,
        phoneAuthTip: '微信未返回手机号授权，请前往登录页手动输入手机号'
      });
      wx.showToast({ title: '请手动输入手机号', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '获取中' });
    try {
      const res = await wx.cloud.callFunction({
        name: 'getPhoneNumber', data: { code: detail.code }
      });
      const r = res.result || {};
      if (!r.ok) {
        this.setData({
          focusPhone: true,
          phoneAuthTip: r.reason ? `手机号授权失败：${r.reason}` : '手机号授权暂不可用，请前往登录页手动输入手机号'
        });
        wx.showToast({ title: '请手动输入手机号', icon: 'none' });
        return;
      }
      const u = this.data.userInfo || {};
      this.setData({
        userInfo: Object.assign({}, u, { phone: r.phone, purePhone: r.purePhone }),
        phoneAuthTip: '',
        focusPhone: false
      });
    } catch (err) {
      this.setData({
        focusPhone: true,
        phoneAuthTip: '网络异常，请前往登录页手动输入手机号'
      });
      wx.showToast({ title: '请手动输入手机号', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  onTogglePrivacy() {
    this.setData({ agreePrivacy: !this.data.agreePrivacy });
  },

  openPrivacy() {
    wx.navigateTo({ url: '/pages/privacy/privacy' });
  },

  onLoginFormSubmit(e) {
    const formNickname = (e.detail && e.detail.value && e.detail.value.nickname) || '';
    const u = this.data.userInfo || {};
    const nickname = formNickname || u.nickname || '';
    return this.doLogin({
      nickname,
      avatar: u.avatar || '',
      phone: u.phone || '',
      birthday: u.birthday || '',
      zodiac: u.zodiac || ''
    });
  },

  async doLogin(profile) {
    if (!profile.nickname) { wx.showToast({ title: '请填写昵称', icon: 'none' }); return; }
    if (!profile.phone) { wx.showToast({ title: '请授权手机号', icon: 'none' }); return; }
    if (!profile.birthday) { wx.showToast({ title: '请选择出生日期', icon: 'none' }); return; }
    if (!this.data.agreePrivacy) {
      wx.showToast({ title: '请先勾选同意隐私条款', icon: 'none' });
      return;
    }

    const openid = wx.getStorageSync('openid');
    const db = wx.cloud.database();
    const exist = await db.collection('users').where({ openid }).limit(1).get();
    const payload = {
      nickname: profile.nickname,
      avatar: profile.avatar,
      phone: profile.phone,
      birthday: profile.birthday,
      zodiac: profile.zodiac,
      privacyAgreed: true,
      privacyAgreedAt: db.serverDate()
    };
    if (exist.data.length) {
      await db.collection('users').doc(exist.data[0]._id).update({ data: payload });
    } else {
      await db.collection('users').add({
        data: Object.assign({ openid, level: '普通会员', totalSpent: 0, createdAt: db.serverDate() }, payload)
      });
    }
    wx.showToast({ title: '登录成功' });
    this.refreshUser();
  },

  goLogin() {
    if (this.data.logged) {
      wx.showToast({ title: '您已登录', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/login/login' });
  },

  goBooking() { wx.navigateTo({ url: '/pages/booking/booking' }); },
  goReferral() { wx.showToast({ title: '推荐有礼功能即将开放', icon: 'none' }); },
  goReward() { wx.showToast({ title: '参与任务得奖励功能即将开放', icon: 'none' }); },
  goPoints() { wx.switchTab({ url: '/pages/points/points' }); },

  callStore() {
    const phone = (this.data.store && this.data.store.phone) || '13632684631';
    wx.makePhoneCall({ phoneNumber: phone });
  },

  openMap() {
    const s = this.data.store || {};
    if (!s.latitude || !s.longitude) {
      wx.showToast({ title: '门店坐标未设置', icon: 'none' });
      return;
    }
    wx.openLocation({
      latitude: s.latitude, longitude: s.longitude,
      name: s.name, address: s.address
    });
  }
});
