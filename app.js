// app.js
App({
  globalData: {
    openid: '',
    isAdmin: false,
    adminMode: false,
    userInfo: null,
    store: {
      name: '',
      address: '广东省深圳市南山区方大城T4栋13楼1306',
      phone: '13632684631',
      hours: '9:00-22:00',
      latitude: 22.556853755461958,
      longitude: 113.972840651337
    }
  },

  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
      return;
    }
    wx.cloud.init({
      env: 'cloud1-d7gs48grw3d10acea',
      traceUser: true
    });

    this.loginAndInit();
  },

  loginAndInit() {
    return wx.cloud.callFunction({ name: 'login' })
      .then(res => {
        const result = res.result || {};
        if (!result.ok || !result.openid) {
          throw new Error(result.reason || '登录初始化失败');
        }
        const { openid, isAdmin, user } = result;
        this.globalData.openid = openid;
        this.globalData.isAdmin = !!isAdmin;
        this.globalData.adminMode = wx.getStorageSync('adminMode') !== false && !!isAdmin;
        this.globalData.userInfo = wx.getStorageSync('userInfo') || null;
        wx.setStorageSync('openid', this.globalData.openid);
        wx.setStorageSync('isAdmin', this.globalData.isAdmin);

        const pages = getCurrentPages();
        const page = pages[pages.length - 1];
        if (page && typeof page.getTabBar === 'function' && page.getTabBar()) {
          page.getTabBar().refreshForRole();
        }
        return res.result;
      })
      .catch(err => {
        console.error('login failed', err);
      });
  }
});
