Page({
  data: { list: [], editing: null },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().refreshForRole();
    }
    this.fetchList();
  },

  async fetchList() {
    const db = wx.cloud.database();
    const res = await db.collection('staff').orderBy('sortOrder', 'asc').get();
    this.setData({ list: res.data });
  },

  onAdd() {
    this.setData({ editing: { name: '', avatar: '', enabled: true, sortOrder: this.data.list.length } });
  },
  onEdit(e) {
    this.setData({ editing: Object.assign({}, e.currentTarget.dataset.item) });
  },
  onCancel() { this.setData({ editing: null }); },

  onInput(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ [`editing.${key}`]: e.detail.value });
  },
  onToggleEnabled(e) { this.setData({ 'editing.enabled': e.detail.value }); },

  async onChooseAvatar() {
    const pick = await wx.chooseMedia({ count: 1, mediaType: ['image'], sizeType: ['compressed'] });
    const file = pick.tempFiles[0];
    const cloudPath = `staff/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const up = await wx.cloud.uploadFile({ cloudPath, filePath: file.tempFilePath });
    this.setData({ 'editing.avatar': up.fileID });
  },

  async onSave() {
    const ed = this.data.editing;
    if (!ed.name) { wx.showToast({ title: '请填写名称', icon: 'none' }); return; }
    const payload = {
      name: ed.name,
      avatar: ed.avatar || '',
      enabled: ed.enabled !== false,
      sortOrder: Number(ed.sortOrder) || 0
    };
    const action = ed._id ? 'update' : 'create';
    await wx.cloud.callFunction({
      name: 'manageService',
      data: { collection: 'staff', action, id: ed._id, data: payload }
    });
    wx.showToast({ title: '已保存' });
    this.setData({ editing: null });
    this.fetchList();
  },

  async onRemove(e) {
    const id = e.currentTarget.dataset.id;
    const c = await new Promise(r => wx.showModal({ title: '确认删除？', success: x => r(x.confirm) }));
    if (!c) return;
    await wx.cloud.callFunction({
      name: 'manageService',
      data: { collection: 'staff', action: 'remove', id }
    });
    this.fetchList();
  }
});
