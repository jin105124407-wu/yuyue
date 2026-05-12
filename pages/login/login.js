const { getZodiac } = require('../../utils/zodiac');
const { ensureLogin } = require('../../utils/auth');

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

Page({
  data: {
    step: 1,           // 1=手机号 2=生日 3=头像昵称
    profile: {
      phone: '', purePhone: '',
      birthday: '', zodiac: '',
      avatar: '', nickname: ''
    },
    agreePrivacy: false,
    isPhoneValid: false,
    focusPhone: false,
    phoneAuthTip: '',
    todayStr: todayStr(),
    submitting: false,
    appName: '美容院'
  },

  onLoad() {
    this.updateNavTitle();
  },

  updateNavTitle() {
    wx.setNavigationBarTitle({ title: '登录' });
  },

  setStep(step) {
    this.setData({ step });
    this.updateNavTitle();
  },

  onPhoneInput(e) {
    const phone = ((e.detail && e.detail.value) || '').replace(/\D/g, '').slice(0, 11);
    const isPhoneValid = /^1\d{10}$/.test(phone);
    this.setData({
      'profile.phone': phone,
      'profile.purePhone': phone,
      isPhoneValid,
      phoneAuthTip: ''
    });
    if (phone.length === 11) {
      wx.hideKeyboard();
    }
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

  async onGetPhone(e) {
    if (!this.data.agreePrivacy) {
      wx.showToast({ title: '请先勾选隐私条款', icon: 'none' });
      return;
    }
    const privacyOk = await this.ensurePrivacyAuthorize();
    if (!privacyOk) {
      this.setData({
        focusPhone: true,
        phoneAuthTip: '请同意隐私授权，或手动输入手机号继续'
      });
      wx.showToast({ title: '请手动输入手机号', icon: 'none' });
      return;
    }
    const detail = e.detail || {};
    if (!detail.code) {
      console.warn('getPhoneNumber failed', detail);
      const errMsg = detail.errMsg || '';
      const tip = errMsg.indexOf('deny') >= 0 || errMsg.indexOf('cancel') >= 0
        ? '你取消了手机号授权，请手动输入手机号继续'
        : '微信未返回手机号授权，请手动输入手机号继续';
      this.setData({
        focusPhone: true,
        phoneAuthTip: tip
      });
      wx.showToast({ title: '请手动输入手机号', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '获取中' });
    try {
      const res = await wx.cloud.callFunction({
        name: 'getPhoneNumber',
        data: { code: detail.code }
      });
      const r = res.result || {};
      if (!r.ok || !r.phone) {
        console.warn('getPhoneNumber cloud failed', r);
        this.setData({
          focusPhone: true,
          phoneAuthTip: r.reason ? `手机号授权失败：${r.reason}` : '手机号授权暂不可用，请手动输入手机号继续'
        });
        wx.showToast({ title: '请手动输入手机号', icon: 'none' });
        return;
      }
      this.setData({
        'profile.phone': r.phone,
        'profile.purePhone': r.purePhone,
        isPhoneValid: true,
        focusPhone: false,
        phoneAuthTip: ''
      });
      this.setStep(2);
    } catch (err) {
      console.error(err);
      this.setData({
        focusPhone: true,
        phoneAuthTip: '网络异常，请手动输入手机号继续'
      });
      wx.showToast({ title: '请手动输入手机号', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  confirmPhone() {
    if (!this.data.agreePrivacy) {
      wx.showToast({ title: '请先勾选同意隐私条款', icon: 'none' });
      return;
    }
    const phone = this.data.profile.purePhone || this.data.profile.phone || '';
    if (!/^1\d{10}$/.test(phone)) {
      wx.showToast({ title: '请输入正确手机号', icon: 'none' });
      return;
    }
    this.setStep(2);
  },

  // ========= 步骤 2：出生日期 =========
  onPickBirthday(e) {
    const birthday = e.detail.value;
    const zodiac = getZodiac(birthday);
    this.setData({ 'profile.birthday': birthday, 'profile.zodiac': zodiac });
  },

  confirmBirthday() {
    const p = this.data.profile;
    if (!p.birthday) {
      wx.showToast({ title: '请选择出生日期', icon: 'none' });
      return;
    }
    wx.showModal({
      title: '确认生日',
      content: `出生日期：${p.birthday}\n星座：${p.zodiac}\n确认后进入「头像昵称」步骤`,
      success: (r) => {
        if (r.confirm) this.setStep(3);
      }
    });
  },

  backStep() {
    if (this.data.step > 1) this.setStep(this.data.step - 1);
  },

  setStep3() {
    this.setStep(3);
  },

  // ========= 步骤 3：头像 + 昵称 =========
  onChooseAvatar(e) {
    this.setData({ 'profile.avatar': e.detail.avatarUrl });
  },

  async ensureCloudAvatar(filePath) {
    if (!filePath || filePath.indexOf('cloud://') === 0) return filePath || '';
    if (filePath.indexOf('/assets/') === 0) return filePath;
    const openid = wx.getStorageSync('openid') || `guest-${Date.now()}`;
    const extMatch = filePath.match(/\.(png|jpg|jpeg|webp)$/i);
    const ext = extMatch ? extMatch[1].toLowerCase() : 'jpg';
    const cloudPath = `users/avatar/${openid}-${Date.now()}.${ext}`;
    const up = await wx.cloud.uploadFile({ cloudPath, filePath });
    return up.fileID;
  },

  onNicknameInput(e) {
    this.setData({ 'profile.nickname': e.detail.value });
  },

  onNicknameBlur(e) {
    const val = (e.detail && e.detail.value) || '';
    if (val) this.setData({ 'profile.nickname': val });
  },

  onTogglePrivacy() {
    this.setData({ agreePrivacy: !this.data.agreePrivacy });
  },

  openPrivacy() {
    wx.navigateTo({ url: '/pages/privacy/privacy' });
  },

  goHome() {
    wx.switchTab({ url: '/pages/index/index' });
  },

  // 通过表单提交拿到微信回填的 nickname
  async onSubmitForm(e) {
    const formNickname = (e.detail && e.detail.value && e.detail.value.nickname) || '';
    const p = this.data.profile;
    const nickname = formNickname || p.nickname || '';
    const avatarInput = p.avatar || '/assets/images/login-avatar-eastern.png';

    if (!nickname) { wx.showToast({ title: '请填写昵称', icon: 'none' }); return; }
    if (!this.data.agreePrivacy) {
      wx.showToast({ title: '请勾选同意隐私条款', icon: 'none' }); return;
    }

    this.setData({ submitting: true });
    try {
      await ensureLogin();
      const avatar = await this.ensureCloudAvatar(avatarInput);
      if (!avatar || avatar.indexOf('http://tmp/') === 0) {
        wx.showToast({ title: '头像保存失败，请重新选择', icon: 'none' });
        return;
      }
      const res = await wx.cloud.callFunction({
        name: 'login',
        data: {
          profile: {
            nickname,
            avatar,
            phone: p.phone,
            purePhone: p.purePhone || p.phone,
            birthday: p.birthday,
            zodiac: p.zodiac,
            privacyAgreed: true
          }
        }
      });
      const r = res.result || {};
      if (!r.ok || !r.openid) {
        wx.showToast({ title: r.reason || '保存失败', icon: 'none' });
        return;
      }
      const savedUser = r.user || {
        openid: r.openid,
        nickname,
        avatar: avatar || '',
        phone: p.phone,
        purePhone: p.purePhone || p.phone,
        birthday: p.birthday,
        zodiac: p.zodiac,
        level: '普通会员'
      };
      const app = getApp();
      app.globalData.openid = r.openid;
      app.globalData.isAdmin = !!r.isAdmin;
      app.globalData.userInfo = savedUser;
      wx.setStorageSync('openid', app.globalData.openid);
      wx.setStorageSync('isAdmin', app.globalData.isAdmin);
      wx.setStorageSync('userInfo', savedUser);
      wx.showToast({ title: '登录成功' });
      setTimeout(() => {
        wx.switchTab({ url: '/pages/index/index' });
      }, 800);
    } catch (err) {
      console.error(err);
      wx.showToast({ title: '保存失败', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  }
});
