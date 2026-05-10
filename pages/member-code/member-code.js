Page({
  data: { openid: '', nickname: '' },
  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().refreshForRole();
    }
    const openid = wx.getStorageSync('openid') || '';
    this.setData({ openid });
    this.loadNick();
  },
  async loadNick() {
    const db = wx.cloud.database();
    const r = await db.collection('users').where({ openid: this.data.openid }).limit(1).get();
    if (r.data[0]) this.setData({ nickname: r.data[0].nickname });
  },
  goHome() {
    wx.switchTab({ url: '/pages/index/index' });
  }
});
