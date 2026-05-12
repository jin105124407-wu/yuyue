Page({
  data: {
    today: '',
    customerCount: 0,
    orderCount: 0,
    income: 0,
    isAdmin: false,
    openid: '',
    adminTip: '',
    initializingAdmin: false
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().refreshForRole();
    }
    this.setData({
      isAdmin: !!wx.getStorageSync('isAdmin'),
      openid: wx.getStorageSync('openid') || ''
    });
    if (wx.getStorageSync('isAdmin')) {
      wx.setStorageSync('adminMode', true);
    }
    this.fetchStats();
  },

  async fetchStats() {
    if (!wx.getStorageSync('isAdmin')) return;
    try {
      const res = await wx.cloud.callFunction({ name: 'getAdminStats' });
      const r = res.result || {};
      if (r.ok) this.setData({
        today: r.today, customerCount: r.customerCount,
        orderCount: r.orderCount, income: r.income
      });
    } catch (e) { console.error(e); }
  },

  goOrders() { wx.switchTab({ url: '/pages/admin/orders/orders' }); },
  goVoice() { wx.navigateTo({ url: '/pages/admin/voice/voice' }); },
  goServices() { wx.switchTab({ url: '/pages/admin/services/services' }); },
  goStaff() { wx.switchTab({ url: '/pages/admin/staff/staff' }); },

  exitAdminMode() {
    wx.showModal({
      title: '退出后台',
      content: '退出后将回到普通用户首页，不会删除您的管理员权限。',
      confirmText: '退出',
      success: (res) => {
        if (!res.confirm) return;
        wx.setStorageSync('adminMode', false);
        const app = getApp();
        if (app && app.globalData) app.globalData.adminMode = false;
        wx.switchTab({
          url: '/pages/index/index',
          success: () => {
            const pages = getCurrentPages();
            const page = pages[pages.length - 1];
            if (page && typeof page.getTabBar === 'function' && page.getTabBar()) {
              page.getTabBar().refreshForRole();
            }
          }
        });
      }
    });
  },

  copyOpenid() {
    const openid = this.data.openid || wx.getStorageSync('openid') || '';
    if (!openid) {
      wx.showToast({ title: '暂无 openid', icon: 'none' });
      return;
    }
    wx.setClipboardData({ data: openid });
  },

  async initMeAdmin() {
    if (this.data.initializingAdmin) return;
    this.setData({ initializingAdmin: true, adminTip: '正在初始化管理员身份...' });
    try {
      const res = await wx.cloud.callFunction({
        name: 'seedData',
        data: { setMeAdmin: true }
      });
      const r = res.result || {};
      if (!r.ok) {
        this.setData({ adminTip: r.reason || '初始化失败，请检查 seedData 云函数。' });
        return;
      }
      const loginRes = await wx.cloud.callFunction({ name: 'login' });
      const login = loginRes.result || {};
      wx.setStorageSync('openid', login.openid || this.data.openid);
      wx.setStorageSync('isAdmin', !!login.isAdmin);
      this.setData({
        isAdmin: !!login.isAdmin,
        openid: login.openid || this.data.openid,
        adminTip: login.isAdmin ? '已成为管理员，可进入工作台。' : '未变为管理员：如果已有管理员，请手动把当前 openid 加入 admins 集合。'
      });
      if (typeof this.getTabBar === 'function' && this.getTabBar()) {
        this.getTabBar().refreshForRole();
      }
      if (login.isAdmin) this.fetchStats();
    } catch (e) {
      this.setData({ adminTip: '初始化失败，请确认 seedData 云函数已部署。' });
    } finally {
      this.setData({ initializingAdmin: false });
    }
  }
});
