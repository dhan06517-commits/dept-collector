# 月度工作汇报系统

> 公司内部月报收集与跨部门汇总工具
> Vercel Serverless Functions + GitHub Contents API 存储

## 一、项目目标

每个月群里相关人员（15-20 人）点链接填自己的月报，管理员进汇总页查看所有部门的填报情况。

适合：

- 单一组织 / 部门群组
- 每月填报量 < 50 条
- 不需要审计日志
- 接受"URL保密 + 浏览器端 PIN"作为访问控制

不适合：

- 数百人以上的大规模收集
- 多人协作编辑同一份记录
- 需要严格审计或合规的场景

---

## 二、功能模块

填表端包含 **4 大模块**：

| # | 模块 | 必填项数 | 说明 |
|---|------|---------|------|
| 一 | 重点工作推进情况 | 前 13 项 / 14 项 | 第 14 项为"其他"，选填 |
| 二 | 当前问题和困难 | 1 项 | 必填 |
| 三 | 部门/市公司开展的其他工作 | 1 项 | 必填 |
| 四 | 下一步工作打算 | 前 13 项 / 14 项 | 第 14 项为"其他"，选填 |

每个子项可添加多条 bullet 自由描述。

### 字段定义（前端 `MODULES` 常量）

`keyWork` / `nextSteps` 模块的 14 项针对"班列运营"行业场景定制，包括：班列开行组织服务保障、内外沟通协调、集结中心建设、通道线路建设、审计整改、"班列+"业务、服务产品打造、数字班列、境外服务体系、业务宣传、运贸融合、管理制度、统筹安全发展、其他。

> ⚠️ 当前 14 项是硬编码。如需调整，直接改 `index.html` 中 `MODULES` 常量即可。

---

## 三、技术架构

```
┌─────────────┐    HTTPS     ┌──────────────────┐
│  填表浏览器  │ ──────────► │  Vercel Edge     │
│  (任何人)    │              │  + Static HTML   │
└─────────────┘              └────────┬─────────┘
                                      │
┌─────────────┐    HTTPS              │  Vercel
│ 管理员浏览器 │ ──────────►   Serverless Functions
│ (知道 PIN)  │                      │
└─────────────┘                      │
                                      ▼
                            ┌──────────────────┐
                            │ GitHub Contents  │
                            │   API (REST)     │
                            │  + PAT (Token)   │
                            └────────┬─────────┘
                                     │
                                     ▼
                            ┌──────────────────┐
                            │ data/monthly-    │
                            │ reports.json     │
                            │ (每次写=1 commit)│
                            └──────────────────┘
```

### 技术选型

| 层 | 选型 | 理由 |
|---|------|------|
| 前端 | 单文件 HTML + 原生 JS | 零构建、零依赖、易部署 |
| UI | 自写 CSS（白底 + 蓝主题）+ Lucide 图标 | 轻量、风格统一 |
| 后端 | Vercel Serverless Functions (Node 18+) | 部署即用、按调用计费 |
| 存储 | GitHub Repo JSON 文件 | 利用 Git 作为天然的版本管理 |
| 认证 | 客户端 PIN + URL `?admin=admin123` | 不依赖服务端环境变量 |

---

## 四、文件结构

```
dept-collector/
├── index.html              # 前端单文件（含全部 CSS + JS）
├── api/                    # Vercel Functions
│   ├── _github.js          # GitHub Contents API 封装
│   ├── config.js           # GET  /api/config   （已禁用，预留扩展）
│   ├── submit.js           # POST /api/submit   任何人
│   ├── list.js             # GET  /api/list     任何人（仅返摘要，不含内容）
│   ├── admin-list.js       # GET  /api/admin-list 任何人（返完整内容）
│   ├── delete.js           # POST /api/delete   任何人
│   └── clear.js            # POST /api/clear    任何人
├── data/
│   └── monthly-reports.json  # 运行时数据
├── vercel.json             # 全局响应头 + CORS
├── package.json            # "type": "module"
├── .gitignore
├── README.md               # 旧版文档（含 Netlify 历史）
├── README_SECURITY.md      # 安全白皮书（旧版，部分已过时）
├── USER_GUIDE.md           # 用户指南（旧版）
└── PROJECT.md              # 本文档（最新）
```

---

## 五、API 端点

| Method | Path | 鉴权 | 功能 |
|--------|------|------|------|
| GET | `/api/list?period=YYYY-MM` | 任何人 | 列出月报摘要（部门/姓名/完成度） |
| GET | `/api/admin-list?period=YYYY-MM` | 任何人 | 列出月报完整内容（含 bullet 文本） |
| POST | `/api/submit` | 任何人 | 提交/覆盖一条月报（仅限当月） |
| POST | `/api/delete` | 任何人 | 删除单条月报（按 id） |
| POST | `/api/clear` | 任何人 | 清空所有月报 |

### 数据脱敏规则

- `/api/list` 返回的记录只含：`id, period, dept, name, ts, meta, completion`
- `/api/admin-list` 返完整记录（含 `keyWork/difficulties/otherWork/nextSteps` 内容）
- 前端填表端只调 `/api/list`，管理员端调 `/api/admin-list`

### 服务端校验

- `period === currentPeriod()` —— 仅接受当月提交，跨月提交 400 拒绝
- 提交时按 `period|dept|name` 作为唯一键覆盖更新
- 服务端注入审计 metadata：`submittedAt / submittedIp / submittedUa`

---

## 六、访问控制

### 三道门

1. **URL 参数**：`?admin=admin123` 才能进入管理页（虽然不影响 API 调用，但控制 UI 入口）
2. **客户端 PIN**：管理页要求输入 6-12 位 PIN，浏览器算 SHA-256 后与 `ADMIN_PIN_HASH` 比对
3. **sessionStorage 解锁状态**：解锁后 `sessionStorage.adminUnlocked='1'`，关闭 tab 即失效

### PIN 的工作机制

- 代码中**只存哈希**（SHA-256），明文 PIN 不进代码、不进 commit、不进聊天
- `ADMIN_PIN_HASH` 为空时，**任何人都进不去**（显示"PIN 未配置"提示）
- 输入错误 → 红色"PIN错误，请重试"
- sessionStorage 被清后 → 下次进入需重新输 PIN

### API 端点本身无服务端鉴权

`/api/admin-list`、`/api/delete`、`/api/clear` **不需要任何 token**。它们的访问控制完全靠：

- URL 域名保密（Vercel 域名）
- `GITHUB_TOKEN` 是**部署时**的环境变量，不暴露给前端
- 任何能访问站点 URL 的人理论上可调这些 API

**这是有意的简化**：项目设计为"15-20 人内部工具"，URL 保密 + GitHub Token 不暴露 = 实际访问控制。

如果未来需要更强的鉴权，可考虑：

- Vercel Deployment Protection（站点级 Vercel 访问密码）
- 在 API 端检查 `Origin` / `Referer` 头
- 给 API 加 Cloudflare Turnstile 等 CAPTCHA

---

## 七、部署

### 首次部署

1. 把代码推送到 GitHub Repo（`dhan06517-commits/dept-collector`）
2. Vercel → Import Project → 选这个 Repo
3. 部署配置：
   - Build Command：留空
   - Output Directory：`.`
   - Install Command：留空
4. 点 Deploy

### 配置环境变量

Vercel → Project → Settings → Environment Variables：

| 名称 | 必填 | 说明 |
|------|------|------|
| `GITHUB_TOKEN` | ✅ | Fine-grained PAT，Contents: Read and write，仅作用于本仓库 |
| `GITHUB_OWNER` | ❌ | 默认 `dhan06517-commits` |
| `GITHUB_REPO` | ❌ | 默认 `dept-collector` |
| `ADMIN_PASSWORD` | ❌ | 旧版遗留，新版不再使用 |

### 修改管理员 PIN

PIN 的 SHA-256 哈希在 `index.html` 顶部 `ADMIN_PIN_HASH` 常量。

**生成新 PIN 哈希**（推荐在浏览器里做）：

1. 打开站点任意页面，F12 → Sources 标签
2. 左侧找 **Snippets** → 新建一个
3. 粘贴：

   ```js
   (async () => {
     const buf = new TextEncoder().encode('你的新PIN');
     const h = await crypto.subtle.digest('SHA-256', buf);
     console.log(Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join(''));
   })();
   ```

4. 把 `'你的新PIN'` 替换成你想用的 PIN（**不要把明文 PIN 写到聊天 / commit / 截图里**）
5. Ctrl+Enter 运行
6. Console 会输出 64 位哈希字符串
7. 把哈希发给代码维护者，让 TA 替换 `ADMIN_PIN_HASH` 并 push

### 后续修改

```bash
git add .
git commit -m "..."
git push
```

Vercel 自动 build + 部署。

---

## 八、数据存储

### GitHub Repo JSON 文件

- 路径：`data/monthly-reports.json`
- 格式：`{ "records": [...] }`
- 每次写入产生一个 Git commit
- Git 历史即"天然备份"

### 记录结构

```json
{
  "id": "r_2026-08_测试部_测试一_1787304700469",
  "period": "2026-08",
  "dept": "测试部",
  "name": "测试一",
  "ts": "2026-08-21T09:31:40.469Z",
  "meta": {
    "submittedAt": "...",
    "submittedIp": "...",
    "submittedUa": "..."
  },
  "keyWork": {
    "m1": [{ "text": "...", "ts": "..." }],
    "m2": [...]
  },
  "difficulties": { "issues": [...] },
  "otherWork": { "otherDesc": [...] },
  "nextSteps": { "n1": [...], ..., "n14": [...] }
}
```

### 性能 / 规模约束

- 每条记录 ~5-10 KB
- 50 条以内文件 < 100 KB，GitHub API 读写都很快
- 100+ 条记录可能需要分页或换存储

---

## 九、安全现状（2026-08-24）

| 项目 | 状态 |
|------|------|
| HTTPS | ✅ Vercel 自动 + Let's Encrypt |
| HTTP Basic Auth challenge | ✅ 已移除（不再触发浏览器原生弹框） |
| 填表端内容保护 | ✅ `/api/list` 只返摘要 |
| 管理员 PIN | ✅ 客户端哈希比对 |
| 服务端鉴权 | ❌ 无（依赖 URL 保密 + GitHub Token 不暴露） |
| 提交者身份验证 | ❌ 无（任何人可提交） |
| 提交频率限制 | ❌ 无 |
| XSS | ✅ escapeHtml() 全覆盖 |
| CSP | ❌ 未配置 |
| HSTS | ✅ Vercel 默认开 |
| X-Frame-Options | ✅ DENY |
| Referrer-Policy | ✅ strict-origin-when-cross-origin |

详细历史安全分析见 `README_SECURITY.md`（部分内容已过时，建议重写）。

---

## 十、已知限制

1. **提交人可伪造** —— 任何人可提交，姓名/部门由用户自己填，无身份绑定
2. **无审计日志** —— 服务端虽记录 IP/UA，但前端看不到，无 UI 展示
3. **服务端无鉴权** —— 任何能访问站点 URL 的人可调管理 API
4. **不分页** —— 每月数据增长会拖慢列表 API（GitHub Contents API 每次读写整个文件）
5. **每月初需手动清空** —— 服务端不自动归档或清空历史

---

## 十一、改进方向

按优先级排序：

| 优先级 | 改进项 | 工作量 |
|-------|--------|--------|
| 🟢 高 | 加 Cloudflare Turnstile 防止机器人提交 | 小 |
| 🟢 高 | 服务端校验 `period` 改为允许补录最近 N 天 | 小 |
| 🟡 中 | 提交记录加唯一提交者标识（GitHub OAuth） | 中 |
| 🟡 中 | 服务端 IP 限流 | 小 |
| 🟡 中 | 月底自动归档上月数据 | 中 |
| 🔴 低 | 迁移到 SQLite / Cloudflare D1 | 大 |
| 🔴 低 | 增加提交者不能改已提交记录的锁定机制 | 中 |

---

## 十二、维护 Checklist

- [ ] 每 90 天更新一次 `GITHUB_TOKEN`
- [ ] 每月初清空上月数据前，先确认所有部门已提交
- [ ] GitHub Repo commit 历史是天然备份，**不要 force-push main 分支**
- [ ] 任何修改 `ADMIN_PIN_HASH` 前，确保新 PIN 已记牢

---

## 十三、相关链接

- 站点：https://dept-collector.vercel.app/
- 管理员入口：https://dept-collector.vercel.app/?admin=admin123
- GitHub Repo：（仓库所有者可见，参见 `git remote -v`）
- Vercel Dashboard：https://vercel.com/dashboard

---

**最近更新**：2026-08-24
**文档版本**：v2.0（反映 Vercel Functions + 客户端 PIN 架构）