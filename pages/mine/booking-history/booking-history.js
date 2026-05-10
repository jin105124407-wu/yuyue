Page({
  data: {
    activeTab: 'booked',
    allList: [],
    filteredList: []
  },

  onLoad() {
    this.loadBookings();
  },

  onShow() {
    this.loadBookings();
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
    this.filterList(tab);
  },

  filterList(tab) {
    let list = this.data.allList;
    if (tab === 'booked') list = list.filter(i => i.status === 'pending' || i.status === 'confirmed');
    else if (tab === 'canceled') list = list.filter(i => i.status === 'canceled');
    this.setData({ filteredList: list });
  },

  async loadBookings() {
    const openid = wx.getStorageSync('openid');
    try {
      const res = await wx.cloud.callFunction({
        name: 'getMyBookings',
        data: { limit: 50 }
      });
      const r = res.result || {};
      if (!r.ok) {
        throw new Error(r.reason || '读取预约失败');
      }
      if (!openid && r.openid) {
        wx.setStorageSync('openid', r.openid);
      }
      this.mergeAndSetList(r.list || []);
    } catch (e) {
      console.error(e);
      wx.showToast({ title: '已显示本地预约记录', icon: 'none' });
      this.mergeAndSetList([]);
    }
  },

  mergeAndSetList(cloudList) {
    const localList = wx.getStorageSync('recentBookings') || [];
    const map = {};
    cloudList.concat(localList).forEach(item => {
      if (!item) return;
      const key = item._id || `${item.date}-${item.startTime}-${item.serviceName}`;
      if (!map[key]) {
        map[key] = Object.assign({
          staffName: '芬芬',
          staffAvatar: '/assets/images/staff-fenfen.jpg'
        }, item, {
          staffName: this.normalizeStaffName(item.staffName),
          staffAvatar: item.staffAvatar || '/assets/images/staff-fenfen.jpg',
          displayOrderNo: item.orderNo || this.buildDisplayOrderNo(item)
        });
      }
    });
    const list = Object.keys(map).map(key => map[key]).sort((a, b) => {
      const av = a.createdAtText || a.createdAt || '';
      const bv = b.createdAtText || b.createdAt || '';
      return String(bv).localeCompare(String(av));
    });
    this.setData({ allList: list });
    this.filterList(this.data.activeTab);
  },

  normalizeStaffName(name) {
    if (!name || name === '小美老师') return '芬芬';
    return name;
  },

  buildDisplayOrderNo(item = {}) {
    const datePart = String(item.date || '').replace(/\D/g, '') || this.datePartFromCreatedAt(item.createdAt || item.createdAtText);
    const idPart = String(item._id || '').slice(-6).toUpperCase();
    return `MOYO${datePart}${idPart}`;
  },

  datePartFromCreatedAt(value) {
    if (!value) return '';
    const str = String(value);
    const match = str.match(/\d{4}-\d{2}-\d{2}/);
    return match ? match[0].replace(/\D/g, '') : '';
  },

  showDetailTip() {
    wx.showToast({ title: '预约详情功能待接入', icon: 'none' });
  },

  async cancelBooking(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '取消预约',
      content: '确认取消当前预约吗？取消后可在已取消中查看。',
      success: async (res) => {
        if (res.confirm) {
          if (id) {
            wx.showLoading({ title: '取消中' });
            try {
              const cancelRes = await wx.cloud.callFunction({
                name: 'cancelBooking',
                data: { bookingId: id }
              });
              const r = cancelRes.result || {};
              if (!r.ok) {
                wx.showToast({ title: r.reason || '取消失败', icon: 'none' });
                return;
              }
              this.markLocalCanceled(id);
              wx.showToast({ title: '预约已取消', icon: 'none' });
            } catch (err) {
              console.error(err);
              wx.showToast({ title: '取消失败，请稍后重试', icon: 'none' });
            } finally {
              wx.hideLoading();
            }
          }
        }
      }
    });
  },

  markLocalCanceled(id) {
    const recent = wx.getStorageSync('recentBookings') || [];
    wx.setStorageSync('recentBookings', recent.map(item => (
      item && item._id === id ? Object.assign({}, item, { status: 'canceled' }) : item
    )));
    this.mergeAndSetList(this.data.allList.map(item => (
      item && item._id === id ? Object.assign({}, item, { status: 'canceled' }) : item
    )));
  },

  goBooking() {
    wx.navigateTo({ url: '/pages/booking/booking' });
  }
});
