# 2026-09-27 管理端 / Java / 小程序契约检查

本文件记录源码审查与命令验证，**不是浏览器逐页点击或微信真机动作验收记录**。用户已有未提交改动全部保留；检查未重启后端、未修改数据库、未触发支付或提现。

## 已执行验证

- `fenxiao-admin`: 最终 `npm test` 23/23 全部通过（初始6项，累计新增17项）。
- `fenxiao-admin`: `npm run build:prod`，Vite 生产构建成功。
- Java 全量 `Maven package` 由负责个人资料后端的代理执行，最新回报 171 项通过；本代理未重复运行 Maven。

## 源码覆盖

| 界面范围 | 核对的动作 / 读写契约 |
| --- | --- |
| 经营工作台 | 商城范围、经营汇总、近期订单、刷新 |
| 商品与库存 | 新增、编辑、库存调整、箱规、上下架、商品图库上传和读取 |
| 订单与履约 | 列表、真实详情、物流轨迹、发货 |
| 售后 | 审核、退货验收、换货发货、资料查看 |
| 资金与结算 | 提现审核、银行卡结果、账本、积分/批次/转赠/风控、账单导入、差异调整/复核、渠道重试 |
| 代理与客户 | 商城所属、列表字段、姓名与手机号来源、详情 |
| 业务申请 | 代理、联动关系、开店、交接、迁移、团队迁移、晋升、降级、跨店采购、结算账户、客服、评价、盘点 |
| 营销与配置 | 岗位核对/分配、分红版本、各配置表单、图片、营销试算 |
| 操作审计 | 列表、详情、当前数据导出、备份任务 |
| 商户与协议 | 进件/授权/证书提交、渠道编号、核验、协议发布、同意记录 |
| 拣货与直发售后 | 拣货开始/完成/打印、匹配采购单、售后关联、物流配置 |
| 经营报表 | 商城/日期过滤、生成任务、结果/库存分页、导出、轮询 |
| 小程序资料相关 | M25/M26、G32 的字段和头像来源，与 member/profile/attachment 契约 |

`src/api/hexu/index.js` 和 `compliance.js` 的专用 API 路径已对照 Java 控制器。核心分销数据 `hx_*` 使用 `HexuStore`/`JdbcTemplate`；若依 `SysUserMapper.xml` 只负责后台登录账户，不是商城会员资料。

## 初始发现与处理状态

1. 会员资料保存在 `hx_document(kind=profile)`，旧 bootstrap 只取 `hx_member(id,name,phone,authorized)`；后台客户/代理列表也只取 member 字段。已新增 `MemberProfile.vue`，在现有代理/客户详情读取 `/hexu/admin/members/{id}/profile?shopId=`，展示白名单资料与脱敏手机号。头像只使用 `/hexu/app/attachments/avatar/FILE...` 的已绑定 AVATAR 图片路由。专用 API 的商城归属与岗位校验由个人资料后端修复负责；本代理未改 Java。
2. `Workspace.vue` 的 `open()` 曾将结算账户和客服留言的审核阻断为只读提示，但 `HexuWorkflowService.review()` 已支持这两类审核。已移除错误前端挡板，按现有 Java 的 OWNER/平台权限提交 `document-review`。FINANCE/SUPPORT 可读并不代表可审核，未在前端绕过或扩展 Java 权限。
3. 平台积分下拉曾可选 `pointTransfers`/`pointRiskCases`，`load()` 的 shop=0 白名单却漏了这两项。已共享同一 `platformPointPaths` 白名单，平台转赠/冻结复核不再自动切回第一商城。
4. `editProduct()` 曾浅拷贝 `gallery` 数组；编辑中删图再取消会污染当前列表的内存展示。已独立复制图库数组，并新增取消编辑不改原商品的测试。
5. 已为 `showDetail()` 添加订单/审计读取错误提示和请求版本保护；`load()` 清空旧 rows/汇总，并忽略先前商城/标签的过期响应。切换商城/标签时关闭旧详情及表单；同范围后台刷新保留正在编辑的表单。
6. 多数管理端成功操作均 `await load()` 回读列表，没有发现通用命令只提示成功但从未调用写接口的情况。小程序旧“已提交后台”需由主代理改为实际保存与回显后的提示。
7. `HexuErrors` 使用 HTTP 400 返回业务原因，管理端原拦截器丢弃响应正文而显示“系统接口400异常”。已通过 `responseErrorMessage()` 保留 JSON 或 Blob 正文的 `msg`，回传到页面错误处理；网络/超时/无业务正文的 HTTP 错误仍有可读提示。

## 第二轮逐动作契约检查

下表仅表示源码与 Java 契约核对；所有行的真实页面操作仍由主代理点检，不能把表内“匹配/修复”解释为浏览器动作已完成。

| 页面 / 按钮 | 实际读写目标 | 核对结论 / 本轮处理 |
| --- | --- | --- |
| 全模块：选择商城、标签、刷新 | GET shops 与各 scoped query | 已清空旧数据、忽略过期响应；写入/上传期间阻止切商城/标签 |
| 全模块：搜索 | 本地当前 rows | 只筛当前结果，无后台写入 |
| 全模块：导出当前数据 | commands/export-audit + 当前结果 CSV | 审计调用匹配；补空白前缀公式转义；此功能是当前结果导出 |
| 经营工作台 | GET dashboard、orders | 实际查询，金额按分换元；读取失败清空旧汇总 |
| 商品：新增 / 编辑保存 | commands/sku-save | 字段与 Catalog/ProductData 匹配；补长度、重量、箱规、价格范围校验 |
| 商品：图库上传 / 查看 / 删除 / 取消 | attachments PRODUCT / authenticated GET | 5MB PNG/JPEG 限制、9张上限；图库编辑已隔离原数组 |
| 商品：调库存 | commands/stock-adjust | 非零整数、原因必填；Java 留痕与库存约束仍生效 |
| 商品：箱规混批 | GET catalog-settings / commands/sku-box-rules | 补混批箱容/最低箱数/编码校验；读取加商城版本保护 |
| 商品：下架 / 审核上架 | commands/sku-status | 二次确认、状态转换、成功回读；补重复点击保护和可读失败提示 |
| 订单：详情 | GET orders/{id} | 真实单据，失败捕获；历史快照不在前端重建 |
| 订单：物流轨迹 | GET orders/{id}/tracking | 独立读取；无渠道时展示接口未配置/暂无真实轨迹 |
| 订单：发货 | commands/ship | PAID 且拼团已成团才显示；8–40位运单校验，成功回读 |
| 售后：审核 | commands/refund-review | PENDING；通过/驳回与 Java 状态契约匹配 |
| 售后：退货验收 | commands/return-inspect | 补 receivedQty、note、uploads；数量差异阻止提交；RETURN用途仓储权限由后端代理实现 |
| 售后：换货发货 | commands/exchange-ship | WAIT_EXCHANGE；运单校验，实际库存由 Java 执行 |
| 售后：申请/验收图片 | authenticated attachments/{id} | 详情附件收集匹配；图片授权仍由 Java 判断 |
| 提现：详情 | 查询列表中的真实记录 | 修复原详情会打开打款表单的问题，现只读 |
| 提现：审核 | commands/withdraw-review | PENDING；驳回原因至少2字；成功后回读 |
| 提现：登记银行卡结果 | commands/bank-payout-result | 单列明确按钮；银行流水、说明、1–9凭证契约匹配；Java财务权限仍校验 |
| 提现：已登记银行回单 | payout_evidence_json.files → authenticated attachments | 原详情漏附件，已加入可查看图片列表 |
| 收益 / 账本 / 积分各标签 | resources/{resource} | Java资源白名单/商城岗位控制；平台转赠、冻结复核不再切回第一店 |
| 积分：冻结复核 | commands/point-freeze-review | PENDING/RETAINED，复核原因；Java处理账户状态 |
| 渠道：重试处理 | POST channel/retry/{id} | ERROR才显示；补重复点击保护、失败原因与成功回读 |
| 对账：下载模板 / 导入CSV | 本地CSV解析 / commands/reconcile-import | 列头、字段、整数分、1–5000条、2MB匹配；任务状态轮询 |
| 对账：查看批次明细 | GET statements/{id}/lines | 批次编号编码；Java校验商城归属；可返回最近明细 |
| 对账：重新核对 | commands/reconcile-recheck | 非已解决/处理中记录；补重复点击保护和失败提示 |
| 对账：申请调整 | commands/adjustment-propose | AMOUNT_MISMATCH；补2–500字原因、1–9份凭证本地校验 |
| 对账：调整复核 | commands/adjustment-review | PENDING；无论通过/驳回均须复核意见；Java拒绝申请人自审 |
| 代理 / 客户：详情 | members/{id}/profile?shopId | 真实 profile 白名单、脱敏手机号、头像；不提供后台改会员资料动作 |
| 申请：代理/迁移/开店/晋升/降级/交接/联动/跨店 | commands/document-review | 补SUPPLEMENT可审核；保留OWNER/平台权限及各流程确认条件 |
| 申请：结算账户 / 客服 / 评价 / 追评 / 盘点 | commands/document-review | 已移除错误只读挡板；新增documents/review_append入口沿用review权限；盘点/联动审核须填写依据；权限按Java执行 |
| 团队迁移：生成 / 审核 | agency/team-migration、{id}/review | 字段匹配；补有效根代理与其他目标商城校验 |
| 考核：核算已结束周期 | commands/assessment-run | 真实周期任务；补重复点击保护，成功回读 |
| 岗位：核对账号 | operations/staff-lookup | 补登录账号格式、返回表单/账号/商城快照核对，防旧ID填入新账号 |
| 岗位：分配 / 调整 / 停用 | commands/staff-assign | 不直接修改平台账号；有效角色、原因；Java拒绝改本人/平台管理员 |
| 分红：新建版本 | commands/rule-create | 0–10000基点、有效不追溯日期；留空日期前端阻止提交 |
| 营销：金额试算 | commands/marketing-preview | 真实身份/优惠/积分，只读试算；不创建订单 |
| 各营销配置：新增 / 编辑保存 | commands/document-save | 当前19种settingFields表单逐项对照；补JSON对象/数组形状校验 |
| 装修：上传 / 移除图片 | attachments STOREFRONT、document-save | 上传前保留无效用户JSON并提示；移除同步清掉banner/asset引用 |
| 活动：书面确认图片 | attachments LINK_CONFIRMATION | 原详情漏 confirmationFile，已可查看；当前上传者归属限制保持 |
| 审计：详情 | operations/audit/{id} | 使用专用脱敏审计接口，失败捕获 |
| 备份：立即加密备份 | POST backups | 平台权限由Java执行；补重复点击保护与失败提示 |
| 商户：进件 / 授权 / 证书 | merchant/submit、authorize、certificate | 白名单表单、必填/费率校验、保存后读取；忙时锁定当前商城 |
| 商户：上传 / 查看主体证明 | attachments MERCHANT | 补已保存和编辑中的图片预览、5MB/真实类型前置校验 |
| 商户：补渠道编号 / 核验 / 驳回 | merchant/reference、verify | 编号格式、阶段状态、平台核验；补并发点击保护 |
| 协议：发布 / 查看 / 授权审计 | policies/publish、policies、policies/consents | 正文长度/版本校验；保存后回读；正文按文本渲染 |
| 拣货：开始 / 完成 | fulfillment/pick/{id}/{action} | PAID + NOT_STARTED/IN_PROGRESS；确认时切店则取消旧动作 |
| 拣货：打印 | fulfillment/pick/{id}/print | 原订单真实地址/商品；弹窗失败提示；DOM textContent防HTML注入 |
| 直发：新增 / 补关联 / 查看公司售后 | aftersale-links、candidates、referral route | 补候选加载完成前禁提交、商城切换取消旧候选；Java核对SKU/数量 |
| 报表：生成 | commands/report-create | 日期/整数编号前置校验、重复点击保护、明确错误 |
| 报表：任务 / 维度 / 结果分页 / 库存分页 | reports、reports/{id}、inventory | 增加独立请求版本，防同报表快速分页旧结果覆盖；失败停止自动重试并提示 |
| 报表：导出全量结果 / 库存 | reports/{id}/export | 保存当前任务ID/日期快照，重复点击保护；真实全量服务端CSV |

## 剩余契约限制

- 其他后台人员编辑保存的活动/装修配置时，`HexuWorkflowService.save()` 仍按当前操作人检查旧 `body.uploads`；联动确认图亦限制为当前操作人。前端没有绕过附件归属校验，也没有擅自丢弃已保存资料；被拒绝时显示真实原因。这是已有后端权限契约，跨人员接手编辑需要明确后端规则。
- 外部微信进件、支付、转账、物流能力取决于已配置渠道；源码匹配和本地测试不能替代渠道真机验收。

## 验证边界

2026-09-27 真实点检发现 `name` 被通用商品字段误标、地区数组显示 JSON、原始金额分未换元及客户/代理的合成空昵称。已按模块/当前页签匹配详情标签，并以明确金额白名单换元，积分/编号/数量/基点保持原值；仅documents生成合成title。地区按省/市/区 join，空值显示 `—` / `未填写`，保留 `0` 与布尔值。新增4个回归测试；本代理已在独立Edge真实复验商品/订单/退款/收益/积分和客户/代理、新追评入口。完整实页记录见 `../../docs/admin-page-check-20260927.md`，不能以该记录中的部分通过推导未测业务分支。

现有管理端测试覆盖 API 路径编码、商户表单请求/校验、售后候选及地址格式、银行卡结果契约，以及本轮平台积分范围、图库编辑隔离、只读资料字段/脱敏来源、头像路由白名单、上下文标签/金额语义、JSON/Blob 业务错误提示；生产构建只证明可编译。这些不能单独证明浏览器每个页面/动作已验收，也不能证明微信支付、头像真机授权或外部物流渠道可用。真实页面结果与未测分支另见独立实页记录。

## G25 售后商品图片读模型补齐（后续单独授权）

主代理发现 G25 使用写死的 stapler 图后，另行授权本代理最小修改 Java，前端由主代理负责。会员 `/hexu/app/account?shopId=` 与 bootstrap 的 `account.refunds`、管理 `/hexu/admin/resources/refunds?shopId=` 现复用 `HexuReadModels.refunds`：保留全部原售后字段，仅新增白名单 `sku_id`。以 `hx_refund.line_id = hx_order_line.id AND hx_refund.order_id = hx_order_line.order_id` 做 LEFT JOIN；缺明细或错单关联返回空字符串，保留售后记录，不生成假图。没有联出地址、手机号、价格成本快照或额外订单数据。会员/商城过滤、管理 SUPPORT/OWNER/平台权限及管理500条上限保持不变。

新增独立 `HexuRefundReadModelTest` 6 项，覆盖会员 account 与管理资源真实调用、按具体 line 而非首件商品、缺/错明细空值、会员/商城隔离、SUPPORT 岗位权限、原字段保持与不泄露快照、历史 SKU 不依赖当前目录。Maven 由后端代理统一执行，避免并行构建，最新 package exit0 / 全量183项通过（Business146/Profile11/Review18/Refund6/UiAsset2，错误/失败/跳过0）。本代理实际读取新退款测试XML核对6/6全过，并确认jar生成时间2026-09-27 13:24:57 -04:00；未重启/部署，也未改变新单评价状态。此段是源码与测试契约说明，部署后的 G25 真 UI 图片需主代理另行复验。

## 订单与跨店评价图片读模型（后续单独授权）

源码确证：`hx_sku.asset/spec` 是商品封面及规格，图库在 `hx_sku_detail.gallery_json`；`hx_order_line` 及现有成交快照未保存 asset/spec。原订单 list/detail 只返交易明细，前端以当前全局目录查同名 SKU，找不到则误用 stapler 图片。主代理另行授权本代理只改 `HexuOrderService.java` 与独立测试，前端/Review 由其他负责人接入，不并行 Maven，不部署/重启。

- 订单 detail/list 每条 line 新增 `asset`、`spec`，从订单自己的 `shop_id + sku_id` 精确范围查询，而不是当前页面商城或其他店同名SKU；缺SKU时均为空字符串。
- asset 仅为既有可信 `/hexu/app/ui-assets/...` 或已发布 `/hexu/app/attachments/product/FILE...` 规范路径，不返回可被当前装修配置重新解释的裸资源别名。未知URL、私有附件路径、非PRODUCT用途、跨店FILE均空。
- FILE复用现 `publishedProduct` 门禁：同店 PRODUCT 附件 + ACTIVE 商城 + 仍有 ACTIVE 商品封面/图库公开引用。历史商品下架后未再公开的FILE图为空；同店另一ACTIVE商品仍公开引用时仅保持既有允许，不放开私人附件接口。
- name、qty、unit_price、paid仍来自原交易line，不由商品当前价格/名称覆盖；会员detail的成本快照继续去除，不新增库存、职级成本字段。旧库没有冻结图片/规格快照，返回的是订单原商城当前安全公开元数据，不能伪称下单时的冻结规格。
- 新独立 `HexuOrderImageReadModelTest` 8 项，覆盖订单detail/list实际商城、同名SKU隔离、规范资源路径、公开PRODUCT/图库、各私有用途及跨店拒绝、下架与商城公开门禁、删除SKU、未知URL、原交易字段及授权保留。后端代理统一 package exit0，192/192全过（Business146/OrderImage8/Profile11/Refund6/Review19/UiAsset2）。本代理读取新OrderImage XML独立核对8项、失败/错误/跳过0；jar生成2026-09-27 13:34:56 -04:00，104901970字节。业务代码冻结，未部署/重启；部署后真实图片需主流程实页复验。
