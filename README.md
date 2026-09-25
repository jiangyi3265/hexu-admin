# hexu-admin

禾序分销批发中台的 Web 管理后台，调用 hexu-backend 管理商城业务并与 hexu-app 同步数据。

## 项目简介

基于 RuoYi-Vue3 的 Vue 单页应用，面向平台管理员和具有商城岗位权限的运营人员。

- 经营概览、商城商品、库存、订单及退换货处理。
- 代理、申请审批、财务流水、提现和对账管理。
- 积分与营销配置、业务规则和运营参数。
- 岗位授权、操作审计、消息模板及后台系统管理。
- 多维报表、历史报表任务、快照统计与 CSV 导出。

业务模块集中在 src/views/hexu，共用接口封装和可配置工作台。用户商城和商家移动页面位于关联仓库 hexu-app。真实微信/支付渠道仍需后端配置及验收。

## 技术栈

- JavaScript ES Modules、Vue 3.5、Vue Router 4、Pinia 3。
- Vite 6.4、Element Plus 2.13、Sass。
- Axios 1.13、ECharts 5、VueUse。
- npm/package-lock.json 管理依赖；当前业务源码以 JavaScript 为主。

## 关联仓库

| 项目 | 说明 | GitHub |
| --- | --- | --- |
| hexu-backend | 后端 API、业务规则与数据库 | [hexu-backend](https://github.com/jiangyi3265/hexu-backend) |
| hexu-admin | 平台 Web 管理后台 | [hexu-admin](https://github.com/jiangyi3265/hexu-admin) |
| hexu-app | 用户、代理与商家移动端 | [hexu-app](https://github.com/jiangyi3265/hexu-app) |

## 快速启动

准备 Node.js 22+ 和 npm，先按 hexu-backend README 启动 http://127.0.0.1:8088。

在本仓库根目录执行：

```powershell
Copy-Item .env.development.example .env.development
Copy-Item .env.production.example .env.production
Copy-Item .env.staging.example .env.staging
npm ci
npm run dev -- --config vite.hexu.config.js
```

访问 http://127.0.0.1:5180；管理接口通过 /dev-api 转发至后端 8088。使用后端初始化时自行设置的 admin 密码登录，仓库不内置登录密码。登录页仅记住账号，不在 Cookie 中保存密码。

原始 `npm run dev` 使用上游默认 Vite 配置（端口 80、代理 8080）；本项目联调请使用上述 vite.hexu.config.js。

### 构建与预览

```bash
npm run build:prod
npm run preview
```

另有 `npm run build:stage` 用于 staging 模式。dist 为生成目录，已排除提交。生产 API 前缀由 VITE_APP_BASE_API 配置，默认 /prod-api；生产服务器需将该前缀转发至后端并去掉前缀，preview 只提供静态文件服务。

.env 文件在本机创建并被 Git 忽略。VITE_* 变量会进入浏览器构建产物，只能填写公开参数，不要放置任何服务端密钥。

## 项目结构

```text
src/api/hexu/        Hexu 后台 API 封装
src/views/hexu/      业务工作台、模块定义与报表界面
src/views/system/   用户、角色、菜单等平台管理
src/router/         路由与权限菜单
src/store/          Pinia 状态
src/components/     通用后台组件
src/utils/          请求、鉴权和工具方法
src/assets/         后台图标、样式与图片
vite/               构建插件
vite.hexu.config.js  本地 5180 → 8088 联调配置
```

## 简历描述示例

参与禾序分销批发运营后台开发，基于 Vue 3、Element Plus 与 Pinia 实现商品订单、代理审批、资金对账及岗位权限管理。对接统一后端 API，建设可复用业务工作台及支持筛选、历史快照和 CSV 导出的经营报表界面。

## 开源基础

基于 [RuoYi-Vue3](https://gitcode.com/yangzongzhuan/RuoYi-Vue3) 二次开发，保留上游 [MIT LICENSE](LICENSE) 及版权声明。
