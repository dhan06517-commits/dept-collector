# 月度工作汇报系统

> 公司内部月报收集与跨部门汇总工具

## 简介

每个月群里相关人员（15-20 人）点链接填自己的月报，管理员进汇总页查看所有部门的填报情况。

- **填表端**：白底 + 蓝主题，单文件 HTML，无需登录
- **管理端**：URL 参数 + 客户端 PIN（哈希比对），无服务端鉴权
- **存储**：GitHub Repo JSON 文件，每次写入即一个 commit（天然备份）

## 快速访问

| 角色 | 入口 |
|------|------|
| 填表人 | https://dept-collector.vercel.app/ |
| 管理员 | https://dept-collector.vercel.app/?admin=admin123 |

## 详细文档

完整文档见 **[PROJECT.md](./PROJECT.md)**，包含：

- 技术架构图
- API 端点说明
- 部署流程
- 管理员 PIN 生成方法
- 安全现状
- 已知限制与改进方向

## 项目结构

```
dept-collector/
├── index.html        # 前端单文件（含全部 CSS + JS）
├── api/              # Vercel Functions
├── data/             # 运行时数据
├── vercel.json       # 全局响应头 + CORS
├── PROJECT.md        # 详细文档
└── README.md         # 本文件（入口）
```

## 技术栈

- **前端**：单文件 HTML + 原生 JS + Lucide 图标
- **后端**：Vercel Serverless Functions (Node 18+, ESM)
- **存储**：GitHub Contents API（通过 `GITHUB_TOKEN` 环境变量）

## 本地开发

```bash
# 1. 启动本地服务器
python -m http.server 8765

# 2. 访问
open http://localhost:8765

# 3. F12 Console 解锁粘贴：输入 allow pasting 后回车
#    （生产环境部署需要 GITHUB_TOKEN + Vercel 环境变量）
```

## 部署

参见 [PROJECT.md §七、部署](./PROJECT.md)。

简要流程：

1. Push 代码到 GitHub（已配置 origin）
2. Vercel Dashboard → Import Project → 选此 Repo
3. 设置环境变量：`GITHUB_TOKEN`（必填，PAT with Contents: Read and write）
4. 自动部署

## License

内部使用。