# Moyo Beauty 电脑端网页后台

## 使用方式

1. 部署 `webAdminApi` 云函数。
2. 为 `webAdminApi` 配置 HTTP 访问路径，例如 `/web-admin-api`。
3. 用电脑浏览器打开 `web-admin/index.html`。
4. 在登录页填写 HTTP API 地址、管理员手机号和后台密码。

## HTTP 访问路径

在微信开发者工具或云开发控制台中打开环境 `cloud1-d7gs48grw3d10acea`：

1. 进入“云函数”。
2. 找到 `webAdminApi`。
3. 配置“HTTP 访问服务”。
4. 路径建议填写：`/web-admin-api`。
5. 网关鉴权关闭；`webAdminApi` 内部已有手机号、密码和 token 校验。

配置完成后，登录页的 API 地址通常类似：

```text
https://cloud1-d7gs48grw3d10acea.ap-shanghai.app.tcloudbase.com/web-admin-api
```

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
