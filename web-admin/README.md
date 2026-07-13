# Moyo Beauty 电脑端网页后台

## 使用方式

1. 部署 `webAdminApi` 云函数。
2. 为 `webAdminApi` 配置 HTTP 访问路径，例如 `/web-admin-api`。
3. 用电脑浏览器打开 `web-admin/index.html`。
4. 在登录页填写 HTTP API 地址、管理员手机号和后台密码。

## 管理员密码

在云数据库 `admins` 集合中，给管理员记录增加后台密码字段：

```json
{
  "phone": "13600000000",
  "name": "店主",
  "webPassword": "你的后台密码"
}
```

更推荐使用 SHA-256 哈希：

```json
{
  "phone": "13600000000",
  "name": "店主",
  "webPasswordHash": "sha256后的密码"
}
```

## 播报

进入“播报”页后点击“开始监听”，浏览器会每 6 秒检查待播报预约。检测到新预约或取消预约后，会通过电脑音响播放提示音并朗读预约内容。
