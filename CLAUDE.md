# Claude Code 任务指引：构建无状态化的 TG-Repeat-Bot SaaS 面板

你好，Claude Code。当前任务是**在 `app/saas` 目录内从零构建一个面向最终用户的 Web SaaS 平台**。该平台将提供图形化界面去调度和管理底层的 Telegram 通信逻辑。

## 🎯 核心架构指令
**绝对铁律：应用必须是完全无状态 (Stateless) 的设计！** 适应如 Railway 等容器化云端部署。
- **不可使用**: 本地 SQLite 文件、本地 `.session` 实体文件保存状态，禁止把用户图片/视频下载到本地硬盘过夜。
- **强制使用**:
  - **框架**: Next.js (App Router) + Tailwind CSS + shadcn/ui。
  - **数据库**: PostgreSQL (推荐 Prisma/Drizzle ORM)，用户状态与极长 `StringSession` 等关键凭证加密后直接落库入表。
  - **媒体存储**: S3 兼容对象存储 (AWS S3, Cloudflare R2等)，所有 scraped media 的 Buffer 必须流式 (Stream) 转存到 S3 中，表内只记录 URL。
  - **异步中心**: 因为 TG API (尤其是 `/message-scrape` 与 `/auto-chat`) 极度耗时，**所有可能导致 HTTP 阻塞超过 10 秒的操作，必须通过 Redis + BullMQ 丢入后台 Worker 进行异步调度**。

---

## 🚀 开发执行阶段 (渐进式)

### 阶段 1：全栈基建初始化与 DB 模型设计
- 初始化 Next.js 应用。配置 Tailwind 与常用的 shadcn/ui 组件。
- 连接 PostgreSQL，设计基础数据库 Schema：包含 User 表（邮箱认证关联 Auth.js/NextAuth）与 Session 表（从属关联该用户，保存被加密的 StringSession 及元数据）。

### 阶段 2：鉴权体系与唯一超级管理员
- 实现基于邮箱的登录注册，给新用户发放“3小时临时配额”。
- 设计防刷机制 (Middleware)，若过期则拦截服务。
- 硬编码或实现唯一超级管理员入口 (`fchow@gmail.com`) 的全站注册清单、Session 视图及延期授权操作按钮。

### 阶段 3：会话池托管界面 (`/dashboard/sessions`)
- 提供前端界面让用户交互式生成 Session (绑定手机号 -> 验证码 WS/长轮询交互 -> 落库 StringSession)。
- 列表页展示已有存活池，支持一键清空死号，一键导入/导出下载 StringSession 字符本。

### 阶段 4：机器人任务总控面板与改名换姓 (`/dashboard/tasks`)
- 为上层提供的逻辑包装漂亮的 Web 操作接口。
- **改名器面板**：一键触发挥发任务，随机从图库抽头像，更新指定 Session 的资料，躲避风控查询。
- **抓取器面板**：提交目标 Link 与抓取条数 -> 压入 BullMQ -> 后台过滤无效消息并抽取图文流式直传 S3 -> 前端查库看清单。
- **策略群发面板**：组合配置打招呼、间隔 Jitter (2~5秒变量)，指定发贴或回复某 Topic ID -> 压入无限循环挂机 Worker -> WebSockets 查看即时发送对账单或点击“紧急熔断”停止调度指令。

---

## 🌟 高阶 Agent 工作流准则 (Advanced Agentic Best Practices)

> 💡 这些是 Anthropic 官方推荐的顶级实践，能让 Claude 从“代码生成器”进化为“自主智能体”。

### 1. Plan Node Default (默认规划模式)
- 对于任何非轻量级任务（超过 3 步或涉及架构层），立刻进入**Plan 模式** (在 `tasks` 目录下维护计划文档)。
- 一旦事情走向不对劲，立刻**停下并重新规划**，不要无脑死磕。

### 2. Subagent Strategy (子代理策略)
- 毫不吝啬地使用 `/plan`, `/tdd` 或者开启新窗口丢给后方做探路考察，保持主窗口的 Context (记忆) 绝对干净。
- 遇到硬核难题（比如 BullMQ 重构死锁），用大算力模型或单独开启专属 Debug Session 解决。

### 3. Self-Improvement Loop (自我迭代闭环)
- **每次被用户纠正错误后，必须把教训写进 `tasks/lessons.md`。**
- 每次启动新会话时，一定要先去复习一下 `lessons.md` 里的血泪史。

### 4. Verification Before Done (无验证，不竣工)
- 没有跑过测试并证明它真的 working 之前，绝对不准标记任务完成！拿 `curl` 或浏览器截图截 Log 证明你的清白！

### 5. Task & Scope Management (任务与节奏管理)
- **Tracking**: 先在 `tasks/todo.md` 写好带 checkbox 的待办。做完一个打个 `[x]`。
- **Elegance Demand**: 永远选择最简单干脆的架构。若发现需要 Hack，重构该死的结构本身！拒绝打补丁膏药式的“烂代码”。

