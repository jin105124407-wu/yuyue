Page({
  data: {
    balance: 260,
    activeTab: 'all',
    allList: [],
    filteredList: []
  },

  onLoad() {
    this.loadPointsRecord();
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
    this.filterList(tab);
  },

  filterList(tab) {
    let list = this.data.allList;
    if (tab === 'income') list = list.filter(i => i.type === 'income');
    else if (tab === 'expense') list = list.filter(i => i.type === 'expense');
    this.setData({ filteredList: list });
  },

  async loadPointsRecord() {
    // 模拟数据，实际应从云数据库读取
    const now = Date.now();
    const allList = [
      { _id: '1', type: 'income', amount: 100, reason: '奖励赠送-新用户注册', timeStr: '2026-04-22 14:32', createTime: now - 86400000 },
      { _id: '2', type: 'income', amount: 50, reason: '任务完成-预约到店', timeStr: '2026-04-21 10:15', createTime: now - 172800000 },
      { _id: '3', type: 'income', amount: 200, reason: '推荐奖励-好友消费', timeStr: '2026-04-19 16:45', createTime: now - 259200000 },
      { _id: '4', type: 'expense', amount: 50, reason: '兑换-商城优惠券', timeStr: '2026-04-20 11:20', createTime: now - 129600000 },
      { _id: '5', type: 'expense', amount: 100, reason: '兑换-服务项目体验', timeStr: '2026-04-18 09:30', createTime: now - 345600000 },
      { _id: '6', type: 'income', amount: 80, reason: '消费返积分-购物', timeStr: '2026-04-17 15:10', createTime: now - 432000000 },
      { _id: '7', type: 'income', amount: 30, reason: '奖励赠送-每日签到', timeStr: '2026-04-16 08:00', createTime: now - 518400000 },
      { _id: '8', type: 'expense', amount: 50, reason: '兑换-积分抽奖', timeStr: '2026-04-15 20:30', createTime: now - 604800000 }
    ];
    this.setData({ allList, filteredList: allList });
  }
});