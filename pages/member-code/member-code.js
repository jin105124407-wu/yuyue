const { DEFAULT_AVATAR, displayAvatar, pickBestUser } = require('../../utils/user-display');

Page({
  data: {
    openid: '',
    nickname: '',
    displayAvatar: DEFAULT_AVATAR
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().refreshForRole();
    }
    const openid = wx.getStorageSync('openid') || '';
    const user = wx.getStorageSync('userInfo') || null;
    this.setData({
      openid,
      nickname: user && user.nickname ? user.nickname : '',
      displayAvatar: displayAvatar(user)
    });
    this.loadNick();
  },
  async loadNick() {
    if (!this.data.openid) return;
    const db = wx.cloud.database();
    try {
      const r = await db.collection('users').where({ openid: this.data.openid }).limit(1).get();
      const user = pickBestUser(r.data || [], wx.getStorageSync('userInfo') || null);
      if (user) {
        wx.setStorageSync('userInfo', user);
        this.setData({
          nickname: user.nickname || '',
          displayAvatar: displayAvatar(user)
        });
      }
    } catch (e) {
      console.warn('load member code user failed', e);
    }
  },
  goHome() {
    wx.switchTab({ url: '/pages/index/index' });
  }
});
