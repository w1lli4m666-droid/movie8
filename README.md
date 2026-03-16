# 电影博客

基于 Hugo 构建的个人电影博客，托管于 Cloudflare Pages，集成 Decap CMS、Pagefind 搜索和 Giscus 评论。

## 技术栈

- **Hugo** — 静态站点生成器（单一 .exe，无需额外运行时）
- **Cloudflare Pages** — 托管与 CI/CD
- **Decap CMS** — 可视化内容管理后台
- **Cloudflare Access** — 保护 `/admin` 路径
- **Pagefind** — 构建时生成静态搜索索引
- **Giscus** — 基于 GitHub Discussions 的评论系统

---

## Windows 本地环境搭建

### 1. 安装 Hugo

1. 前往 [Hugo Releases](https://github.com/gohugoio/hugo/releases) 下载最新版 `hugo_extended_x.x.x_windows-amd64.zip`
2. 解压后将 `hugo.exe` 放到任意目录，例如 `C:\hugo\`
3. 将该目录添加到系统环境变量 `PATH`：
   - 右键「此电脑」→「属性」→「高级系统设置」→「环境变量」
   - 在「系统变量」中找到 `Path`，点击「编辑」，新增 `C:\hugo\`
4. 打开新的命令提示符，验证安装：
   ```
   hugo version
   ```

### 2. 安装 Node.js（用于 Pagefind CLI）

1. 前往 [Node.js 官网](https://nodejs.org/) 下载 LTS 版本（18.x 或更高）
2. 运行安装程序，按默认选项完成安装
3. 验证安装：
   ```
   node --version
   npm --version
   ```

### 3. 克隆仓库

```bash
git clone https://github.com/<username>/<repo>.git
cd <repo>
```

---

## 常用命令

### 本地开发预览

```bash
hugo server
```

启动本地开发服务器，默认访问地址：http://localhost:1313

热重载已启用，修改文件后浏览器自动刷新。

### 包含草稿的预览

```bash
hugo server -D
```

### 本地构建

```bash
hugo --minify
```

构建输出到 `public/` 目录。

### 完整构建（含搜索索引）

```bash
hugo --minify && npx pagefind --site public
```

构建 Hugo 站点并生成 Pagefind 搜索索引，输出到 `public/pagefind/`。

### 新建文章

```bash
hugo new posts/my-movie-review.md
```

---

## 项目结构

```
.
├── hugo.toml              # Hugo 主配置文件
├── content/
│   └── posts/             # 文章 Markdown 文件
├── layouts/
│   ├── _default/          # 默认模板（baseof、single、list）
│   ├── index.html         # 首页模板
│   └── 404.html           # 404 页面
├── static/
│   └── admin/             # Decap CMS 入口（index.html + config.yml）
├── assets/
│   ├── css/               # 样式文件
│   └── js/                # 脚本文件
└── public/                # 构建输出目录（已 gitignore）
```

---

## Cloudflare Pages 部署配置

在 Cloudflare Pages 控制台配置以下构建参数：

| 配置项 | 值 |
|--------|-----|
| 构建命令 | `hugo --minify && npx pagefind --site public` |
| 输出目录 | `public` |
| 环境变量 `HUGO_VERSION` | `0.128.0`（或更新版本） |
| 环境变量 `NODE_VERSION` | `18` |

---

## Giscus 评论配置

1. 确保 GitHub 仓库已启用 Discussions 功能
2. 前往 [giscus.app](https://giscus.app/zh-CN) 生成配置参数
3. 将生成的参数填入 `hugo.toml` 的 `[params]` 部分：
   ```toml
   giscus_repo = "<username>/<repo>"
   giscus_repo_id = "<repo-id>"
   giscus_category = "Announcements"
   giscus_category_id = "<category-id>"
   ```

---

## Decap CMS 配置

编辑 `static/admin/config.yml`，将 `repo` 字段替换为实际的 GitHub 仓库路径：

```yaml
backend:
  name: github
  repo: <username>/<repo-name>
  branch: main
```

Cloudflare Access 保护配置请参考 [Cloudflare Zero Trust 文档](https://developers.cloudflare.com/cloudflare-one/)。
