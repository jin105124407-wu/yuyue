const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');

function loadPage(filePath, wxMock) {
  const code = fs.readFileSync(filePath, 'utf8');
  let pageDef = null;
  const context = {
    console,
    setInterval,
    clearInterval,
    Page(def) {
      pageDef = def;
    },
    wx: wxMock || {}
  };
  vm.createContext(context);
  vm.runInContext(code, context, { filename: filePath });
  if (!pageDef) throw new Error(`Page not registered: ${filePath}`);
  pageDef.data = JSON.parse(JSON.stringify(pageDef.data || {}));
  pageDef.setData = function setData(patch) {
    Object.keys(patch || {}).forEach(key => {
      this.data[key] = patch[key];
    });
  };
  return pageDef;
}

function loadCloudFunction(filePath, cloudMock) {
  const code = fs.readFileSync(filePath, 'utf8');
  const module = { exports: {} };
  const context = {
    console,
    module,
    exports: module.exports,
    require(name) {
      if (name === 'wx-server-sdk') return cloudMock;
      return require(name);
    }
  };
  vm.createContext(context);
  vm.runInContext(code, context, { filename: filePath });
  return module.exports;
}

async function testBookingUnavailableMapIncludesForwardOverlap() {
  const time = require(path.join(root, 'utils/time'));
  assert.strictEqual(typeof time.buildUnavailableMap, 'function');

  const map = time.buildUnavailableMap(
    ['09:30', '10:00', '10:30', '11:00', '12:00'],
    60,
    [{ startTime: '10:30', durationMin: 60 }]
  );

  assert.strictEqual(map['09:30'], true);
  assert.strictEqual(map['10:00'], true);
  assert.strictEqual(map['10:30'], true);
  assert.strictEqual(map['11:00'], true);
  assert.strictEqual(map['12:00'], false);
}

async function testOrderNoUsesUniqueSuffixInsteadOfDailyCount() {
  const { buildOrderNo } = require(path.join(root, 'cloudfunctions/createBooking/orderNo'));

  assert.strictEqual(buildOrderNo('2026-07-13', 'ABC123'), 'MOYO20260713ABC123');
  assert.notStrictEqual(
    buildOrderNo('2026-07-13', 'AAA111'),
    buildOrderNo('2026-07-13', 'BBB222')
  );
}

async function testVoiceAlertEndMarksCurrentNoticePlayed() {
  const page = loadPage(path.join(root, 'pages/admin/voice/voice.js'), {
    getStorageSync() { return true; },
    createInnerAudioContext() {
      return {
        obeyMuteSwitch: false,
        onEnded() {},
        onError() {},
        stop() {},
        play() {},
        destroy() {}
      };
    }
  });

  page.onLoad();
  let marked = null;
  page.markPlayed = async function markPlayed(id, status) {
    marked = { id, status };
  };

  page.playNotice({ _id: 'booking-1', voiceNoticeType: 'new', staffName: '芬芬' });
  await page.onAudioEnded();

  assert.deepStrictEqual(marked, { id: 'booking-1', status: 'played' });
  assert.strictEqual(page.data.currentNotice, null);
  assert.strictEqual(page.data.speaking, false);
}

async function testManageServiceRemoveSoftDisablesItem() {
  const calls = [];
  const db = {
    collection(name) {
      return {
        where() {
          return {
            count: async () => ({ total: 1 })
          };
        },
        doc(id) {
          return {
            update: async payload => calls.push({ type: 'update', name, id, payload }),
            remove: async () => calls.push({ type: 'remove', name, id })
          };
        }
      };
    },
    serverDate() {
      return 'server-date';
    }
  };
  const cloud = {
    DYNAMIC_CURRENT_ENV: 'test',
    init() {},
    database() {
      return db;
    },
    getWXContext() {
      return { OPENID: 'admin-openid' };
    }
  };
  const mod = loadCloudFunction(path.join(root, 'cloudfunctions/manageService/index.js'), cloud);

  const res = await mod.main({ collection: 'services', action: 'remove', id: 'svc-1' });

  assert.strictEqual(res.ok, true);
  assert.strictEqual(calls.some(call => call.type === 'remove'), false);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(calls[0])), {
    type: 'update',
    name: 'services',
    id: 'svc-1',
    payload: { data: { enabled: false } }
  });
}

async function run() {
  const tests = [
    testBookingUnavailableMapIncludesForwardOverlap,
    testOrderNoUsesUniqueSuffixInsteadOfDailyCount,
    testVoiceAlertEndMarksCurrentNoticePlayed,
    testManageServiceRemoveSoftDisablesItem
  ];
  for (const test of tests) {
    await test();
    console.log(`ok ${test.name}`);
  }
}

run().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
