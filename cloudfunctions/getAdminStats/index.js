// 云函数：getAdminStats —— 今日顾客数 / 订单量 / 进账
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;
const $ = db.command.aggregate;

async function isAdmin(openid) {
  const r = await db.collection('admins').where({ openid }).limit(1).get();
  return r.data.length > 0;
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
