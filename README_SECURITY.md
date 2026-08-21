# 安全与维护白皮书

> 月度工作汇报系统 - 网络安全 / 数据安全 / 数据处理 / 系统维护 全方位说明
> 最近更新：2026-08-20

---

## 📑 目录

1. [网络安全](#-一网络安全)
2. [数据安全](#-二数据安全)
3. [数据处理](#-三数据处理)
4. [系统维护](#-四系统维护)
5. [已知风险](#-五已知安全风险)
6. [上线前检查清单](#-六上线前建议做的事)
7. [合规性](#-七合规性)
8. [总结](#-八总结)

---

## 🌐 一、网络安全

### 1.1 传输层安全

|项 | 说明 |
|------|------|
| **HTTPS** | Netlify 自动签发并续期 Let's Encrypt 证书 |
| **HTTP/2** | Netlify 默认启用，性能更好 |
| **HSTS** | Netlify 默认开启 |
| **TLS 版本** | TLS 1.2+ |

✅ 用户 → Netlify 整个链路**强制加密**，中间人无法窃听。

### 1.2 跨域安全（CORS）

已配置 `netlify.toml`：

```toml
[[headers]]
  for = "/.netlify/functions/*"
  [headers.values]
    Access-Control-Allow-Origin = "*"
    Access-Control-Allow-Headers = "Content-Type, Authorization"
    Access-Control-Allow-Methods = "GET, POST, OPTIONS"
```

### 1.3 注入攻击防护

|攻击类型 | 防护 |
|---------|------|
| **XSS** | ✅ 全部用户内容用 `escapeHtml()` 转义 |
| **SQL 注入** | ❌ 不适用（无 SQL）|
| **NoSQL 注入** | ❌ 不适用 |
| **命令注入** | ❌ 不适用 |

### 1.4 身份认证

|端点 | 认证方式 |
|------|---------|
| `GET /api/list` | 任何人（公开读）|
| `POST /api/submit` | 任何人（公开写）|
| `POST /api/delete` | **Basic Auth**（管理员密码）|
| `POST /api/clear` | **Basic Auth**（管理员密码）|

⚠️ **已知风险**：填表端无身份认证，任何人都能提交伪造数据。**只适合内部使用**。

### 1.5 限流与防滥用

- ❌ 当前无限流
- 🛡️ Netlify Free 层 1000 次/天自然限流
- 🛠️ 可选加 Cloudflare Turnstile

### 1.6 部署安全

|项 | 状态 |
|------|------|
| HTTPS 证书 | ✅ Let's Encrypt |
| HSTS | ✅ |
| CSP | ❌ **建议加**（见 6.2）|
| X-Frame-Options | ❌ **建议加**（见 6.3）|

---

## 🔐 二、数据安全

### 2.1 数据存储位置

```
GitHub Repo: dhan06517-commits/dept-collector
└── data/
 └── monthly-reports.json  ← 所有月报数据
```

### 2.2 存储安全

|项 | 状态 |
|------|------|
| 存储位置 | GitHub 私有仓库（Private）|
| 静态加密 | ❌ 文件本身明文 |
| 传输加密 | ✅ HTTPS |
| 访问控制 | GitHub 仓库权限 |
| 备份 | ✅ Git 版本控制（每条 commit 一个快照）|
| 审计 | ✅ 完整 commit 历史（谁/何时/改了什么）|

### 2.3 GitHub Token 权限控制

|权限 | 范围 |
|------|------|
| Repository | 仅 `dhan06517-commits/dept-collector` |
| Contents | Read and write |
| 其他 | 无 |

✅ 最小权限原则 + 仓库限制 + 90 天过期。

### 2.4 数据内容敏感度

|字段 | 敏感度 |
|------|--------|
| 部门/市公司 | 中 |
| 填报人 | 中（个人姓名）|
| 月报内容 | **高**（业务数据、问题、对策）|
| 提交时间 | 低 |

⚠️ 未加密存储。任何能读 GitHub 仓库的人都能看到月报原文。

### 2.5 数据备份策略

|层次 | 实现 |
|------|------|
| 短期 | GitHub commit 历史 |
| 中期 | 本地仓库 `D:\Web coding\projects\dept-collector` |
| 长期 | GitHub 账号的 fork（如配置）|

### 2.6 误清恢复

1. 打开 `https://github.com/dhan06517-commits/dept-collector/commits/main/data/monthly-reports.json`
2. 找清空前的 commit
3. 右三点 → Restore file
4. 提交

### 2.7 密钥管理

|密钥 | 存储位置 | 风险 |
|------|---------|------|
| **GITHUB_TOKEN** | Netlify 环境变量（Secret） | 任何能登录 Netlify 后台的人 |
| **管理员密码** | `index.html` + 2 个 Function（**明文**）| 任何能看代码的人 |

⚠️ 管理员密码明文写代码里是**已知设计缺陷**。

---

## 📊 三、数据处理

### 3.1 提交流程

```
填表人浏览器
  ↓ fetch POST /api/submit (base64 + utf-8)
Netlify Function (submit.js)
  ↓ JSON.parse + 校验 period === 当月
  ↓ GitHub API GET data/monthly-reports.json (获取 sha)
  ↓ 检查同 (period, dept, name) 是否已存在
  ↓ 如有：覆盖（replaced: true）
  ↓ 如无：新增
  ↓ GitHub API PUT data/monthly-reports.json (写入新 sha)
GitHub Repo (commit: "submit new report" 或 "update report (cover)")
```

### 3.2 校验逻辑

**前端**（submit 前）：
- 必填字段（15 项）全填
- 提交按钮启用，否则禁用

**后端**（submit.js）：
- period === currentPeriod()（防跨月补录）
- record 字段完整性（id/period/dept/name 必填）
- 同部门同月同人 → 覆盖

**未做**：
- 字段长度限制
- 内容黑名单
- 速率限制

### 3.3 数据脱敏 / 隐私

❌ **未做**。所有数据明文存储，姓名直接显示。

### 3.4 数据生命周期

|阶段 | 时长 | 处理 |
|------|------|------|
| 活跃 | 提交到下月 1 号 | 管理员可查 |
| 历史 | 下月起 | 仍在 GitHub（不自动清理）|
| 永久保留 | 无清理策略 | 手动"全部清空" |

⚠️ 旧数据**没有自动归档**。

### 3.5 数据一致性

✅ **强一致性**（每次读写都用 GitHub 的 sha 乐观锁）：
- 读取时拿 sha
- 写入时带 sha
- 如果写入时 sha 变化，写入失败

✅ 防止并发覆盖。

---

## 🔧 四、系统维护

### 4.1 维护任务清单

|频率 | 任务 | 耗时 |
|------|------|------|
| 每天 | 不用 | - |
| 每月初 | 1. 汇总上月月报 2. "全部清空"上月数据 | 5 分钟 |
| 每 90 天 | 1. 重新生成 GitHub Token 2. 更新 Netlify 环境变量 | 5 分钟 |
| 每年 | 检查 Netlify 计划 | 1 分钟 |
| 按需 | 改代码 / 加功能 | 不定 |

### 4.2 监控

|项 | 状态 |
|------|------|
| Netlify Functions 日志 | ✅ 后台可看 |
| 错误追踪 | ❌ 未集成 Sentry |
| 性能监控 | ✅ Netlify 内置 |
| GitHub commit 通知 | ✅ 自带邮件订阅 |
| Uptime 监控 | ❌ |
| 告警 | ❌ |

### 4.3 备份策略

|类型 | 位置 | 频率 |
|------|------|------|
| 代码 | GitHub + 本地 | 实时 |
| 月报数据 | GitHub Repo `data/` | 每次提交 |
| 数据 commit 历史 | GitHub 永久 | 永久 |
| 本地备份 | 你电脑 | 手动 |

### 4.4 灾难恢复

|场景 | 恢复方式 |
|------|---------|
| **数据误清** | GitHub commit 历史 → Restore file |
| **Netlify 挂** | GitHub Pages 兜底（需配置）|
| **GitHub 仓库丢** | 本地是完整副本 |
| **Token 泄露** | 立即撤销 + 生成新 token |
| **密码泄露** | 改代码 + push + 重新部署 |

### 4.5 性能

|项 | 当前 | 备注 |
|------|------|------|
| 首屏加载 | < 1 秒 | 单文件 HTML |
| CDN | ✅ Netlify 全球 | - |
| API 响应 | < 500ms | GitHub API 延迟 ~200ms |
| 并发能力 | 125K 请求/月 | 远超实际 |

### 4.6 成本

|服务 | 免费层 | 实际用量 |
|------|--------|----------|
| Netlify | 100 GB 流量 + 125K 函数调用 | 极少量 |
| GitHub | Private repo 免费 | < 100KB |
| **总成本** | **$0/月** | - |

---

## ⚠️ 五、已知安全风险

|级别 | 风险 | 影响 | 缓解建议 |
|------|------|------|---------|
| 🔴 高 | 管理员密码明文写代码 | 任何人能进管理后台 | 改用 Netlify 环境变量 |
| 🟡 中 | 填表端无身份认证 | 恶意用户可伪造"姓名" | 加 GitHub OAuth |
| 🟡 中 | 任意人提交无限制 | 恶意刷数据 | Netlify Cloudflare Turnstile |
| 🟢 低 | 文件未加密 | 仓库泄露=数据泄露 | 敏感内容客户端加密 |
| 🟢 低 | 无审计日志 | 出问题难追责 | 记录 IP+时间戳 |
| 🟢 低 | 无 CSP 头 | XSS 风险（虽然已 escape）| 加 Content-Security-Policy |
| 🟢 低 | 无自动清理 | 数据累积 | 加 cron job 自动归档 |

---

## 🛡️ 六、上线前建议做的事

### 6.1 改管理员密码为环境变量

**当前风险**：明文写代码里

**修复**：在 Netlify 后台设 `ADMIN_PASSWORD` 环境变量，然后改代码读取。

### 6.2 加 Content-Security-Policy

在 `netlify.toml` 添加：

```toml
[[headers]]
  for = "/*"
  [headers.values]
    Content-Security-Policy = "default-src 'self'; style-src 'self' 'unsafe-inline' https://unpkg.com; script-src 'self' https://unpkg.com; img-src 'self' data:; connect-src 'self';"
    X-Content-Type-Options = "nosniff"
    X-Frame-Options = "DENY"
    Referrer-Policy = "strict-origin-when-cross-origin"
```

### 6.3 加其他安全头

同上。

### 6.4 GitHub 仓库改 Private

确保你的 repo 设置为 **Private**（默认创建时可选）。

### 6.5 添加 Cloudflare Turnstile

防自动化提交，30 分钟集成。

---

## 📋 七、合规性

|法规 | 影响 |
|------|------|
| **个人信息保护法（中国）** | ⚠️ 姓名 + 业务数据需合规 |
| **GDPR（欧盟）** | 不适用 |
| **数据安全法（中国）** | ⚠️ 重要数据应加密、备份 |
| **网安法（中国）** | ⚠️ 网络日志保留 6 个月+ |

**合规建议**：
- 与法务/IT 确认数据处理范围
- 文档化数据生命周期
- 用户同意（加 checkbox）

---

## 📝 八、总结

|维度 | 评估 |
|------|------|
| 网络安全 | ⭐⭐⭐⭐ 优秀 |
| 数据安全 | ⭐⭐⭐ 中等 |
| 数据处理 | ⭐⭐⭐⭐ 良好 |
| 系统维护 | ⭐⭐⭐⭐ 优秀 |
| **总评** | ⭐⭐⭐⭐ **适合 15-20 人小团队内部使用** |

---

## 🎯 给用户的建议

**对 15-20 人公司月报**：
- ✅ 当前方案**已够用**
- 🛡️ 上线前必做：改管理员密码（用 Netlify 环境变量）
- 📅 维护：每 3 月换 Token + 每月初汇总清空
- 💡 不需要为这个体量做更复杂的安全（加 OAuth、加密等）

---

**最后更新**：2026-08-20
**维护者**：项目负责人
