# CC Switch Web

从零重建的轻量网页版 `cc-switch`。当前版本已经补上了生产部署必需的后端能力，只保留 3 个 agent 的核心能力：

- `Claude Code`
- `Codex`
- `Gemini`

当前实现能力：

- 登录页密码校验
- 读取并兼容 `~/.cc-switch/config.json`
- 兼容 `~/.cc-switch/settings.json` 中的 `claudeConfigDir` / `codexConfigDir` / `geminiConfigDir` 覆盖目录
- 读取并导入 live 配置作为默认 provider
- 读取并导入 live 提示词作为默认 prompt
- 新建 / 编辑 / 删除 provider
- 新建 / 编辑 / 删除 prompt
- 在同一 agent 下切换 provider
- 在同一 agent 下切换 prompt
- 切换时同步写入对应 live 配置文件
- 切换时同步写入对应 live prompt 文件
- live 配置切换前自动备份到 `~/.cc-switch/backups/live`
- prompt 切换前会先回填当前 live Markdown，再写入下一个 prompt
- live 写入失败自动回滚
- 登录限流、审计日志、安全响应头、Origin 校验

## 设计目标

- 不复用旧 `cc-switch-web` 的重型页面逻辑
- 页面切换与 provider 切换尽量本地即时反馈
- 后端只做必要的文件读写，不做额外轮询和健康检查

## 配置兼容

本项目直接读写这些路径：

- `~/.cc-switch/config.json`
- `~/.claude/settings.json`
- `~/.claude/CLAUDE.md`
- `~/.codex/auth.json`
- `~/.codex/config.toml`
- `~/.codex/AGENTS.md`
- `~/.gemini/.env`
- `~/.gemini/settings.json`
- `~/.gemini/GEMINI.md`

## 开发

```bash
pnpm install
pnpm dev
```

默认：

- 前端: `http://127.0.0.1:5173`
- 后端: `http://127.0.0.1:3001`
- 管理员密码: 通过 `ADMIN_PASSWORD` 环境变量设置

可通过环境变量覆盖：

```bash
ADMIN_PASSWORD=your-password PORT=3001 HOST=0.0.0.0 pnpm dev:server
```

## 构建

```bash
pnpm build
pnpm start
```

## 生产部署

1. 复制环境变量模板并修改密码/密钥

```bash
cp .env.example .env
```

2. 构建

```bash
pnpm install
pnpm build
```

3. 安装 `systemd` 服务

```bash
cp deploy/web-cc-switch.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now web-cc-switch
```

4. 配置 Nginx

```bash
cp deploy/nginx.conf /etc/nginx/sites-available/web-cc-switch.conf
ln -s /etc/nginx/sites-available/web-cc-switch.conf /etc/nginx/sites-enabled/web-cc-switch.conf
nginx -t && systemctl reload nginx
```

## 运维文件

- 环境变量示例: [`.env.example`](/root/web-cc-switch/.env.example)
- `systemd` 模板: [`deploy/web-cc-switch.service`](/root/web-cc-switch/deploy/web-cc-switch.service)
- `nginx` 模板: [`deploy/nginx.conf`](/root/web-cc-switch/deploy/nginx.conf)

## 审计与备份

- 审计日志: `~/.cc-switch/audit.log`
- live 备份: `~/.cc-switch/backups/live`
