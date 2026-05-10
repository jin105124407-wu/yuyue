// 云函数：getPhoneNumber —— 用前端 getphonenumber 回调里的 code 换手机号
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event) => {
  const { code } = event || {};
  if (!code) return { ok: false, reason: '缺少 code' };
  try {
    const res = await cloud.openapi.phonenumber.getPhoneNumber({ code });
    const info = (res && res.phoneInfo) || {};
    return {
      ok: true,
      phone: info.phoneNumber || '',
      purePhone: info.purePhoneNumber || '',
      countryCode: info.countryCode || ''
    };
  } catch (e) {
    return { ok: false, reason: e.errMsg || String(e) };
  }
};
