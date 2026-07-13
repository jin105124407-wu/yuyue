const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');

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

function createDbMock(options = {}) {
  const adminPhone = '13600000000';
  const currentOpenid = 'user-openid';
  const user = {
    _id: 'user-1',
    openid: currentOpenid,
    phone: adminPhone,
    purePhone: adminPhone,
    nickname: '店主'
  };
  const state = {
    users: options.users || [user]
  };
  const db = {
    collection(name) {
      if (name === 'admins') {
        return {
          where(query = {}) {
            return {
              count: async () => ({
                total: query.phone === adminPhone || query.purePhone === adminPhone ? 1 : 0
              }),
              limit() {
                return {
                  get: async () => ({
                    data: query.phone === adminPhone || query.purePhone === adminPhone ? [{ phone: adminPhone }] : []
                  })
                };
              }
            };
          }
        };
      }
      if (name === 'users') {
        return {
          where(query = {}) {
            return {
              limit() {
                return {
                  get: async () => ({
                    data: state.users.filter(item => item.openid === query.openid)
                  })
                };
              }
            };
          },
          doc(id) {
            return {
              update: async ({ data }) => {
                const item = state.users.find(x => x._id === id);
                if (item) Object.assign(item, data);
                return {};
              }
            };
          },
          add: async ({ data }) => {
            const _id = `user-${state.users.length + 1}`;
            state.users.push({ _id, ...data });
            return { _id };
          }
        };
      }
      if (name === 'services') {
        return {
          orderBy() {
            return {
              get: async () => ({ data: [] })
            };
          }
        };
      }
      return {
        where() {
          return {
            count: async () => ({ total: 0 }),
            limit() {
              return { get: async () => ({ data: [] }) };
            }
          };
        }
      };
    },
    serverDate() {
      return 'server-date';
    }
  };
  return { db, currentOpenid, adminPhone, state };
}

function createCloudMock(db, currentOpenid) {
  return {
    DYNAMIC_CURRENT_ENV: 'test',
    init() {},
    database() {
      return db;
    },
    getWXContext() {
      return { OPENID: currentOpenid };
    }
  };
}

async function testLoginRecognizesPhoneAdmin() {
  const { db, currentOpenid } = createDbMock();
  const mod = loadCloudFunction(
    path.join(root, 'cloudfunctions/login/index.js'),
    createCloudMock(db, currentOpenid)
  );

  const res = await mod.main({});

  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.openid, currentOpenid);
  assert.strictEqual(res.isAdmin, true);
}

async function testProfileLoginRecognizesNewPhoneAdmin() {
  const { db, currentOpenid, adminPhone, state } = createDbMock({ users: [] });
  const mod = loadCloudFunction(
    path.join(root, 'cloudfunctions/login/index.js'),
    createCloudMock(db, currentOpenid)
  );

  const res = await mod.main({
    profile: {
      nickname: '店主',
      phone: adminPhone,
      purePhone: adminPhone,
      privacyAgreed: true
    }
  });

  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.isAdmin, true);
  assert.strictEqual(state.users.length, 1);
  assert.strictEqual(res.user.phone, adminPhone);
}

async function testAdminFunctionAllowsPhoneAdmin() {
  const { db, currentOpenid } = createDbMock();
  const mod = loadCloudFunction(
    path.join(root, 'cloudfunctions/manageService/index.js'),
    createCloudMock(db, currentOpenid)
  );

  const res = await mod.main({ collection: 'services', action: 'list' });

  assert.strictEqual(res.ok, true);
  assert.deepStrictEqual(res.list, []);
}

async function run() {
  await testLoginRecognizesPhoneAdmin();
  console.log('ok testLoginRecognizesPhoneAdmin');
  await testProfileLoginRecognizesNewPhoneAdmin();
  console.log('ok testProfileLoginRecognizesNewPhoneAdmin');
  await testAdminFunctionAllowsPhoneAdmin();
  console.log('ok testAdminFunctionAllowsPhoneAdmin');
}

run().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
