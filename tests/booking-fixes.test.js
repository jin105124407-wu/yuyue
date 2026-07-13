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
    getApp() {
      return { globalData: {} };
    },
    require(name) {
      if (name.indexOf('.') === 0) return require(path.resolve(path.dirname(filePath), name));
      return require(name);
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
      if (name.indexOf('.') === 0) return require(path.resolve(path.dirname(filePath), name));
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

async function testCreateBookingRejectsUserWithoutMemberProfile() {
  const added = [];
  const db = {
    command: {
      in(list) {
        return { $in: list };
      }
    },
    collection(name) {
      if (name === 'services') {
        return {
          doc() {
            return {
              get: async () => ({
                data: { _id: 'svc-1', name: '清洁补水', durationMin: 60, price: 0 }
              })
            };
          }
        };
      }
      if (name === 'staff') {
        return {
          doc() {
            return {
              get: async () => ({
                data: { _id: 'staff-1', name: '芬芬', avatar: '' }
              })
            };
          }
        };
      }
      if (name === 'bookings') {
        return {
          where() {
            return {
              get: async () => ({ data: [] })
            };
          },
          add: async payload => {
            added.push(payload);
            return { _id: 'booking-1' };
          }
        };
      }
      if (name === 'users') {
        return {
          where() {
            return {
              limit() {
                return {
                  get: async () => ({ data: [{ openid: 'openid-only' }] })
                };
              }
            };
          }
        };
      }
      return {
        where() {
          return {
            get: async () => ({ data: [] })
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
      return { OPENID: 'openid-only' };
    }
  };
  const mod = loadCloudFunction(path.join(root, 'cloudfunctions/createBooking/index.js'), cloud);

  const res = await mod.main({
    staffId: 'staff-1',
    serviceId: 'svc-1',
    date: '2026-07-13',
    startTime: '10:00'
  });

  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.reason, '请先登录后再预约');
  assert.strictEqual(added.length, 0);
}

async function testBookingSubmitPromptsLoginBeforeCloudCall() {
  let modal = null;
  let cloudCalled = false;
  const wxMock = {
    getStorageSync(key) {
      if (key === 'userInfo') return null;
      return '';
    },
    showModal(options) {
      modal = options;
    },
    showToast() {},
    cloud: {
      callFunction: async () => {
        cloudCalled = true;
        return { result: { ok: false, reason: '不应调用云函数' } };
      }
    }
  };
  const previousWx = global.wx;
  global.wx = wxMock;
  const page = loadPage(path.join(root, 'pages/booking/booking.js'), wxMock);
  Object.assign(page.data, {
    selectedStaffId: 'staff-1',
    selectedServiceId: 'svc-1',
    selectedDate: '2026-07-13',
    selectedTime: '10:00',
    services: [{ _id: 'svc-1', name: '清洁补水', durationMin: 60 }],
    staff: [{ _id: 'staff-1', name: '芬芬' }],
    existingBookings: []
  });

  try {
    await page.onSubmit();
  } finally {
    global.wx = previousWx;
  }

  assert.strictEqual(cloudCalled, false);
  assert.ok(modal);
  assert.strictEqual(modal.title, '请先登录');
  assert.strictEqual(modal.confirmText, '去登录');
}

async function run() {
  const tests = [
    testBookingUnavailableMapIncludesForwardOverlap,
    testOrderNoUsesUniqueSuffixInsteadOfDailyCount,
    testVoiceAlertEndMarksCurrentNoticePlayed,
    testManageServiceRemoveSoftDisablesItem,
    testBookingSubmitPromptsLoginBeforeCloudCall,
    testCreateBookingRejectsUserWithoutMemberProfile
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
