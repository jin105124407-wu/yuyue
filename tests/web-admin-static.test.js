const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

const htmlPath = path.join(root, 'web-admin/index.html');
const cssPath = path.join(root, 'web-admin/styles.css');
const jsPath = path.join(root, 'web-admin/app.js');

assert.ok(fs.existsSync(htmlPath), 'web-admin/index.html should exist');
assert.ok(fs.existsSync(cssPath), 'web-admin/styles.css should exist');
assert.ok(fs.existsSync(jsPath), 'web-admin/app.js should exist');

const html = fs.readFileSync(htmlPath, 'utf8');
const js = fs.readFileSync(jsPath, 'utf8');

assert.ok(html.includes('id="loginView"'), 'login view should exist');
assert.ok(html.includes('id="dashboardView"'), 'dashboard view should exist');
assert.ok(html.includes('data-view="orders"'), 'orders navigation should exist');
assert.ok(html.includes('data-view="voice"'), 'voice navigation should exist');
assert.ok(js.includes('async function apiCall'), 'apiCall should exist');
assert.ok(js.includes('function startVoicePolling'), 'startVoicePolling should exist');
assert.ok(js.includes('function playNoticeSound'), 'playNoticeSound should exist');
assert.ok(js.includes('if (item.voiceNoticeText) return item.voiceNoticeText;'), 'voice notice should prefer saved notice text');
assert.ok(js.includes('const remark = item.remark ? `，备注${item.remark}` : \'\';'), 'voice notice should include booking remark like mobile admin');
assert.ok(js.includes('预约${item.serviceName}。时间${item.date} ${item.startTime}。服务美容师${item.staffName}${remark}'), 'new booking voice template should match mobile admin');
assert.ok(js.includes('window.speechSynthesis.speak(utter);'), 'voice notice should speak the booking text');
assert.ok(js.includes('新预约提醒。顾客，电话13800000000。预约面部护理。时间2026-07-13 10:00。服务美容师芬芬，备注到店后先咨询'), 'test voice button should speak appointment-style content');

console.log('ok web-admin-static');
