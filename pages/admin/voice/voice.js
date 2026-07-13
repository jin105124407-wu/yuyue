let pollTimer = null;
let audioCtx = null;
let polling = false;
let audioMode = '';

const ALERT_AUDIO = '/assets/audio/new-booking.mp3';
const CANCEL_AUDIO = '/assets/audio/cancel-booking.mp3';

function buildFallbackNotice(item) {
  if (item.voiceNoticeText) return item.voiceNoticeText;
  const customer = item.userSnapshot && item.userSnapshot.nickname ? item.userSnapshot.nickname : '顾客';
  const phone = item.userSnapshot && item.userSnapshot.phone ? `，电话${item.userSnapshot.phone}` : '';
  const remark = item.remark ? `，备注${item.remark}` : '';
  if (item.voiceNoticeType === 'canceled' || item.status === 'canceled') {
    return `取消预约提醒。${customer}${phone}。已取消${item.serviceName || '预约项目'}。原预约时间${item.date} ${item.startTime}。服务美容师${item.staffName || '未指定'}`;
  }
  return `新预约提醒。${customer}${phone}。预约${item.serviceName}。时间${item.date} ${item.startTime}。服务美容师${item.staffName}${remark}`;
}

function queueSignature(queue) {
  return (queue || []).map(item => `${item._id || ''}:${item.voiceNoticeStatus || ''}`).join('|');
}

Page({
  data: {
    isAdmin: false,
    running: true,
    loading: false,
    speaking: false,
    statusText: '请保持本页打开，并将设备连接到店铺音响。',
    pluginReady: false,
    queue: [],
    currentNotice: null
  },

  onLoad() {
    this.setData({ isAdmin: !!wx.getStorageSync('isAdmin') });
    audioCtx = wx.createInnerAudioContext();
    audioCtx.obeyMuteSwitch = false;
    audioCtx.onEnded(() => this.onAudioEnded());
    audioCtx.onError((err) => this.onAudioError(err));
  },

  onShow() {
    if (this.data.isAdmin && this.data.running) {
      this.startPolling();
    }
  },

  onHide() {
    this.stopPolling();
  },

  onUnload() {
    this.stopPolling();
    if (audioCtx) {
      audioCtx.destroy();
      audioCtx = null;
    }
  },

  startPolling() {
    this.stopPolling();
    this.pollNow({ silent: true });
    pollTimer = setInterval(() => this.pollNow({ silent: true }), 6000);
  },

  stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  },

  onRunningChange(e) {
    const running = !!e.detail.value;
    this.setData({
      running,
      statusText: running ? '正在监听新预约，请保持本页打开。' : '已暂停监听。'
    });
    if (running) this.startPolling();
    else this.stopPolling();
  },

  async pollNow(options = {}) {
    if (!this.data.isAdmin || polling || this.data.speaking) return;
    const silent = options && options.silent === true;
    polling = true;
    if (!silent && !this.data.loading) this.setData({ loading: true });
    try {
      const res = await wx.cloud.callFunction({
        name: 'getPendingVoiceNotices',
        data: { limit: 10 }
      });
      const r = res.result || {};
      if (!r.ok) {
        const nextText = r.reason || '无法获取待播报预约。';
        if (this.data.statusText !== nextText) this.setData({ statusText: nextText });
        return;
      }
      const queue = (r.list || []).map(item => Object.assign({}, item, {
        voiceNoticeText: buildFallbackNotice(item)
      }));
      const oldSig = queueSignature(this.data.queue);
      const newSig = queueSignature(queue);
      if (oldSig !== newSig) this.setData({ queue });
      if (queue.length > 0 && !this.data.currentNotice) {
        this.playNotice(queue[0]);
      } else if (queue.length === 0) {
        const nextText = '暂无新预约，正在监听中。';
        if (this.data.statusText !== nextText) this.setData({ statusText: nextText });
      }
    } catch (e) {
      const nextText = '检查失败，请确认网络和云函数部署状态。';
      if (this.data.statusText !== nextText) this.setData({ statusText: nextText });
    } finally {
      polling = false;
      if (!silent && this.data.loading) this.setData({ loading: false });
    }
  },

  replayCurrent() {
    if (!this.data.currentNotice) return;
    this.playNotice(this.data.currentNotice, true);
  },

  testAlertSound() {
    this.playAlertTone('正在播放测试提示音，请确认店铺音响已连接。');
  },

  testCancelSound() {
    this.playAlertTone('正在播放取消预约提示音，请确认店铺音响已连接。', CANCEL_AUDIO);
  },

  playAlertTone(statusText, src) {
    if (!audioCtx) audioCtx = wx.createInnerAudioContext();
    audioCtx.obeyMuteSwitch = false;
    audioMode = 'alert';
    audioCtx.stop();
    audioCtx.src = src || ALERT_AUDIO;
    audioCtx.play();
    if (statusText) this.setData({ statusText });
  },

  playNotice(notice, replaying) {
    if (!notice) return;
    this.setData({
      currentNotice: notice,
      speaking: true,
      statusText: replaying ? '正在重播当前预约。' : '发现新预约，正在生成语音。'
    });

    const isCanceled = notice.voiceNoticeType === 'canceled' || notice.status === 'canceled';
    this.playAlertTone(
      isCanceled ? '检测到客户取消预约，已播放取消提示音。请查看下方预约文案。' : '检测到新预约，已播放提示音。请查看下方预约文案。',
      isCanceled ? CANCEL_AUDIO : ALERT_AUDIO
    );
    this.setData({
      speaking: false,
      pluginReady: false,
      statusText: isCanceled ? '检测到客户取消预约，已播放取消提示音。请查看下方预约文案。' : '检测到新预约，已播放提示音。请查看下方预约文案。'
    });
  },

  async onAudioEnded() {
    if (audioMode === 'alert') {
      audioMode = '';
      const notice = this.data.currentNotice;
      if (!notice) return;
      await this.markPlayed(notice._id, 'played');
      this.setData({
        speaking: false,
        currentNotice: null,
        queue: this.data.queue.filter(item => item._id !== notice._id),
        statusText: '播报完成，继续监听新预约。'
      });
      this.pollNow();
      return;
    }
    audioMode = '';
    const notice = this.data.currentNotice;
    if (!notice) return;
    await this.markPlayed(notice._id, 'played');
    this.setData({
      speaking: false,
      currentNotice: null,
      queue: this.data.queue.filter(item => item._id !== notice._id),
      statusText: '播报完成，继续监听新预约。'
    });
    this.pollNow();
  },

  async onAudioError(err) {
    const mode = audioMode;
    audioMode = '';
    const notice = this.data.currentNotice;
    const reason = err && err.errMsg ? err.errMsg : '语音播放失败';
    if (mode === 'alert') {
      this.setData({ statusText: `${reason}。请检查设备音量或重新进入页面。` });
      return;
    }
    this.setData({
      speaking: false,
      statusText: `${reason}。请检查音量、蓝牙音响连接或插件配置。`
    });
    if (notice) {
      await this.markPlayed(notice._id, 'failed', reason);
    }
  },

  async markPlayed(bookingId, status, reason) {
    try {
      await wx.cloud.callFunction({
        name: 'markVoiceNoticePlayed',
        data: { bookingId, status, reason: reason || '' }
      });
    } catch (e) {
      this.setData({ statusText: '播报状态保存失败，请稍后刷新检查。' });
    }
  }
});
