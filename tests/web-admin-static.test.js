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

console.log('ok web-admin-static');
