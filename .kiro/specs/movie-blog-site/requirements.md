# 需求文档

## 简介

本项目是一个个人电影博客网站，部署在 Cloudflare Pages 免费套餐上，通过 GitHub 进行版本管理和持续部署。网站使用 **Hugo**（Go 二进制，Windows 直接运行）构建静态页面，集成 Decap CMS 提供可视化后台管理界面，通过 **Cloudflare Access** 保护后台登录，使用 **Pagefind 或 Lunr.js** 实现静态前端搜索，并集成 **Giscus**（基于 GitHub Discussions）提供评论功能。

## 词汇表

- **Site**：整个电影博客网站
- **Hugo**：基于 Go 的静态站点生成器，以单一二进制文件分发，在 Windows 上无需额外运行时即可直接执行
- **SSG**（Static Site Generator）：静态站点生成器，本项目特指 Hugo
- **CMS**（Content Management System）：内容管理系统，本项目指 Decap CMS 后台界面
- **Post**：博客文章，包括影评、电影推荐、观影笔记等
- **Admin**：网站管理员，即网站所有者本人
- **Visitor**：访问网站的普通读者
- **Cloudflare_Pages**：Cloudflare 提供的静态网站托管服务
- **Cloudflare_Access**：Cloudflare Zero Trust 提供的身份验证与访问控制服务，用于保护 CMS 后台路径
- **GitHub_Repo**：存储网站源码和内容的 GitHub 仓库
- **Decap_CMS**：开源的 Git-based CMS，提供可视化内容编辑界面
- **Pagefind**：基于 WebAssembly 的静态全文搜索库，在构建时生成搜索索引，无需后端服务
- **Lunr.js**：纯前端 JavaScript 搜索库，在客户端构建和查询搜索索引，无需后端服务
- **Search_Engine**：本项目的站内搜索实现，采用 Pagefind 或 Lunr.js 之一
- **Giscus**：基于 GitHub Discussions 的评论系统，以 Web Component 形式嵌入页面，免费且无需独立服务器

---

## 需求

### 需求 1：网站部署与托管

**用户故事：** 作为 Admin，我希望网站部署在 Cloudflare Pages 上，以便利用免费套餐实现全球 CDN 加速访问。

#### 验收标准

1. THE Site SHALL 通过 Cloudflare Pages 进行托管和分发
2. WHEN Admin 向 GitHub_Repo 的主分支推送代码时，THE Cloudflare_Pages SHALL 自动触发构建并部署最新版本
3. THE Site SHALL 在 Cloudflare 免费套餐限制内运行（每月 500 次构建、100GB 流量）
4. IF 构建失败，THEN THE Cloudflare_Pages SHALL 保留上一次成功部署的版本继续提供服务

---

### 需求 2：静态站点生成（Hugo）

**用户故事：** 作为 Admin，我希望使用 Hugo 构建网站，以便在 Windows 本地环境中无需安装额外运行时即可直接运行。

#### 验收标准

1. THE Hugo SHALL 将 Markdown 格式的内容文件编译为静态 HTML 页面
2. THE Hugo SHALL 支持自定义主题，以呈现电影博客风格的视觉设计
3. WHEN Admin 在本地运行 `hugo server` 命令时，THE Hugo SHALL 启动本地开发服务器供预览
4. THE Hugo SHALL 支持文章分类（Taxonomy）和标签（Tag）功能，用于对 Post 进行分类管理
5. THE Hugo SHALL 生成 RSS Feed，供 Visitor 订阅更新
6. THE Hugo SHALL 以单一 `.exe` 二进制文件形式在 Windows 上运行，无需 Node.js 或其他运行时依赖

---

### 需求 3：内容管理后台（Decap CMS + Cloudflare Access）

**用户故事：** 作为 Admin，我希望通过可视化后台界面管理内容，并通过 Cloudflare Access 保护登录，以便安全地发布文章而无需手动编辑 Markdown 文件。

#### 验收标准

1. THE CMS SHALL 提供基于 Web 的可视化编辑界面，可通过 `/admin` 路径访问
2. THE CMS SHALL 支持富文本编辑器，允许 Admin 编写和格式化文章内容
3. THE CMS SHALL 支持上传图片并将图片存储至 GitHub_Repo 的指定目录
4. WHEN Admin 在 CMS 中保存并发布文章时，THE CMS SHALL 将内容提交至 GitHub_Repo 并触发自动部署
5. THE Cloudflare_Access SHALL 保护 `/admin` 路径，确保只有经过身份验证的 Admin 可访问后台界面
6. WHEN 未经授权的请求访问 `/admin` 路径时，THE Cloudflare_Access SHALL 拦截请求并要求身份验证
7. IF Admin 保存草稿而非发布，THEN THE CMS SHALL 将文章以草稿状态存储，不触发公开部署

---

### 需求 4：文章内容功能

**用户故事：** 作为 Admin，我希望能够发布包含文字和图片的电影相关文章，以便向读者分享影评和推荐。

#### 验收标准

1. THE Post SHALL 包含标题、发布日期、封面图片、正文内容、分类和标签字段
2. THE CMS SHALL 支持为每篇 Post 设置电影相关元数据，包括电影名称、导演、上映年份和评分
3. WHEN Admin 发布 Post 时，THE Site SHALL 在首页展示最新文章列表
4. THE Site SHALL 支持按分类和标签筛选 Post
5. THE Site SHALL 为每篇 Post 生成独立的永久链接（Permalink）

---

### 需求 5：读者访问体验

**用户故事：** 作为 Visitor，我希望能够流畅浏览电影博客内容，以便发现感兴趣的影评和推荐。

#### 验收标准

1. THE Site SHALL 在移动端和桌面端均提供响应式布局
2. THE Site SHALL 在首页展示文章摘要列表，每篇文章显示封面图、标题、发布日期和摘要
3. WHEN Visitor 访问不存在的页面时，THE Site SHALL 展示自定义 404 页面
4. THE Site SHALL 页面首次加载时间在正常网络条件下不超过 3 秒

---

### 需求 6：站内搜索（Pagefind 或 Lunr.js）

**用户故事：** 作为 Visitor，我希望能够通过关键词搜索文章，以便快速找到感兴趣的影评内容。

#### 验收标准

1. THE Search_Engine SHALL 在构建阶段生成静态搜索索引，无需后端服务或外部 API
2. WHEN Visitor 在搜索框输入关键词时，THE Search_Engine SHALL 在客户端返回匹配的 Post 列表
3. THE Search_Engine SHALL 对 Post 的标题、正文和标签内容建立索引
4. WHEN 搜索结果为空时，THE Search_Engine SHALL 向 Visitor 展示无结果提示信息
5. THE Search_Engine SHALL 与 Hugo 构建流程集成，每次构建后自动更新搜索索引

---

### 需求 7：评论功能（Giscus）

**用户故事：** 作为 Visitor，我希望能够在文章下方发表评论，以便与 Admin 和其他读者互动交流。

#### 验收标准

1. THE Giscus SHALL 以 Web Component 形式嵌入每篇 Post 页面底部
2. WHEN Visitor 提交评论时，THE Giscus SHALL 将评论存储为对应 GitHub Discussion 的回复
3. THE Giscus SHALL 要求 Visitor 通过 GitHub 账号授权后方可发表评论
4. THE Site SHALL 在不加载 Giscus 脚本的情况下正常渲染页面内容，确保评论组件加载失败不影响主体内容展示
5. WHERE Admin 需要管理评论时，THE Giscus SHALL 支持通过 GitHub Discussions 界面进行审核和删除操作

---

### 需求 8：本地开发环境（Windows）

**用户故事：** 作为 Admin，我希望能够在 Windows 本地环境中进行开发和预览，以便在发布前验证内容和样式。

#### 验收标准

1. THE Hugo SHALL 以单一二进制文件形式在 Windows 上安装，无需 Node.js 或其他运行时
2. THE Site SHALL 提供配置文件（如 `hugo.toml`），定义本地开发、构建和预览所需参数
3. WHEN Admin 在本地执行 `hugo build` 命令时，THE Hugo SHALL 在 60 秒内完成构建并输出静态文件
4. THE Site SHALL 提供 README 文档，说明 Windows 本地环境搭建步骤和常用命令
