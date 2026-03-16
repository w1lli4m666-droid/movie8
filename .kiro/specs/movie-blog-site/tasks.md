# 实施计划：电影博客网站

## 概述

基于 Hugo 静态站点生成器，集成 Decap CMS、Cloudflare Access、Pagefind 搜索和 Giscus 评论，逐步构建并验证各功能模块。测试策略以 Go 构建产物验证为主，属性测试使用 `gopter` 库。

## 任务

- [x] 1. 初始化 Hugo 项目结构与基础配置
  - 创建 Hugo 项目目录结构（`content/posts/`、`layouts/`、`static/admin/`、`assets/`）
  - 编写 `hugo.toml`，配置 `baseURL`、`languageCode`、`title`、`[taxonomies]`、`[outputs]`
  - 配置 `.gitignore`，排除 `public/` 目录
  - 编写 `README.md`，包含 Windows 本地环境搭建步骤和常用命令
  - _需求：2.2, 8.1, 8.2, 8.4_

- [x] 2. 实现 Hugo 模板与主题样式
  - [x] 2.1 创建基础 HTML 模板
    - 编写 `layouts/_default/baseof.html`（基础骨架，含响应式 meta 标签）
    - 编写 `layouts/index.html`（首页，展示文章摘要列表：封面图、标题、日期、摘要）
    - 编写 `layouts/_default/single.html`（文章详情页，含电影元数据渲染区域）
    - 编写 `layouts/_default/list.html`（分类/标签聚合列表页）
    - 编写 `layouts/404.html`（自定义 404 页面）
    - _需求：2.2, 4.1, 4.2, 4.3, 5.1, 5.2, 5.3_
  - [x] 2.2 添加响应式 CSS 样式
    - 在 `assets/css/` 中编写基础响应式样式，确保移动端和桌面端布局正常
    - _需求：5.1_

- [x] 3. 配置 Decap CMS 后台
  - 创建 `static/admin/index.html`（Decap CMS 入口页面）
  - 创建 `static/admin/config.yml`，配置 GitHub 后端、媒体目录和文章集合字段（标题、日期、草稿、封面、摘要、分类、标签、电影名称、导演、上映年份、评分、正文）
  - _需求：3.1, 3.2, 3.3, 3.4, 4.1, 4.2_

- [x] 4. 集成 Pagefind 搜索
  - [x] 4.1 在文章模板中添加 Pagefind 索引标记
    - 在 `layouts/_default/single.html` 的文章区域添加 `data-pagefind-body` 和 `data-pagefind-meta` 属性
    - _需求：6.3_
  - [x] 4.2 创建搜索页面 partial 模板
    - 编写 `layouts/partials/search.html`，引入 `pagefind-ui.css`、`pagefind-ui.js` 并初始化 `PagefindUI`
    - 在 `baseof.html` 或首页模板中引入搜索 partial
    - _需求：6.1, 6.2, 6.4, 6.5_

- [x] 5. 集成 Giscus 评论
  - 编写 `layouts/partials/comments.html`，嵌入 Giscus `<script>` 标签，`data-repo` 等属性从 `hugo.toml` 的 `[params]` 读取
  - 在 `layouts/_default/single.html` 底部引入 comments partial
  - 在 `hugo.toml` 的 `[params]` 中添加 `giscus_repo`、`giscus_repo_id`、`giscus_category`、`giscus_category_id` 配置项
  - _需求：7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 6. 搭建 Go 测试框架
  - 在项目根目录创建 `tests/` 目录，初始化 Go module（`go mod init`）
  - 添加依赖：`gopter`（属性测试）、`golang.org/x/net/html`（HTML 解析）
  - 编写测试辅助函数：随机生成文章 Front Matter、执行 `hugo build`、读取构建产物
  - _需求：2.1, 2.3_

- [x] 7. 实现构建产物属性测试
  - [x] 7.1 实现属性 1：Markdown 到 HTML 的构建 Round-Trip
    - 随机生成非草稿文章，执行构建，验证 `public/` 中存在对应 HTML 且包含标题
    - **属性 1：Markdown 到 HTML 的构建 Round-Trip**
    - **验证需求：2.1**
  - [ ]* 7.2 实现属性 2：草稿文章不输出到构建结果
    - 随机生成 `draft: true` 文章，执行构建，验证 `public/` 中不存在对应 HTML
    - **属性 2：草稿文章不输出到构建结果**
    - **验证需求：3.7**
  - [ ]* 7.3 实现属性 3：文章字段完整渲染
    - 随机生成包含所有字段的文章，执行构建，验证生成 HTML 包含各字段内容
    - **属性 3：文章字段完整渲染**
    - **验证需求：4.1, 4.2**
  - [ ]* 7.4 实现属性 4：首页完整展示非草稿文章信息
    - 随机生成非草稿文章集合，执行构建，验证 `public/index.html` 包含每篇文章的标题、日期、摘要
    - **属性 4：首页完整展示非草稿文章信息**
    - **验证需求：4.3, 5.2**
  - [ ]* 7.5 实现属性 5：分类与标签聚合页面生成
    - 随机生成带分类/标签的文章，执行构建，验证 `public/categories/` 和 `public/tags/` 下存在对应聚合页面且包含文章链接
    - **属性 5：分类与标签聚合页面生成**
    - **验证需求：2.4, 4.4**
  - [ ]* 7.6 实现属性 6：文章永久链接唯一性
    - 随机生成多篇文章，执行构建，验证所有输出 HTML 路径互不相同
    - **属性 6：文章永久链接唯一性**
    - **验证需求：4.5**
  - [ ]* 7.7 实现属性 8：Giscus 嵌入每篇文章页面
    - 随机生成非草稿文章，执行构建，验证每篇文章 HTML 包含 Giscus `<script>` 标签且 `data-repo` 与配置一致
    - **属性 8：Giscus 嵌入每篇文章页面**
    - **验证需求：7.1**
  - [ ]* 7.8 实现属性 9：文章主体内容静态渲染
    - 随机生成文章，执行构建，验证文章 HTML 中标题和正文直接存在于源码中（不依赖 JS）
    - **属性 9：文章主体内容静态渲染**
    - **验证需求：7.4**

- [x] 8. 实现示例测试（E1-E6）
  - [x] 8.1 编写示例测试 E1-E6
    - E1：验证 `public/index.xml` 存在且包含有效 RSS 结构（需求：2.5）
    - E2：验证 `public/admin/index.html` 存在（需求：3.1）
    - E3：验证 `public/404.html` 存在（需求：5.3）
    - E4：验证 `public/pagefind/` 目录存在且包含索引文件（需求：6.1, 6.5）
    - E5：验证 `hugo.toml` 包含 `baseURL`、`title`、`[taxonomies]` 等必要字段（需求：8.2）
    - E6：验证 `README.md` 存在且包含本地环境搭建说明（需求：8.4）
    - _需求：2.5, 3.1, 5.3, 6.1, 6.5, 8.2, 8.4_
  - [ ]* 8.2 编写边界条件单元测试
    - 测试空标题、特殊字符标题、最大/最小评分值（0 和 10）的文章构建
    - 测试无效 Front Matter 格式时构建失败的行为
    - _需求：4.1, 4.2_

- [x] 9. 检查点 - 确保所有测试通过
  - 确保所有测试通过，如有问题请向用户反馈。

- [x] 10. 配置 Cloudflare Pages 构建脚本
  - 在项目根目录创建 `build.sh`（或在文档中说明），构建命令为 `hugo --minify && npx pagefind --site public`
  - 在 `hugo.toml` 中通过注释说明 Cloudflare Pages 控制台需配置的环境变量（`HUGO_VERSION`、Node.js 版本 `18`）
  - _需求：1.1, 1.2, 1.3, 1.4, 2.3_

- [x] 11. 集成收尾与组件串联
  - [x] 11.1 验证完整构建流程
    - 确认 `hugo --minify && npx pagefind --site public` 在本地可完整执行
    - 确认 `public/pagefind/` 索引文件由 Pagefind 正确生成
    - _需求：6.1, 6.5_
  - [ ]* 11.2 实现属性 7：搜索索引覆盖文章内容
    - 生成随机文章并完整构建（含 Pagefind 索引），使用文章标题关键词查询，验证结果包含该文章 URL
    - **属性 7：搜索索引覆盖文章内容**
    - **验证需求：6.2, 6.3**

- [x] 12. 最终检查点 - 确保所有测试通过
  - 确保所有测试通过，如有问题请向用户反馈。

## 备注

- 标有 `*` 的子任务为可选项，可在 MVP 阶段跳过以加快进度
- 每个任务均引用具体需求条款，确保可追溯性
- 属性测试每个最少运行 100 次迭代，注释中需引用属性编号
- Cloudflare Access 和 GitHub Discussions 的配置需在对应平台控制台手动完成，不在编码任务范围内
