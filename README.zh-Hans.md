# Fairhaul 货运智能体

*由 Claude 翻译，尚待母语人士审校。以英文 [README](README.md) 为准。*

三十个面向货运和发货成本的小型 MCP 智能体。每个只负责 **一件事**，例如审核运费账单、编制月末运费预提、结算承运商付款或核对报关单，并且无法越界。它们读取您已经从 TMS、ERP、WMS、承运商门户和 EDI 服务商导出的文件，在您的电脑上写出报告，并在任何动用资金、发送消息或更改生产系统的操作之前等待一位具名人员确认。

MIT 许可证 · Node 20 或更高版本 · 仅本地文件 · 无需凭据 · 无依赖

## 试用

```bash
npx -y fairhaul-freight-bill-audit demo        # 用虚构数据审核运费账单
npx -y fairhaul-freight-accruals demo     # 用虚构数据编制运费预提
```

每个智能体都有基于虚构文件的 `demo`、用自身测试用例检查的 `eval`，以及供 Claude Desktop、Claude Code、Cursor 等 MCP 主机使用的 MCP 服务器（`npx -y <agent> mcp --root <文件夹>`）。目前列名和报告为英文。

## 智能体

**承运商收费：** `fairhaul-freight-bill-audit`（整车和零担账单与合同核对）、`fairhaul-parcel-refunds`（快递）、`fairhaul-detention-and-lumper`（压车和等待费）、`fairhaul-fuel-surcharges`（燃油附加费）、`fairhaul-accessorial-charges`（附加服务费的来源）、`fairhaul-ltl-reweighs`（复磅和等级变更）、`fairhaul-duplicate-payments`（重复付款）、`fairhaul-ocean-freight-audit`（海运）、`fairhaul-air-freight-audit`（空运）、`fairhaul-proof-of-delivery`（签收证明）、`fairhaul-container-demurrage`（集装箱免费期和滞期费）、`fairhaul-customs-entries`（报关单与商业发票核对，不提供归类建议）。

**规划、采购和运营：** `fairhaul-rfp-bid-scoring`（招标）、`fairhaul-contract-rerating`（用每份合同重算历史）、`fairhaul-spot-quotes`（即期报价）、`fairhaul-lane-spend`（线路支出和拼载）、`fairhaul-carrier-scorecards`（承运商记分卡）、`fairhaul-carrier-vetting`（欺诈警示信号）、`fairhaul-load-tracking`（延误货物）、`fairhaul-dock-scheduling`（月台预约）、`fairhaul-carton-sizing`（纸箱尺寸）、`fairhaul-edi-files`（读取并核对 X12 文件）。

**结账与成本：** `fairhaul-freight-accruals`（运费预提）、`fairhaul-freight-allocation`（按订单和成本中心分摊运费）、`fairhaul-standard-freight-cost`（物料成本中的运费标准）、`fairhaul-freight-margins`（按客户比较收取运费与实际运费）、`fairhaul-broker-settlements`（经纪商承运商付款）、`fairhaul-freight-claims`（货损索赔）、`fairhaul-returns-tracking`（退货到退款）、`fairhaul-freight-emissions`（按您选择的系数估算排放）。

## 如何保持安全

- **每个智能体的允许清单。** 每个智能体只能调用自己的工具。
- **模型看到之前先脱敏。** 包裹和退货收件人、签收人、联系人和司机的姓名替换为假名（`CU-3f2a9c1d`、`ST-8cea1a2d`），电话、邮箱和街道地址替换为占位符。承运商和客户的公司名称、货物和发票编号、日期和金额照原样发送（`--pii strict` 也会隐藏公司名称）。写在您电脑上的文件保留真实值。
- **拒绝的工具。** 付款、发送邮件、更改 TMS、过账到总账或向海关申报都被点名并禁止。
- **一次具名点击。** 付款、发送、生产变更和凭证批准，即使在 Auto 模式下也等待具名人员，并与已审阅草稿的 sha256 绑定。
- **审计日志** 保存在 `.fairhaul/`，以哈希链连接；配置 Ed25519 密钥后会签名。
- **紧急停止：** `<agent> kill` 会停止所有工具，直到 `<agent> unkill`。

## 如何测试

每个智能体都有针对自身规则的专门测试、与所有智能体相同的契约测试（参数、`--root` 之外的文件、审阅模式、紧急停止、草稿审批、结果可重复）以及基于虚构文件的 14 到 22 个评估用例。每个读取表格的用例都会再按德国、法国、西班牙、巴西、意大利、日本、中国和韩国的导出格式运行一次，并在每个智能体的文件中植入恶意数据。合计 953 项测试和 551 个评估用例，在 Node 20、22 和 24 上全部通过。第 2 版的改动和发现的缺陷见 [REVIEW-ver3.md](REVIEW-ver3.md)（英文）。

## 限制

- 每个智能体只使用您提供的文件，不会登录任何承运商、TMS、ERP、银行或政府系统。
- 不构成法律、税务、海关或会计建议。由人来决定和执行。
