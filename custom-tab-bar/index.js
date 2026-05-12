// 自定义 tabbar，根据 openid 判断是否显示管理员菜单
const CUSTOMER_LIST = [
  { pagePath: '/pages/index/index', text: '首页' },
  { pagePath: '/pages/mall/mall', text: '商城' },
  { pagePath: '/pages/member-code/member-code', text: '会员码' },
  { pagePath: '/pages/points/points', text: '积分专区' },
  { pagePath: '/pages/mine/mine', text: '我的' }
];

const ADMIN_LIST = [
  { pagePath: '/pages/admin/home/home', text: '工作台', shortText: '工' },
  { pagePath: '/pages/admin/orders/orders', text: '订单', shortText: '订' },
  { pagePath: '/pages/admin/services/services', text: '项目', shortText: '项' },
  { pagePath: '/pages/admin/staff/staff', text: '美容师', shortText: '美' }
];

Component({
  data: {
    selected: 0,
    list: CUSTOMER_LIST,
    isAdmin: false
  },
  lifetimes: {
    attached() {
      this.refreshForRole();
    }
  },
  methods: {
    refreshForRole() {
      const isAdmin = !!wx.getStorageSync('isAdmin');
      const pages = getCurrentPages();
      const current = pages[pages.length - 1];
      const route = current && current.route ? '/' + current.route : '';
      const adminModeStored = wx.getStorageSync('adminMode');
      const adminMode = isAdmin && (
        adminModeStored === '' ||
        adminModeStored === undefined ||
        adminModeStored === true ||
        route.indexOf('/pages/admin/') === 0
      );
      const list = adminMode ? ADMIN_LIST : CUSTOMER_LIST;
      this.setData({ isAdmin: adminMode, list });
      this.syncSelected();
    },
    syncSelected() {
      const pages = getCurrentPages();
      const current = pages[pages.length - 1];
      if (!current) return;
      const route = '/' + current.route;
      const idx = this.data.list.findIndex(i => i.pagePath === route);
      if (idx >= 0 && idx !== this.data.selected) {
        this.setData({ selected: idx });
      }
    },
    onTap(e) {
      const i = Number(e.currentTarget.dataset.index);
      const item = this.data.list[i];
      if (!item) return;
      wx.switchTab({
        url: item.pagePath,
        fail: () => {
          wx.redirectTo({ url: item.pagePath });
        }
      });
      this.setData({ selected: i });
    }
  }
});
