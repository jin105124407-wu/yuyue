Page({
  data: {
    list: [],
    editing: null // { _id?, name, description, durationMin, price, enabled }
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().refreshForRole();
    }
    this.fetchList();
  },

  async fetchList() {
    const db = wx.cloud.database();
    const res = await db.collection('services').orderBy('sortOrder', 'asc').get();
    this.setData({ list: res.data });
  },

  onAdd() {
    this.setData({ editing: { name: '', description: '', durationMin: 60, price: 0, enabled: true } });
  },
  onEdit(e) {
    const item = e.currentTarget.dataset.item;
    this.setData({ editing: Object.assign({}, item) });
  },
  onCancel() { this.setData({ editing: null }); },

  onInput(e) {
    const key = e.currentTarget.dataset.key;
    let val = e.detail.value;
    if (key === 'durationMin' || key === 'price') val = Number(val) || 0;
    this.setData({ [`editing.${key}`]: val });
  },

  onToggleEnabled(e) {
    this.setData({ 'editing.enabled': e.detail.value });
  },

  async onSave() {
    const ed = this.data.editing;
    if (!ed.name) { wx.showToast({ title: '请填写名称', icon: 'none' }); return; }
    const payload = {
      name: ed.name,
      description: ed.description || '',
      durationMin: Number(ed.durationMin) || 0,
      price: Number(ed.price) || 0,
      enabled: ed.enabled !== false
    };
    const action = ed._id ? 'update' : 'create';
    await wx.cloud.callFunction({
      name: 'manageService',
      data: { collection: 'services', action, id: ed._id, data: payload }
    });
    wx.showToast({ title: '已保存' });
    this.setData({ editing: null });
    this.fetchList();
  },

  async onRemove(e) {
    const id = e.currentTarget.dataset.id;
    const confirm = await new Promise(r => wx.showModal({ title: '确认删除？', content: '删除后不可恢复', success: x => r(x.confirm) }));
    if (!confirm) return;
    await wx.cloud.callFunction({
      name: 'manageService',
      data: { collection: 'services', action: 'remove', id }
    });
    this.fetchList();
  }
});
