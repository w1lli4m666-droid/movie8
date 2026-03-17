# 需求文档

## 简介

本项目是对现有电影博客网站视频播放功能的增强改进。当前网站使用 Hugo 构建，集成了 ArtPlayer 视频播放器，但在多集电视剧展示和视频源管理方面存在用户体验问题。本次增强将改进视频命名的灵活性、优化多集内容的展示方式，并提供更好的视频源选择体验。

## 词汇表

- **Video_Player_System**：整个视频播放功能系统，包括播放器界面、视频源管理和集数导航
- **ArtPlayer**：当前使用的 HTML5 视频播放器库
- **Video_Entry**：视频条目，可以是单部电影或电视剧的一季
- **Episode**：电视剧的单集
- **Video_Source**：视频播放源，包含名称和 URL
- **Alternative_Source**：备用视频源，当主源无法播放时的替代选项
- **Season**：电视剧的季，一季可包含多集
- **Video_Label**：视频条目的自定义显示名称，替代固定的"视频"标签
- **Episode_Card**：展示单集信息的小卡片界面元素
- **Source_Dropdown**：视频源选择下拉菜单
- **Cascade_Display**：当前的瀑布式展示方式，即多个播放器窗口垂直排列
- **Single_Player_Mode**：改进后的单播放器模式，只显示一个播放器窗口
- **CMS**：内容管理系统，指 Decap CMS 后台界面
- **Admin**：网站管理员，负责添加和管理视频内容
- **Visitor**：访问网站的普通用户

---

## 需求

### 需求 1：自定义视频标签名称

**用户故事：** 作为 Admin，我希望能够自定义视频条目的显示名称，以便为不同类型的内容（如电影、电视剧各季）提供更准确的标识。

#### 验收标准

1. THE CMS SHALL 允许 Admin 为每个 Video_Entry 设置自定义 Video_Label
2. WHEN Admin 创建新的 Video_Entry 时，THE CMS SHALL 提供 Video_Label 输入字段
3. THE CMS SHALL 将自定义 Video_Label 替代默认的"视频"文本显示在编辑界面中
4. WHERE Admin 未设置 Video_Label 时，THE CMS SHALL 使用默认标签"视频"
5. THE Video_Label SHALL 支持中文、英文和数字字符，长度限制为 1-20 个字符

### 需求 2：单播放器模式

**用户故事：** 作为 Visitor，我希望在浏览多集电视剧时只看到一个播放器窗口，以便获得更清洁的页面布局和更好的观看体验。

#### 验收标准

1. THE Video_Player_System SHALL 在文章页面只展示一个 ArtPlayer 播放器窗口
2. WHEN 文章包含多个 Episode 时，THE Video_Player_System SHALL 默认加载第一集内容
3. THE Video_Player_System SHALL 替代当前的 Cascade_Display 模式
4. THE Single_Player_Mode SHALL 保持与当前播放器相同的功能特性（全屏、画中画、播放速度控制等）
5. THE Video_Player_System SHALL 在播放器加载失败时显示友好的错误提示信息

### 需求 3：分层级集数导航

**用户故事：** 作为 Visitor，我希望通过分层级的小卡片选择要观看的集数，以便直观地浏览和切换不同季和集的内容。

#### 验收标准

1. THE Video_Player_System SHALL 在播放器下方展示 Episode_Card 导航区域
2. WHERE Video_Entry 包含多个 Season 时，THE Episode_Card SHALL 按季分组显示
3. WHEN Visitor 点击某个 Episode_Card 时，THE Video_Player_System SHALL 切换播放器内容到对应集数
4. THE Episode_Card SHALL 显示集数标识（如"第1集"、"第2集"）和集名称（如有）
5. THE Episode_Card SHALL 通过视觉样式区分当前播放集和其他集数
6. THE Episode_Card SHALL 在移动端和桌面端均提供响应式布局

### 需求 4：视频源下拉选择

**用户故事：** 作为 Visitor，我希望通过固定位置的下拉菜单选择不同的视频源，以便在主源无法播放时快速切换到备用源。

#### 验收标准

1. THE Video_Player_System SHALL 在播放器下方第一栏位置展示 Source_Dropdown
2. THE Source_Dropdown SHALL 列出当前集数的所有可用 Video_Source 和 Alternative_Source
3. WHEN Visitor 选择不同的视频源时，THE Video_Player_System SHALL 切换播放器到新的视频 URL
4. THE Source_Dropdown SHALL 显示每个视频源的名称（如"高清源"、"官方源"、"备用源1"）
5. THE Source_Dropdown SHALL 标记当前正在播放的视频源
6. WHERE 某集只有一个视频源时，THE Source_Dropdown SHALL 仍然显示但只包含该单一选项

### 需求 5：CMS 后台视频管理增强

**用户故事：** 作为 Admin，我希望在 CMS 后台能够灵活管理电视剧的季和集结构，以便高效地组织多季多集的内容。

#### 验收标准

1. THE CMS SHALL 支持为单个文章添加多个 Season
2. THE CMS SHALL 允许为每个 Season 设置季标识（如"第一季"、"Season 1"）
3. THE CMS SHALL 支持为每个 Episode 设置集数标识和可选的集名称
4. THE CMS SHALL 允许为每个 Episode 配置多个 Alternative_Source
5. THE CMS SHALL 提供拖拽排序功能，允许 Admin 调整 Season 和 Episode 的显示顺序
6. THE CMS SHALL 在保存时验证视频 URL 格式的有效性

### 需求 6：播放状态记忆

**用户故事：** 作为 Visitor，我希望系统能够记住我上次观看的集数和播放进度，以便下次访问时能够继续观看。

#### 验收标准

1. THE Video_Player_System SHALL 使用浏览器本地存储记录每篇文章的观看进度
2. WHEN Visitor 重新访问文章时，THE Video_Player_System SHALL 自动加载上次观看的集数
3. THE Video_Player_System SHALL 记录每集的播放时间进度
4. WHERE Visitor 已观看完某集时，THE Episode_Card SHALL 显示"已观看"标识
5. THE Video_Player_System SHALL 提供"重置观看记录"选项供 Visitor 清除进度

### 需求 7：响应式布局优化

**用户故事：** 作为 Visitor，我希望在不同设备上都能获得良好的视频浏览体验，以便在手机、平板和桌面设备上流畅使用。

#### 验收标准

1. THE Video_Player_System SHALL 在移动端（屏幕宽度 ≤ 768px）优化 Episode_Card 布局
2. THE Episode_Card SHALL 在移动端采用横向滚动方式展示，避免占用过多垂直空间
3. THE Source_Dropdown SHALL 在移动端保持易于点击的尺寸（最小 44px 高度）
4. THE Video_Player_System SHALL 保持播放器的 16:9 宽高比在所有设备上
5. WHERE 屏幕宽度小于播放器最小宽度时，THE Video_Player_System SHALL 自动调整播放器尺寸

### 需求 8：向后兼容性

**用户故事：** 作为 Admin，我希望新的视频播放功能能够兼容现有的文章内容，以便无需修改已发布的文章即可使用新功能。

#### 验收标准

1. THE Video_Player_System SHALL 支持现有的单视频 iframe 嵌入方式
2. WHERE 文章使用旧的视频格式时，THE Video_Player_System SHALL 自动适配为 Single_Player_Mode
3. THE Video_Player_System SHALL 支持现有的 videos 字段结构（movie 和 series 类型）
4. WHERE 文章同时包含新旧视频格式时，THE Video_Player_System SHALL 优先使用新格式
5. THE CMS SHALL 提供迁移工具，帮助 Admin 将现有文章转换为新的视频格式
