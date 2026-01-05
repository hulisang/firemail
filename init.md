# FlareMail 项目概述

## 项目定位

**FlareMail** 是一款基于 **Tauri v2** 构建的跨平台桌面邮件阅览工具，专注于 Outlook/Microsoft 邮箱的批量管理和阅读。核心理念是"极简主义"和"隐私至上"——所有数据本地存储，无后端服务依赖。

**当前版本**: 0.3.3

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19 + Vite 7 + Tailwind CSS v4 |
| 状态管理 | Zustand |
| 桌面框架 | Tauri v2 |
| 后端 | Rust 2021 Edition |
| 数据库 | SQLite (sqlx) |
| 邮件协议 | IMAP + Microsoft Graph API |

---

## 核心功能

### 1. 邮箱账号管理
- 批量导入（TXT 文件、拖拽、粘贴）
- 格式：`邮箱----密码----client_id----refresh_token`
- 分页展示、搜索、批量删除

### 2. 双协议邮件收取
- **IMAP**: OAuth2 XOAUTH2 认证连接 `outlook.office365.com:993`
- **Graph API**: Microsoft Graph API 获取邮件
- 智能协议选择 + 自动回退机制

### 3. 邮件阅读
- 收件箱 / 垃圾邮件文件夹
- 邮件详情弹窗 + 附件下载

### 4. 系统功能
- 深色/浅色主题切换
- 中英文多语言
- 代理支持（HTTP/SOCKS）
- GitHub Release 自动更新检查

---

## 项目架构

```
┌─────────────────────────────────────────┐
│           Frontend (React 19)           │
│   Dashboard / EmailManagement / MailList│
│              Zustand Store              │
└──────────────────┬──────────────────────┘
                   │ Tauri IPC
┌──────────────────┴──────────────────────┐
│            Backend (Rust)               │
│  commands.rs / email.rs / graph_api.rs  │
│         SQLite + Token Cache            │
└──────────────────┬──────────────────────┘
                   │
     ┌─────────────┼─────────────┐
     ▼             ▼             ▼
  Outlook      Microsoft     GitHub API
  IMAP         Graph API     (更新检查)
```

---

## 项目目录结构

```
E:\project\flaremail\
├── src/                          # 前端源码 (React)
│   ├── App.tsx                   # 应用入口
│   ├── main.tsx                  # React 挂载点
│   ├── index.css                 # 全局样式
│   ├── types.ts                  # TypeScript 类型定义
│   ├── components/               # UI 组件
│   │   ├── EmailManagement.tsx   # 邮箱管理主组件
│   │   ├── MailDetailModal.tsx   # 邮件详情弹窗
│   │   ├── MailList.tsx          # 邮件列表
│   │   ├── ImportEmailModal.tsx  # 导入邮箱弹窗
│   │   ├── About.tsx             # 关于页面
│   │   ├── theme-provider.tsx    # 主题提供者
│   │   └── mode-toggle.tsx       # 深色/浅色模式切换
│   ├── pages/
│   │   ├── Dashboard.tsx         # 仪表盘页面
│   │   ├── Login.tsx             # 登录页
│   │   └── Register.tsx          # 注册页
│   ├── store/
│   │   ├── app.ts                # 应用状态 (Zustand)
│   │   └── auth.ts               # 认证状态
│   ├── locales/
│   │   ├── zh.ts                 # 中文语言包
│   │   └── en.ts                 # 英文语言包
│   ├── utils/
│   │   └── updateChecker.ts      # 版本更新检查
│   └── lib/
│       └── utils.ts              # 工具函数
│
├── src-tauri/                    # 后端源码 (Rust)
│   ├── src/
│   │   ├── main.rs               # Rust 入口
│   │   ├── lib.rs                # Tauri 应用配置
│   │   ├── commands.rs           # Tauri 命令定义
│   │   ├── db.rs                 # 数据库初始化
│   │   ├── email.rs              # 邮件核心逻辑
│   │   ├── graph_api.rs          # Microsoft Graph API
│   │   ├── proxy.rs              # 代理配置
│   │   └── token_cache.rs        # Token 缓存
│   ├── migrations/
│   │   └── 20240101000000_init.sql  # 数据库初始化脚本
│   ├── Cargo.toml                # Rust 依赖配置
│   └── tauri.conf.json           # Tauri 配置
│
├── .github/workflows/            # GitHub Actions CI/CD
├── package.json                  # Node.js 依赖
├── vite.config.ts                # Vite 配置
└── README.md                     # 项目说明
```

---

## 数据库设计

使用 SQLite 本地数据库，包含 4 张表：

| 表名 | 用途 |
|------|------|
| `emails` | 邮箱账号信息 (OAuth2 凭证、代理配置、API 模式等) |
| `mail_records` | 邮件记录 (主题、发件人、内容、文件夹等) |
| `attachments` | 附件存储 (文件名、类型、二进制内容) |
| `system_config` | 系统配置键值对 |

---

## 后端 Tauri 命令 (IPC 接口)

| 命令 | 功能 |
|------|------|
| `add_email` | 添加单个邮箱账号 |
| `import_emails` | 批量导入邮箱 |
| `get_emails` | 获取邮箱列表 |
| `delete_email` | 删除邮箱 |
| `check_outlook_email` | 单邮箱收件 |
| `batch_check_outlook_emails` | 批量收件 |
| `get_mail_records` | 获取邮件记录 |
| `get_attachments` | 获取附件列表 |
| `get_attachment_content` | 获取附件内容 (Base64) |

---

## 关键特性总结

1. **隐私优先**: 所有数据本地 SQLite 存储，无后端服务
2. **双协议智能切换**: IMAP + Graph API 自动选择最优方案
3. **OAuth2 认证**: 使用 Microsoft OAuth2 refresh_token 机制
4. **Token 缓存**: 避免频繁刷新 Token，提升性能
5. **跨平台**: 基于 Tauri，支持 Windows/macOS/Linux
6. **现代 UI**: Tailwind CSS v4 + 磨砂玻璃效果 + 深色模式
7. **自动更新**: 集成 GitHub Release 检查机制
