const DEFAULT_AVATAR = '/assets/images/login-avatar-eastern.png';

function safeAvatar(avatar) {
  if (!avatar || typeof avatar !== 'string') return '';
  if (avatar.indexOf('http://tmp/') === 0 || avatar.indexOf('wxfile://tmp') === 0) return '';
  return avatar;
}

function userScore(user = {}) {
  let score = 0;
  if (user.nickname) score += 100;
  if (safeAvatar(user.avatar)) score += 40;
  if (user.phone || user.purePhone) score += 20;
  if (user.birthday) score += 10;
  if (user.updatedAt) score += 5;
  return score;
}

function pickBestUser(list = [], fallback = null) {
  const candidates = list.concat(fallback ? [fallback] : []).filter(Boolean);
  if (!candidates.length) return fallback || null;
  return candidates.sort((a, b) => userScore(b) - userScore(a))[0];
}

function displayAvatar(user) {
  return safeAvatar(user && user.avatar) || DEFAULT_AVATAR;
}

module.exports = {
  DEFAULT_AVATAR,
  safeAvatar,
  userScore,
  pickBestUser,
  displayAvatar
};
