Page({
  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().refreshForRole();
    }
  },
  goHome() {
    wx.switchTab({ url: '/pages/index/index' });
  }
});
