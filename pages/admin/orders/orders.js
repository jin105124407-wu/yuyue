const STATUS_TABS = [
  { key: '', label: '全部' },
  { key: 'pending', label: '待确认' },
  { key: 'confirmed', label: '已确认' },
  { key: 'done', label: '已完成' },
  { key: 'canceled', label: '已取消' }
];

let timer = null;
let audioCtx = null;
let lastUnread = -1;

Page({
  data: {
    tabs: STATUS_TABS,
    currentTab: '',
    list: [],
    loading: false
  },

  onLoad() {
    audioCtx = wx.createInnerAudioContext();
    audioCtx.src = '/assets/audio/new-order.mp3';
    this.fetchList();
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().refreshForRole();
    }
    this.startPolling();
  },

  onHide() { this.stopPolling(); },
  onUnload() {
    this.stopPolling();
    if (audioCtx) { audioCtx.destroy(); audioCtx = null; }
  },

  startPolling() {
    this.stopPolling();
    timer = setInterval(() => this.pollUnread(), 10000);
    this.pollUnread();
  },
  stopPolling() {
    if (timer) { clearInterval(timer); timer = null; }
  },

  async pollUnread() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'listOrders', data: { countUnread: true }
      });
      const r = res.result || {};
      const unread = r.unreadCount || 0;
      if (lastUnread >= 0 && unread > lastUnread) {
        // 有新订单，播放提示音并刷新列表
        if (audioCtx) { audioCtx.stop(); audioCtx.play(); }
        wx.showToast({ title: '叮咚，有新的预约信息来啦', icon: 'none' });
        this.fetchList();
      }
      lastUnread = unread;
      wx.setTabBarBadge && this.updateBadge(unread);
    } catch (e) { /* 忽略轮询错误 */ }
  },

  updateBadge(n) {
    // 可选：给 tabbar 设角标（自定义 tabbar 可扩展）
  },

  async fetchList() {
    this.setData({ loading: true });
    try {
      const res = await wx.cloud.callFunction({
        name: 'listOrders',
        data: { status: this.data.currentTab || undefined }
      });
      const r = res.result || {};
      this.setData({ list: r.list || [] });
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  onTabTap(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ currentTab: key });
    this.fetchList();
  },

  async onOrderTap(e) {
    const item = e.currentTarget.dataset.item;
    const actions = [];
    if (!item.adminRead) actions.push('标记已读');
    if (item.status === 'pending') actions.push('确认预约');
    if (item.status === 'confirmed') actions.push('标记完成');
    if (['pending', 'confirmed'].indexOf(item.status) >= 0) actions.push('取消预约');
    actions.push('拨打顾客电话');

    wx.showActionSheet({
      itemList: actions,
      success: (res) => {
        const pick = actions[res.tapIndex];
        if (pick === '标记已读') this.updateOrder(item._id, { markRead: true });
        else if (pick === '确认预约') this.updateOrder(item._id, { status: 'confirmed', markRead: true });
        else if (pick === '标记完成') this.updateOrder(item._id, { status: 'done' });
        else if (pick === '取消预约') this.updateOrder(item._id, { status: 'canceled' });
        else if (pick === '拨打顾客电话') {
          const phone = (item.userSnapshot && item.userSnapshot.phone) || '';
          if (phone) wx.makePhoneCall({ phoneNumber: phone });
          else wx.showToast({ title: '顾客未填手机号', icon: 'none' });
        }
      }
    });
  },

  async updateOrder(bookingId, payload) {
    await wx.cloud.callFunction({
      name: 'updateOrder',
      data: Object.assign({ bookingId }, payload)
    });
    this.fetchList();
    this.pollUnread();
  },

  async onMarkAll() {
    await wx.cloud.callFunction({ name: 'updateOrder', data: { markAllRead: true } });
    this.fetchList();
    this.pollUnread();
  }
});
