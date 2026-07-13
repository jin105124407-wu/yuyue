const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');

function loadCloudFunction(filePath, cloudMock) {
  const code = fs.readFileSync(filePath, 'utf8');
  const module = { exports: {} };
  const context = {
    Buffer,
    console,
    Date,
    module,
    exports: module.exports,
    process,
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

function chain(data, state) {
  const api = {
    _data: data,
    _where: null,
    _skip: 0,
    _limit: 100,
    _orderKey: '',
    _orderDir: 'asc',
    where(query = {}) {
      api._where = query;
      return api;
    },
    orderBy(key, dir) {
      api._orderKey = key;
      api._orderDir = dir;
      return api;
    },
    skip(n) {
      api._skip = Number(n) || 0;
      return api;
    },
    limit(n) {
      api._limit = Number(n) || 100;
      return api;
    },
    async get() {
      let list = data.filter(item => matches(item, api._where));
      if (api._orderKey) {
        const key = api._orderKey;
        const dir = api._orderDir === 'desc' ? -1 : 1;
        list = list.slice().sort((a, b) => String(a[key] || '').localeCompare(String(b[key] || '')) * dir);
      }
      return { data: list.slice(api._skip, api._skip + api._limit).map(item => ({ ...item })) };
    },
    async count() {
      return { total: data.filter(item => matches(item, api._where)).length };
    },
    async update({ data: patch }) {
      data.filter(item => matches(item, api._where)).forEach(item => Object.assign(item, patch));
      state.updated.push({ where: api._where, patch });
      return {};
    }
  };
  return api;
}

function matches(item, query) {
  if (!query) return true;
  return Object.keys(query).every(key => {
    const expected = query[key];
    if (expected && expected.$in) return expected.$in.indexOf(item[key]) >= 0;
    if (expected && expected.$neq !== undefined) return item[key] !== expected.$neq;
    return item[key] === expected;
  });
}

function createDbMock() {
  const state = {
    added: [],
    updated: [],
    collections: {
      admins: [{ _id: 'admin-1', phone: '13600000000', name: '店主', webPassword: 'secret' }],
      bookings: [
        {
          _id: 'booking-1',
          orderNo: 'MOYO1',
          date: '2026-07-13',
          startTime: '10:00',
          status: 'pending',
          adminRead: false,
          amount: 128,
          openid: 'user-1',
          serviceName: '清洁补水',
          staffName: '芬芬',
          userSnapshot: { nickname: '王女士', phone: '13600000000' },
          voiceNoticeStatus: 'pending',
          voiceNoticeType: 'new',
          createdAt: '2026-07-13T10:00:00.000Z'
        }
      ],
      services: [{ _id: 'svc-1', name: '清洁补水', durationMin: 60, enabled: true, sortOrder: 1 }],
      staff: [{ _id: 'staff-1', name: '芬芬', enabled: true, sortOrder: 1 }]
    }
  };
  const db = {
    command: {
      in(list) {
        return { $in: list };
      },
      neq(value) {
        return { $neq: value };
      }
    },
    collection(name) {
      const data = state.collections[name] || (state.collections[name] = []);
      return {
        where(query) {
          return chain(data, state).where(query);
        },
        orderBy(key, dir) {
          return chain(data, state).orderBy(key, dir);
        },
        doc(id) {
          return {
            async get() {
              return { data: data.find(item => item._id === id) };
            },
            async update({ data: patch }) {
              const item = data.find(x => x._id === id);
              if (item) Object.assign(item, patch);
              state.updated.push({ name, id, patch });
              return {};
            }
          };
        },
        async add({ data: item }) {
          const _id = `${name}-${data.length + 1}`;
          data.push({ _id, ...item });
          state.added.push({ name, item });
          return { _id };
        }
      };
    },
    serverDate() {
      return 'server-date';
    }
  };
  return { db, state };
}

function createCloudMock(db) {
  return {
    DYNAMIC_CURRENT_ENV: 'test',
    init() {},
    database() {
      return db;
    }
  };
}

async function login(api) {
  const res = await api.main({ action: 'login', phone: '13600000000', password: 'secret' });
  assert.strictEqual(res.ok, true);
  assert.ok(res.token);
  return res.token;
}

async function run() {
  const { db, state } = createDbMock();
  const api = loadCloudFunction(
    path.join(root, 'cloudfunctions/webAdminApi/index.js'),
    createCloudMock(db)
  );

  const token = await login(api);

  const orders = await api.main({ action: 'listOrders', token, status: 'pending' });
  assert.strictEqual(orders.ok, true);
  assert.strictEqual(orders.list.length, 1);
  assert.strictEqual(orders.list[0].staffName, '芬芬');

  const updated = await api.main({ action: 'updateOrder', token, bookingId: 'booking-1', status: 'confirmed', markRead: true });
  assert.strictEqual(updated.ok, true);
  assert.strictEqual(state.collections.bookings[0].status, 'confirmed');
  assert.strictEqual(state.collections.bookings[0].adminRead, true);

  const notices = await api.main({ action: 'getPendingVoiceNotices', token });
  assert.strictEqual(notices.ok, true);
  assert.strictEqual(notices.list.length, 1);

  const played = await api.main({ action: 'markVoiceNoticePlayed', token, bookingId: 'booking-1', status: 'played' });
  assert.strictEqual(played.ok, true);
  assert.strictEqual(state.collections.bookings[0].voiceNoticeStatus, 'played');

  const services = await api.main({ action: 'manageCatalog', token, collection: 'services', op: 'list' });
  assert.strictEqual(services.ok, true);
  assert.strictEqual(services.list[0].name, '清洁补水');

  const stats = await api.main({ action: 'stats', token });
  assert.strictEqual(stats.ok, true);
  assert.strictEqual(typeof stats.orderCount, 'number');

  console.log('ok web-admin-api');
}

run().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
