// 云函数：login —— 返回 openid 并判断是否为管理员
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

function userScore(user = {}) {
  let score = 0;
  if (user.nickname) score += 100;
  if (user.avatar) score += 40;
  if (user.phone || user.purePhone) score += 20;
  if (user.birthday) score += 10;
  if (user.updatedAt) score += 5;
  return score;
}

function pickBestUser(list = []) {
  if (!list.length) return null;
  return list.sort((a, b) => userScore(b) - userScore(a))[0];
}

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext();
  const profile = event.profile || null;
  let isAdmin = false;
  try {
    const adminRes = await db.collection('admins').where({ openid: OPENID }).count();
    isAdmin = adminRes.total > 0;
  } catch (e) {
    // admins 集合未创建时不报错
    isAdmin = false;
  }

  // 顾客首次登录只返回身份；只有传入 profile 时才创建/更新用户资料。
  let user = null;
  try {
    const userRes = await db.collection('users').where({ openid: OPENID }).limit(20).get();
    user = pickBestUser(userRes.data || []);
    if (!profile) {
      return { openid: OPENID, isAdmin, ok: true, user: user || null };
    }

    const baseData = {
      openid: OPENID,
      nickname: '',
      avatar: '',
      phone: '',
      level: '普通会员',
      totalSpent: 0,
      createdAt: db.serverDate()
    };
    const profileData = profile ? {
      nickname: profile.nickname || '',
      avatar: profile.avatar || '',
      phone: profile.phone || '',
      purePhone: profile.purePhone || profile.phone || '',
      birthday: profile.birthday || '',
      zodiac: profile.zodiac || '',
      privacyAgreed: !!profile.privacyAgreed,
      privacyAgreedAt: profile.privacyAgreed ? db.serverDate() : undefined,
      updatedAt: db.serverDate()
    } : null;
    Object.keys(profileData).forEach(key => profileData[key] === undefined && delete profileData[key]);

    if (!user) {
      const addRes = await db.collection('users').add({
        data: {
          ...baseData,
          ...profileData
        }
      });
      user = { _id: addRes._id, ...baseData, ...profileData };
    } else {
      await db.collection('users').doc(user._id).update({ data: profileData });
      user = { ...user, ...profileData };
    }
  } catch (e) {
    return { openid: OPENID, isAdmin, ok: false, reason: e.message || String(e) };
  }

  return { openid: OPENID, isAdmin, ok: true, user };
};
