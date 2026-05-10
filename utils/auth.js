// 登录与身份辅助
function getOpenid() {
  return wx.getStorageSync('openid') || '';
}

function isAdmin() {
  return !!wx.getStorageSync('isAdmin');
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
    if (result.user && result.user.nickname) {
      wx.setStorageSync('userInfo', result.user);
    }
    return oid;
  });
}

module.exports = { getOpenid, isAdmin, ensureLogin };
