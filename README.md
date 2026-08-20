# 月度工作汇报系统

> 部门月度工作汇报填报 + 跨部门汇总系统（Netlify Functions + Blobs 后端）

## 功能简介

公司内部月报收集工具。每个月群里相关人员（15-20 人）点链接填自己的月报，管理员进汇总页一键查看所有人 / 全部 4 大模块的填报情况。

### 4 大模块

1. **本月重点工作完成情况**（必填，4 选 2）
   - 已完成重点工作 / 重要会议 / 对外输出成果 / 外部反馈 / 政策落地
2. **业务核心指标完成情况**（必填，3 选 1）
   - 业务指标实际完成 / 同比环比变化 / 特色创新业务
3. **重点项目 / 专项任务推进情况**（选填）
   - 本月进展 / 本部门职责 / 协同外部单位
4. **工作难点**（必填，4 选 2）
   - 业务问题 / 内部协同需求 / 外部协调需求 / 风险提示

每个子项可以添加多条 bullet 自由描述。

## 架构

```
填表人/管理员浏览器
  └─ index.html（前端 SPA）
       └─ fetch('/api/...')
            └─ Netlify Functions (Node.js)
                 └─ Netlify Blobs (KV 存储)
```

- **前端**：单文件 HTML（白底 + 蓝主题 + Lucide 图标 + 卡片化）
- **后端**：Netlify Functions 4 个端点（submit / list / delete / clear）
- **存储**：Netlify Blobs（每个 record 一个 blob key）
- **认证**：管理员用 Basic Auth（前端用 `btoa('admin:' + password)` 拼 header）
- **HTTPS**：Netlify 自动
- **仅限当月**：服务端校验 `period === currentPeriod()`，防止补录历史

## 文件结构

```
dept-collector/
├── index.html              # 前端单文件（含 Store / ReportForm / Admin / Progress）
├── netlify/
│   └── functions/
│       ├── submit.js       # POST /api/submit    （任何人）
│       ├── list.js         # GET  /api/list      （任何人）
│       ├── delete.js       # POST /api/delete    （Basic Auth）
│       └── clear.js        # POST /api/clear     （Basic Auth）
├── netlify.toml            # Functions + CORS 配置
├── package.json            # @netlify/blobs 依赖
└── README.md
```

## URL 参数

| 参数 | 作用 |
|------|------|
| `?admin=admin123` | 进入管理员汇总视图（密码框） |
| `?reset=1` | 清空 localStorage（开发调试用，生产无副作用） |

## 本地运行

### 方式 1：直接打开（**仅前端**）
```bash
# 双击 index.html，或在浏览器中拖入
```
- 缺点：API 调用会 404（因为没有 Netlify Functions）

### 方式 2：Netlify Dev（推荐）
```bash
# 安装 netlify CLI
npm install -g netlify-cli

# 在项目根目录运行
netlify dev
```
- 启动后访问 `http://localhost:8888`（端口由 netlify 自动分配）
- 可同时测试前端 + 4 个 Functions
- 注意：需要先登录 `netlify login` 并关联一个 Netlify 站点（即使是空的）

## 部署到 Netlify

### 自动部署（推荐）
1. 把代码推到 GitHub（已配 SSH key）
2. Netlify 后台 → 你的项目（`calm-sawine-3834e9`）→ **Build & deploy** → **Continuous deployment** → **Connect to Git** → 选 GitHub → 选 `dept-collector` 仓库
3. 之后 `git push` → Netlify 自动 build + deploy

### 首次部署配置
- Build command：**留空**（无构建步骤）
- Publish directory：**`.`**
- Functions directory：`netlify/functions`（已通过 `netlify.toml` 配好）

### 验证 Functions 工作
部署后测试：
```bash
curl https://your-site.netlify.app/api/list
# 应返回 {"records":[],"count":0,"period":null}
```

## API 端点

| Method | Path | 鉴权 | 功能 |
|--------|------|------|------|
| GET | `/api/list` | 任何人 | 列出所有月报；可加 `?period=YYYY-MM` 过滤 |
| POST | `/api/submit` | 任何人 | 提交/覆盖一条月报；body `{record}` |
| POST | `/api/delete` | **Basic Auth** | 删除单条；body `{id}` |
| POST | `/api/clear` | **Basic Auth** | 清空所有 |

### 当月校验
`submit.js` 服务端强制 `record.period === currentPeriod()`，否则返回 400。前端默认填当前月，但即使前端被绕过也无法补录历史月。

### 去重
按 `(period, dept, name)` 三元组去重。同部门同月同人提交时，新记录覆盖旧记录，返回 `replaced: true`。

## 安全配置

### 默认管理员密码
```js
const CONFIG = {
  ADMIN_PASSWORD: 'Kd8@mP3#xL9qV2wN'
};
```
后端函数默认值一致（`netlify/functions/delete.js`、`clear.js`）。

### 修改密码
有 3 处需要同步修改：
1. `index.html` 顶部 `CONFIG.ADMIN_PASSWORD`
2. `netlify/functions/delete.js` 顶部 `ADMIN_PASSWORD` 默认值
3. `netlify/functions/clear.js` 顶部 `ADMIN_PASSWORD` 默认值

或者使用 Netlify 环境变量（推荐）：
- Netlify 后台 → Site settings → Environment variables
- 新增 `ADMIN_PASSWORD = <你的新密码>`
- 改 3 处代码读取 `process.env.ADMIN_PASSWORD`（已是 fallback `|| 'Kd8@mP3#xL9qV2wN'`）

### 安全特性
- ✅ HTTPS（Netlify 自动）
- ✅ Basic Auth 保护删除/清空接口
- ✅ 16 字符强密码
- ✅ 当月校验（防历史补录）
- ✅ CORS 限制（`/api/*` 允许跨域）

### ⚠️ 已知限制
- **任何人都能 POST 提交**：恶意用户可伪造"姓名"提交别人的月报，但 service 端会按 (period,dept,name) 三元组去重覆盖
- **没用户认证**：无法限制"只有真实填报人才能改自己的记录"
- **无访问日志**：没有"谁删了什么"的审计
- **Netlify Blobs 500MB 免费**：15-20 人每月 12 月约 1.2MB，足够 100+ 年

## 常见问题

**Q: Functions 部署失败？**
A: Netlify 后台 → Deploys → 看 build log；常见原因：package.json 缺依赖、netlify.toml 路径错、Node 版本不匹配。

**Q: 浏览器报 CORS 错误？**
A: 部署后应该不报（netlify.toml 已配 CORS）。本地打开 `index.html` 会报，因为没起 Netlify Functions。

**Q: 怎么测 API？**
A: 用 `curl` 或 Postman：
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"record":{"id":"test1","period":"2026-08","dept":"测试","name":"测试员","ts":"2026-08-17","keyWork":{},"coreKpi":{},"projects":{},"difficulties":{}}}' \
  https://your-site.netlify.app/api/submit
```

**Q: 数据丢失怎么办？**
A: Netlify Blobs 数据持久化在 Netlify 云上。免费层有 500MB 限制。不会因为浏览器/电脑关机丢失。

**Q: 想清空所有数据？**
A: 管理员进 admin 视图 → 点"全部清空"按钮（双确认）。也可直接 `curl -X POST -H "Authorization: Basic <base64>" https://your-site.netlify.app/api/clear`。

## 开发调试

- `?reset=1` 清空 localStorage（仅清浏览器本地）
- `?admin=admin123` 进入管理员视图
- 在 Netlify Dev (`netlify dev`) 下可以本地完整测试前端 + 后端

## 部署后修改步骤

1. 改代码
2. `git add .`
3. `git commit -m "..."`
4. `git push`（如已接 Git 自动部署 → Netlify 30 秒后新版上线）
5. 没接 Git：手动拖文件夹到 Netlify Deploys 页面

---

**项目维护**：纯前端 + Netlify Functions，零服务器成本，适合 15-50 人小团队月报场景。
