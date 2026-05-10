const { getZodiac } = require('../../../utils/zodiac');

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

Page({
  data: {
    profile: {
      name: '',
      nickname: '',
      avatar: '',
      gender: '',
      phone: '',
      birthday: '',
      zodiac: ''
    },
    todayStr: todayStr(),
    canSave: false
  },

  onLoad() {
    this.loadUserProfile();
  },

  async loadUserProfile() {
    const openid = wx.getStorageSync('openid');
    if (!openid) return;
    const db = wx.cloud.database();
    const cached = wx.getStorageSync('userInfo') || null;
    const r = await db.collection('users').where({ openid }).limit(20).get();
    const u = this.pickBestUser(r.data, cached);
    if (u) {
      this.setData({
        profile: {
          name: u.name || '',
          nickname: u.nickname || '',
          avatar: u.avatar || '',
          gender: u.gender || '',
          phone: u.phone || u.purePhone || '',
          birthday: u.birthday || '',
          zodiac: u.zodiac || ''
        }
      });
      wx.setStorageSync('userInfo', u);
      this.checkCanSave();
    }
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

  onNameInput(e) {
    this.setData({ 'profile.name': e.detail.value });
    this.checkCanSave();
  },

  onNicknameInput(e) {
    this.setData({ 'profile.nickname': e.detail.value });
  },

  onNicknameBlur(e) {
    const val = (e.detail && e.detail.value) || '';
    if (val) this.setData({ 'profile.nickname': val });
  },

  onGenderSelect(e) {
    this.setData({ 'profile.gender': e.currentTarget.dataset.gender });
    this.checkCanSave();
  },

  onPhoneInput(e) {
    const phone = (e.detail.value || '').replace(/\D/g, '').slice(0, 11);
    this.setData({ 'profile.phone': phone });
    this.checkCanSave();
  },

  onBirthdayChange(e) {
    const birthday = e.detail.value;
    const zodiac = getZodiac(birthday);
    this.setData({ 'profile.birthday': birthday, 'profile.zodiac': zodiac });
    this.checkCanSave();
  },

  checkCanSave() {
    const p = this.data.profile;
    const canSave = !!(p.name && p.gender && p.phone && p.birthday);
    this.setData({ canSave });
  },

  chooseAvatar() {
    wx.chooseAvatar({
      success: (e) => {
        this.setData({ 'profile.avatar': e.avatarUrl });
      }
    });
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

  async onSave() {
    const p = this.data.profile;
    if (!p.name || !p.gender || !p.phone || !p.birthday) {
      wx.showToast({ title: '请填写必填项', icon: 'none' });
      return;
    }
    if (!/^1\d{10}$/.test(p.phone)) {
      wx.showToast({ title: '请填写正确手机号', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '保存中...' });
    try {
      const avatar = await this.ensureCloudAvatar(p.avatar);
      if (p.avatar && (!avatar || avatar.indexOf('http://tmp/') === 0)) {
        wx.showToast({ title: '头像保存失败，请重新选择', icon: 'none' });
        return;
      }
      const openid = wx.getStorageSync('openid');
      const db = wx.cloud.database();
      const r = await db.collection('users').where({ openid }).limit(20).get();
      const target = this.pickBestUser(r.data, wx.getStorageSync('userInfo') || null);
      if (target && target._id) {
        await db.collection('users').doc(target._id).update({
          data: {
            name: p.name,
            nickname: p.nickname,
            avatar,
            gender: p.gender,
            phone: p.phone,
            birthday: p.birthday,
            zodiac: p.zodiac
          }
        });
        wx.setStorageSync('userInfo', Object.assign({}, target, {
          name: p.name,
          nickname: p.nickname,
          avatar,
          gender: p.gender,
          phone: p.phone,
          birthday: p.birthday,
          zodiac: p.zodiac
        }));
      }
      wx.showToast({ title: '保存成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1500);
    } catch (e) {
      wx.showToast({ title: '保存失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  }
});
