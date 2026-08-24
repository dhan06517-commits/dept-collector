# 月度工作汇报系统

> 部门月度工作汇报填报 + 跨部门汇总系统
> Netlify Functions + GitHub Repo JSON 存储

## 项目简介

公司内部月报收集工具。每个月群里相关人员（15-20 人）点链接填自己的月报，管理员进汇总页查看所有人 / 全部 4 大模块的填报情况。

### 4 大模块

1. **本月重点工作完成情况**（必填，4 选 2）
2. **业务核心指标完成情况**（必填，3 选 1）
3. **重点项目 / 专项任务推进情况**（选填）
4. **工作难点**（必填，4 选 2）

每个子项可以添加多条 bullet 自由描述。

## 技术栈

- **前端**：单文件 HTML（白底 + 蓝主题 + Lucide 图标 + 卡片化）
- **后端**：Netlify Functions 4 个端点（submit / list / delete / clear）
- **存储**：GitHub Repo 文件（`data/monthly-reports.json`），每次操作产生一个 commit
- **认证**：管理员用 Basic Auth（`btoa('admin:' + password)` 拼 header）
- **HTTPS**：Netlify 自动
- **仅限当月**：服务端校验 `period === currentPeriod()`

## 文件结构

```
dept-collector/
├── index.html              # 前端单文件
├── netlify/
│   └── functions/
│       ├── submit.js       # POST /api/submit    任何人
│       ├── list.js         # GET  /api/list      任何人
│       ├── delete.js       # POST /api/delete    Basic Auth
│       └── clear.js        # POST /api/clear     Basic Auth
├── netlify.toml            # Functions + CORS 配置
├── package.json            # 依赖（当前未用）
├── README.md
└── data/                   # 运行时自动创建
    └── monthly-reports.json
```

## URL 参数

| 参数 | 作用 |
|------|------|
| `?admin=admin123` | 进入管理员汇总视图 |
| `?reset=1` | 清空 localStorage（开发调试用） |

## 使用

### 填表端

访问：
```
https://<your-site>.netlify.app/
```

填表人操作：
1. 填期次（默认本月，可改）
2. 填部门 / 市公司
3. 填姓名
4. 至少填 1-2 条 bullet（必填模块）
5. 点"提交月报"

### 管理员端

访问：
```
https://<your-site>.netlify.app/?admin=admin123
```

输入管理员密码 → 解锁后看到：
- 顶部统计：本月共 X 份提交
- 4 大模块分块，每个模块下列出填了该模块的部门
- 每条记录右侧有"删除"按钮
- 右上角"全部清空"按钮

## API 端点

| Method | Path | 鉴权 | 功能 |
|--------|------|------|------|
| GET | `/api/list` | 任何人 | 列出所有月报；可加 `?period=YYYY-MM` 过滤 |
| POST | `/api/submit` | 任何人 | 提交/覆盖一条月报 |
| POST | `/api/delete` | **Basic Auth** | 删除单条 |
| POST | `/api/clear` | **Basic Auth** | 清空所有 |

## 配置

### 1. Netlify 项目设置

1. Netlify 后台 → Project configuration → Environment variables
2. 添加：
   - **`GITHUB_TOKEN`**：Fine-grained PAT，**Contents: Read and write**，仅作用于 `dhan06517-commits/dept-collector` 仓库
   - （可选）**`ADMIN_PASSWORD`**：管理员密码（默认 `Kd8@mP3#xL9qV2wN`）
3. 修改任一环境变量后，必须 **Trigger deploy** 才会生效

### 2. GitHub PAT 生成

1. 打开 https://github.com/settings/personal-access-tokens/new
2. Token name: `netlify-monthly-report`
3. Expiration: 90 days
4. Repository access: Only select `dhan06517-commits/dept-collector`
5. Permissions → Repository permissions → **Contents: Read and write**
6. Generate token → 复制保存

### 3. 修改代码中的密码

`netlify/functions/delete.js` 和 `clear.js` 顶部：
```js
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Kd8@mP3#xL9qV2wN';
```

`index.html` 顶部：
```js
const CONFIG = {
  ADMIN_PASSWORD: 'Kd8@mP3#xL9qV2wN'
};
```

## 开发调试

### 本地启动

```bash
# 直接打开（仅前端）
# 双击 index.html

# 用 Python 启动（需要后端用 Netlify Dev）
python -m http.server 8765
```

### 清空测试数据

浏览器访问：
```
https://<your-site>.netlify.app/?admin=admin123
```

输入密码 → 点"全部清空"。

### 恢复误清的数据

GitHub Repo 文件历史：
```
https://github.com/dhan06517-commits/dept-collector/commits/main/data/monthly-reports.json
```

找到清空前最后一次有效 commit → Restore file → 提交。

## 部署流程

### 首次部署

1. 代码推 GitHub（SSH 推送，已配置）
2. Netlify 后台 → Site settings → Build & deploy → Continuous deployment → Connect to Git → 选 GitHub → 选 `dept-collector` 仓库
3. 部署配置：Build command 留空，Publish directory = `.`，Functions directory = `netlify/functions`（自动）
4. 点 Deploy site
5. 第一次部署完成后，去 Project configuration → Environment variables 设 `GITHUB_TOKEN`

### 后续修改

```bash
git add .
git commit -m "..."
git push
```

Netlify 自动 build + 部署。

## 安全提示

- **Basic Auth 密码**：浏览器会缓存到内存，关标签才失效。建议每次开新无痕窗口
- **GITHUB_TOKEN**：不要发给任何人；定期重新生成（90 天到期）
- **删除 / 清空**：是真的删除 GitHub Repo 的内容，但 GitHub 保留 commit 历史可恢复
- **填表人**：任何人都能 POST 提交，可伪造"姓名"。如果担心，需加用户认证（超出当前方案）

## 已知限制

- 15-20 人小团队最合适
- 每月提交量 < 50 条（GitHub Repo 文件 < 100KB）
- 没审计日志（看不到谁改了什么）
- 浏览器 fetch 默认 UTF-8，所以前端提交不会出问题

## 故障排查

| 问题 | 解决 |
|------|------|
| `/api/list` 返回 503 | 没设 `GITHUB_TOKEN` 环境变量 |
| `/api/list` 返回 401 | Token 权限不够，Contents 要 Read and write |
| 中文乱码 | 浏览器强刷（`Ctrl + Shift + R`）确保加载最新 JS |
| 提交后没反应 | F12 Console 看错误；检查 Network 面板 |
| 找不到部门 | 列表就是固定的"财务部 / 人力资源部 / 市场部"等历史部门（自动从数据生成） |

## 维护建议

- **每月初**清空上月数据前**先确认所有部门已提交**（管理员汇总页看 `X / Y 部门已提交`）
- **GitHub Repo 的 commit 历史是天然的备份**，所有数据都在里面可恢复
- 每 90 天更新一次 GitHub Token

---

**项目地址**：
- 填表端：https://calm-sawine-3834e9.netlify.app/
- 管理员：https://calm-sawine-3834e9.netlify.app/?admin=admin123
- 管理员密码：默认 `Kd8@mP3#xL9qV2wN`（建议改）
- 测试 Vercel Git 自动部署 (auto-deploy test)

- **最后更新**: 2026-08-21 17:57:54

- Vercel Deploy Hook 集成测试
