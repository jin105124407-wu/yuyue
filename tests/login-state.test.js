const assert = require('assert');
const path = require('path');

const root = path.resolve(__dirname, '..');
const {
  hasMemberProfile,
  memberDisplayName
} = require(path.join(root, 'utils/user-display'));

assert.strictEqual(typeof hasMemberProfile, 'function');
assert.strictEqual(typeof memberDisplayName, 'function');

assert.strictEqual(hasMemberProfile({ openid: 'openid-only' }), false);
assert.strictEqual(hasMemberProfile({ _openid: 'openid-only' }), false);
assert.strictEqual(hasMemberProfile({ phone: '13600000000' }), true);
assert.strictEqual(hasMemberProfile({ purePhone: '13600000000' }), true);
assert.strictEqual(hasMemberProfile({ nickname: '小美' }), true);
assert.strictEqual(hasMemberProfile({ name: '王女士' }), true);

assert.strictEqual(memberDisplayName({ openid: 'openid-only' }), '微信用户');
assert.strictEqual(memberDisplayName({ phone: '13600000000' }), '已登录用户');
assert.strictEqual(memberDisplayName({ nickname: '小美' }), '小美');

console.log('ok login-state');
