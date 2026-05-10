Page({
  data: {
    today: '', customerCount: 0, orderCount: 0, income: 0, isAdmin: false
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().refreshForRole();
    }
    this.setData({ isAdmin: !!wx.getStorageSync('isAdmin') });
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
  goServices() { wx.switchTab({ url: '/pages/admin/services/services' }); },
  goStaff() { wx.switchTab({ url: '/pages/admin/staff/staff' }); }
});
