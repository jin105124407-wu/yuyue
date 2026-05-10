// 云函数：seedData —— 一次性初始化示例数据。执行后建议删除或锁定
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const SERVICES = [
  { name: '清洁补水', description: '清黑头、油脂、补水', durationMin: 60, price: 0 },
  { name: '吨吨补水', description: '深层补水，仪器配合产品', durationMin: 60, price: 0 },
  { name: '面部拨筋+眼部拨筋', description: '疏通经络，促进血液循环', durationMin: 90, price: 0 },
  { name: '敏肌屏障维养', description: '修复好过敏皮肤', durationMin: 60, price: 0 },
  { name: '痘肌管理', description: '改善痘痘，粉刺', durationMin: 120, price: 0 },
  { name: '以色列S女王', description: '面部提拉紧致', durationMin: 60, price: 0 },
  { name: '全身美白仓', description: '补水保湿，美白嫩肤', durationMin: 40, price: 0 },
  { name: '5D磁量子', description: '身体塑形，单部位', durationMin: 40, price: 0 },
  { name: '冰点脱毛', description: '针对全身', durationMin: 120, price: 0 },
  { name: '肩颈', description: '劳损，低头族', durationMin: 40, price: 0 },
  { name: '焕颜', description: '清洁，排毒，排菌', durationMin: 120, price: 0 }
];

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { setMeAdmin, force } = event || {};

  const result = { steps: [] };

  // 1. admins：如果空且 setMeAdmin=true，写入当前调用者
  const adminCount = await db.collection('admins').count().catch(() => ({ total: 0 }));
  if (adminCount.total === 0 && setMeAdmin) {
    await db.collection('admins').add({
      data: { openid: OPENID, name: '店主', createdAt: db.serverDate() }
    });
    result.steps.push('添加当前用户为管理员');
  }

  // 2. services
  const serviceCount = await db.collection('services').count().catch(() => ({ total: 0 }));
  if (serviceCount.total === 0 || force) {
    for (let i = 0; i < SERVICES.length; i++) {
      await db.collection('services').add({
        data: Object.assign({}, SERVICES[i], { enabled: true, sortOrder: i, createdAt: db.serverDate() })
      });
    }
    result.steps.push(`插入 ${SERVICES.length} 个服务项目`);
  }

  // 3. staff
  const staffCount = await db.collection('staff').count().catch(() => ({ total: 0 }));
  if (staffCount.total === 0) {
    await db.collection('staff').add({
      data: { name: '芬芬', avatar: '', sortOrder: 0, enabled: true, createdAt: db.serverDate() }
    });
    result.steps.push('插入默认美容师');
  }

  // 4. store 单文档
  const storeCount = await db.collection('store').count().catch(() => ({ total: 0 }));
  if (storeCount.total === 0) {
    await db.collection('store').add({
      data: {
        name: '美容院',
        address: '广东省深圳市南山区方大城T4栋13楼1306',
        phone: '13632684631',
        hours: '9:00-22:00',
        latitude: 22.556853755461958,
        longitude: 113.972840651337,
        storyImages: [],
        createdAt: db.serverDate()
      }
    });
    result.steps.push('插入门店信息');
  }

  // 5. banners 空可后续加
  return { ok: true, ...result };
};
