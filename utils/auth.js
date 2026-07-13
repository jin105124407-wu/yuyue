// 登录与身份辅助
const { hasMemberProfile } = require('./user-display');
function getOpenid() {
  return wx.getStorageSync('openid') || '';
}

function isAdmin() {
  return !!wx.getStorageSync('isAdmin');
}

function isMemberLogged() {
  return hasMemberProfile(wx.getStorageSync('userInfo'));
}

function showLoginRequired(content) {
  wx.showModal({
    title: '请先登录',
    content: content || '登录后才能预约服务。',
    confirmText: '去登录',
    cancelText: '稍后',
    success(res) {
      if (res.confirm) {
        wx.navigateTo({ url: '/pages/login/login' });
      }
    }
  });
}

function requireMemberLogin(content) {
  if (isMemberLogged()) return true;
  showLoginRequired(content);
  return false;
}

function ensureLogin() {
  const openid = getOpenid();
  if (openid) return Promise.resolve(openid);
  return wx.cloud.callFunction({ name: 'login' }).then(res => {
    const result = res.result || {};
    if (!result.ok || !result.openid) {
      throw new Error(result.reason || '登录初始化失败');
    }
    const oid = result.openid;
    wx.setStorageSync('openid', oid);
    wx.setStorageSync('isAdmin', !!result.isAdmin);
    if (result.user && hasMemberProfile(result.user)) {
      wx.setStorageSync('userInfo', result.user);
    }
    return oid;
  });
}

module.exports = { getOpenid, isAdmin, isMemberLogged, requireMemberLogin, ensureLogin };
