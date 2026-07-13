// 云函数：getAdminStats —— 今日顾客数 / 订单量 / 进账
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;
const $ = db.command.aggregate;

function unique(list) {
  return Array.from(new Set(list.filter(Boolean)));
}

function phoneCandidatesFromUser(user = {}) {
  const raw = [user.phone, user.purePhone];
  const out = [];
  raw.forEach(value => {
    const text = String(value || '').trim();
    const digits = text.replace(/\D/g, '');
    if (text) out.push(text);
    if (digits) out.push(digits);
    if (digits.length === 13 && digits.indexOf('86') === 0) out.push(digits.slice(2));
  });
  return unique(out);
}

async function hasAdminPhone(phone) {
  if (!phone) return false;
  const phoneRes = await db.collection('admins').where({ phone }).limit(1).get();
  if (phoneRes.data.length > 0) return true;
  const purePhoneRes = await db.collection('admins').where({ purePhone: phone }).limit(1).get();
  return purePhoneRes.data.length > 0;
}

async function isAdmin(openid) {
  const r = await db.collection('admins').where({ openid }).limit(1).get();
  if (r.data.length > 0) return true;
  const userRes = await db.collection('users').where({ openid }).limit(20).get();
  const phones = unique((userRes.data || []).reduce((all, user) => all.concat(phoneCandidatesFromUser(user)), []));
  for (const phone of phones) {
    if (await hasAdminPhone(phone)) return true;
  }
  return false;
}

function todayStr() {
  const d = new Date();
  // 按服务端时区，直接取年月日
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

exports.main = async () => {
  const { OPENID } = cloud.getWXContext();
  if (!(await isAdmin(OPENID))) return { ok: false, reason: '无权限' };

  const today = todayStr();

  const [allRes, incomeRes] = await Promise.all([
    db.collection('bookings').where({ date: today }).get(),
    db.collection('bookings').where({ date: today, status: 'done' })
      .aggregate().group({ _id: null, total: $.sum('$amount') }).end()
  ]);

  const orderCount = allRes.data.length;
  const customerSet = new Set(allRes.data.map(b => b.openid));
  const income = (incomeRes.list[0] && incomeRes.list[0].total) || 0;

  return {
    ok: true,
    today,
    customerCount: customerSet.size,
    orderCount,
    income
  };
};
