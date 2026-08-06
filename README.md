# 部门资料收集（Demo 版）

一个**单文件 HTML** 的部门资料收集 + 汇总看板。
- 填表人在浏览器里提交所属部门的资料（Word/PDF 等附件 + 联系人信息）
- 汇总页（`?admin=xxx`）通过密码查看全员进度、按行查看详情、预览 / 下载附件、删除单条记录

> 风格完全照搬需求图：白底 + 蓝色主题 + 卡片式 + 图标化（Lucide）。

## URL 参数

| 参数 | 作用 |
|------|------|
| `?admin=admin123` | 进入管理员汇总视图 |
| `?reset=1` | 清空 localStorage + IndexedDB（开发调试用，生产可保留无副作用） |
| `?testseed=1` | 注入一条带 Blob 的测试 PDF 记录（开发调试用） |

---

## 快速开始

### 1. 直接打开

```
双击 index.html
```

或拖到任何现代浏览器中（Chrome / Edge / Firefox / Safari 均可）。

### 2. 填表页

打开后即可看到 3 条示例数据（财务部 / 人力资源部 / 市场部），下方表单可直接填报。

- **部门名称**：下拉选已有部门，或输入新部门回车确认
- **填报人 / 电话 / 附件 / 说明**：常规输入，附件支持点击或拖拽上传

### 3. 管理员汇总页

在浏览器地址栏把当前 URL 末尾追加 `?admin=xxx`（例如 `file:///.../index.html?admin=admin123`），回车后弹出密码框：

- 默认密码：`admin123`
- 解锁后看到「汇总看板」+「提交明细」表格
- 支持导出 JSON / CSV，清空数据（仅清浏览器本地）

> 修改密码：打开 `index.html`，搜索 `ADMIN_PASSWORD: 'admin123'`，改为你自己的值。

---

## 项目结构

```
dept-collector/
├── index.html       # 全部代码（HTML + CSS + JS，0 依赖）
└── README.md        # 本文件
```

- 无构建步骤、无 node_modules
- 唯一外部依赖：**Lucide 图标库**（CDN，按需加载）
- 数据存储：**localStorage**（Demo 模式）

---

## Demo 模式 vs 真实部署

| 项 | Demo（当前） | 真实（待对接） |
|----|-------------|----------------|
| 数据存储 | localStorage（仅本浏览器） | 腾讯文档智能表 |
| 多人汇总 | 仅本浏览器可见 | 全员可见，实时同步 |
| 附件上传 | 转 base64 存 localStorage（>5MB 会爆） | 上传到腾讯文档对象存储后塞附件字段 |
| CORS | 不涉及 | 必须经后端中转 |

切换方式：把 `index.html` 中 `CONFIG.MODE` 从 `'demo'` 改成 `'remote'`，
然后在下文 **「对接腾讯文档智能表」** 章节配置凭证。

---

## 对接腾讯文档智能表（开发路线）

> ⚠️ 腾讯文档 API **禁止浏览器直连**（无 CORS 头），必须经后端中转。下面给出对接清单与最小后端示例。

### 步骤 1 — 申请凭证

1. 进入 https://docs.qq.com/open 注册开发者
2. 创建企业/个人应用，得到 `APP_ID` 和 `APP_SECRET`
3. 创建一个"智能表"，获得 `SHEET_ID`
4. 表的字段建议：

| 字段名 | 类型 |
|--------|------|
| 部门 | 单行文本 |
| 填报人 | 单行文本 |
| 联系电话 | 单行文本 |
| 附件 | 附件 |
| 说明 | 多行文本 |
| 提交时间 | 日期 |

### 步骤 2 — 填入 index.html

```js
const CONFIG = {
  MODE: 'remote',
  ADMIN_PASSWORD: '你的强密码',
  REMOTE: {
    APP_ID: 'xxx',
    APP_SECRET: 'xxx',
    SHEET_ID: 'xxx',
    API_BASE: 'https://your-backend.example.com/api/td'  // 你的中转
  }
};
```

### 步骤 3 — 中转后端示例（Node.js + Express）

```js
// server.js —— 启动: node server.js
const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json({ limit: '20mb' }));

const TD_HOST = 'https://docs.qq.com/openapi';
let cachedToken = null;
let tokenExpiresAt = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiresAt - 60000) return cachedToken;
  const { data } = await axios.post(`${TD_HOST}/oauth/token`, {
    app_id: process.env.APP_ID,
    app_secret: process.env.APP_SECRET,
    grant_type: 'client_credentials'
  });
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + data.expires_in * 1000;
  return cachedToken;
}

// 通用代理
app.all('/api/td/*', async (req, res) => {
  try {
    const token = await getAccessToken();
    const { method, path, body, query } = {
      method: req.method,
      path: req.params[0],
      body: req.body,
      query: req.query
    };
    const { data } = await axios({
      method,
      url: `${TD_HOST}/${path}`,
      params: query,
      data: body,
      headers: { Authorization: `Bearer ${token}` }
    });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(3000, () => console.log('中转服务已启动 :3000'));
```

### 步骤 4 — 在 `Store.remote` 中实现 CRUD

参考腾讯文档智能表 API，把下面的 TODO 填上：

```js
async listSubmissions() {
  const r = await fetch(`${CONFIG.REMOTE.API_BASE}/sheets/${CONFIG.REMOTE.SHEET_ID}/records`);
  const { data } = await r.json();
  return data.items.map(toLocalModel);
},
async addSubmission(item) {
  // 1. 如果有附件，先 POST /v1/files/upload 拿到 file_token
  // 2. 再 POST /sheets/{id}/records，附件字段传 file_token
}
```

完整字段说明参考 https://docs.qq.com/open/smart-table/api 。

---

## 二次开发提示

- **修改主题色**：搜 `#2563eb`，改成你的品牌色即可
- **增加字段**：在 `<form>` 添加 `.form-group`，在 `App.onSubmit` 中提取，最后在表格 `<thead>` 加列
- **附件转 base64**：当前实现仅适合 Demo；真实环境务必走对象存储直传，避免挤爆 localStorage
- **打印**：浏览器 `Ctrl+P`，页面已使用 `@media print` 友好布局

---

## 已知限制

- Demo 模式 localStorage 上限约 5MB，附件会撑爆，**仅适合演示**
- 真实部署请走中转后端 + 腾讯文档对象存储
- 浏览器直连腾讯文档 API 100% 被 CORS 拦截，不要尝试

---

## License

私有项目，仅供内部使用。
