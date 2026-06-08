# 类 AI Quests 产品需求与架构调研

调研日期：2026-05-31

## 1. 背景

本次讨论围绕 Google Research 的 AI Quests 展开。目标不是直接复制其线上项目，而是理解它的产品形态、源码可获得性、可参考的开源项目，并为后续搭建一个自己的、可维护、可扩展、可面向真实用户的类似产品确定技术路线。

AI Quests 的核心形态可以概括为：

- 面向学生的 AI 素养教育产品。
- 通过游戏化任务讲解 AI 如何解决现实问题。
- 用户在任务中经历数据收集、数据质量判断、模型训练、模型测试、结果反馈等流程。
- 内容包含剧情、角色、地图、小游戏、任务目标、教学材料。
- 产品不是单纯的 ML demo，也不是普通网页课程，而是“教育内容 + 交互任务 + 游戏表现 + 学习进度”的组合。

## 2. 用户需求与目标

当前目标：

- 搭建一个类似 AI Quests 的自有版本。
- 产品需要可维护，而不是一次性 demo。
- 未来会面向其他用户开放。
- 需要支持持续增加新的任务、主题和教学内容。
- 技术选型要兼顾开发效率、内容扩展、用户系统、进度保存、公开发布和长期维护。

隐含需求：

- 内容不能全部硬编码在组件里。
- 游戏流程要清晰可控，避免随着任务增加变成大量分散的条件判断。
- 用户进度、任务状态、失败重试、恢复学习等能力需要一开始就纳入设计。
- AI/ML 部分要服务教育目标，不一定从第一版就做重型真实训练。
- 架构应允许从 MVP 平滑升级到 CMS、用户后台、班级/教师功能、多语言等能力。

## 3. 对 AI Quests 的调研结论

### 3.1 产品用途

AI Quests 是 Google Research 的 AI 教育/游戏化学习网站。它让学生扮演类似 AI 研究员的角色，通过任务理解 AI 项目的关键阶段，例如：

- 收集数据。
- 判断数据是否可靠。
- 训练或模拟训练模型。
- 测试模型表现。
- 将 AI 应用到现实问题场景中。

它更接近“交互式 AI 素养课程 + 游戏化任务系统”，而不是普通游戏或普通机器学习工具。

### 3.2 源码情况

没有找到官方公开源码仓库。

线上网站可以访问到生产构建产物，例如：

- `https://research.google/ai-quests/main-J7QAYH37.js`
- `https://research.google/ai-quests/chunk-SX5JZXVS.js`
- `https://research.google/ai-quests/chunk-QHLVFMFZ.js`
- `https://research.google/ai-quests/chunk-YXJC6BUI.js`
- `https://research.google/ai-quests/chunk-UIO5BHG3.js`

从构建产物可以看出：

- 它是一个 Angular 前端应用。
- 有路由、任务模块、地图模块、进度逻辑、音频服务、调试入口、游戏场景相关代码。
- 包含类似 `quest-flood`、`market-marshes` 等任务和场景线索。

但这些只是压缩/打包后的生产代码，不是可维护源码。没有发现公开 `sourceMappingURL`，直接访问推测的 `.js.map` 文件也没有拿到真实 source map。因此不能作为正式学习或二次开发的源码基础。

## 4. 可参考的开源项目

这些项目不能完整替代 AI Quests，但可以分别学习其中某一部分。

### 4.1 Machine Learning for Kids

仓库：`https://github.com/IBM/taxinomitis`

适合学习：

- 面向儿童/学生的机器学习教育产品如何组织。
- 如何让学习者训练简单文本、数字、图片模型。
- 教育场景中的项目、训练数据、模型结果如何表达。

局限：

- 游戏化和剧情表现不如 AI Quests。
- 更偏工具和课堂活动，而不是沉浸式任务体验。

### 4.2 PAIR AI Explorables

仓库：`https://github.com/PAIR-code/ai-explorables`

适合学习：

- 如何把 AI 概念做成可交互网页。
- 可视化解释、概念演示、交互反馈。

局限：

- 不是完整游戏。
- 不提供任务系统、用户进度、剧情和关卡结构。

### 4.3 Teachable Machine Boilerplate

仓库：`https://github.com/googlecreativelab/teachable-machine-boilerplate`

适合学习：

- 浏览器里采集样本、训练分类器、实时预测的最小实现。
- TensorFlow.js、MobileNet、KNN 分类器的教育化使用方式。

局限：

- 更像技术 demo。
- 不包含完整产品架构。

### 4.4 TensorFlow Playground

仓库：`https://github.com/tensorflow/playground`

适合学习：

- 神经网络训练过程的交互可视化。
- TypeScript + D3 的模型解释型 UI。

局限：

- 重点是模型可视化，不是任务剧情或游戏。

### 4.5 ml5.js

仓库：`https://github.com/ml5js/ml5-library`

适合学习：

- 如何把机器学习能力包装成适合创意编程和教育场景的 API。
- 快速搭建浏览器端 AI demo。

局限：

- 不是产品框架。
- 仍需要自己设计任务系统、内容系统和用户系统。

## 5. 推荐技术架构

推荐采用：

```text
Next.js + React UI + Phaser 3 + XState + TensorFlow.js/模拟模型 + Supabase/Postgres + Headless CMS
```

整体结构：

```text
CMS / Quest JSON
   ↓
Next.js Web App
   ├─ 产品页面：主页、教师页、登录页、进度页
   ├─ Quest Shell：/quests/[slug]
   ├─ React UI：对话、任务说明、弹窗、按钮、无障碍文本
   └─ Phaser Canvas：地图、角色、小游戏、动画
          ↓
      XState Quest Engine
          ↓
  ML Worker / Simulation Layer
          ↓
Supabase/Postgres：用户、课堂、进度、事件、存档
```

### 5.1 Next.js

职责：

- 承载完整 Web 产品。
- 提供路由、登录页、教师页、SEO 页面、任务入口。
- 将游戏部分作为 client-only 模块懒加载。
- 方便后续接入后台、CMS、统计、权限系统。

选择理由：

- 面向公开用户时，产品不只是一个 canvas。
- Next.js 更适合承载用户注册、内容页面、服务端数据、SEO 和长期运营页面。
- 游戏模块可以和普通 Web 产品清晰分离。

### 5.2 React UI

职责：

- 对话框。
- 任务说明。
- 学习卡片。
- 提示。
- 模型结果面板。
- 教师/学生普通页面。
- 可访问性文本和键盘操作。

选择理由：

- 这类 UI 组件变化多、内容驱动强，用 React 比直接在 Phaser 里写 DOM/UI 更可维护。
- React 适合和 CMS 内容、状态机、用户数据结合。

### 5.3 Phaser 3

职责：

- 地图。
- 角色移动。
- 动画。
- 轻量小游戏。
- 可交互场景。
- 视觉反馈。

选择理由：

- Phaser 的 Scene 概念适合地图、任务、小游戏切换。
- 游戏循环、动画、输入、资源加载等能力成熟。
- 避免用 React 硬写高频互动和游戏场景。

不建议一开始用 Unity/Godot WebGL，除非目标是重度 3D 游戏。它们会增加加载体积、Web 集成成本、CMS 集成成本和前端可访问性成本。

### 5.4 XState

职责：

- 管理任务流程。
- 管理任务阶段。
- 管理失败重试。
- 管理是否解锁下一阶段。
- 管理恢复进度。
- 管理游戏层和 UI 层之间的事件。

选择理由：

- 类 AI Quests 的复杂度主要来自“流程”，而不是某一个页面。
- 如果用大量 `useState`、`if/else`、组件局部状态拼接，任务数量增加后会很难维护。
- 状态机可以让任务流程显式、可测试、可回放。

示例任务阶段：

```text
intro
  → collectData
  → cleanData
  → trainModel
  → testModel
  → applyModel
  → recap
  → complete
```

### 5.5 ML 层

推荐分阶段实现：

第一阶段：教育模拟模型

- KNN、线性评分、决策树、规则模型。
- 目标是让学生理解数据质量和模型结果的关系。
- 结果可控，便于教学设计。

第二阶段：TensorFlow.js

- 浏览器端训练小模型。
- 使用 Web Worker，避免阻塞 UI。
- 适合图像分类、简单表格分类、实时预测等任务。

第三阶段：服务端模型或 LLM

- 只在确实需要时接入。
- 要额外考虑成本、隐私、安全、审核、不可控输出。

关键原则：

- AI/ML 必须服务教育目标。
- 不要为了“真的用了 AI”而牺牲稳定性和教学可解释性。
- 第一版可以用模拟模型，只要交互能清楚表达 AI 流程。

### 5.6 Supabase/Postgres

职责：

- 用户登录。
- 学生进度。
- 班级/教师关系。
- 任务存档。
- 事件日志。
- 文件资源。

选择理由：

- 后续面向用户时，数据权限和关系数据很重要。
- Postgres 适合表达用户、任务、班级、进度、事件这些结构化关系。
- Supabase 提供 Auth、Postgres、Storage、Row Level Security，适合 MVP 到正式产品的过渡。

核心数据表建议：

```text
profiles
classrooms
classroom_members
quests
quest_versions
quest_progress
quest_events
activity_attempts
```

### 5.7 Headless CMS

第一版可以先不用 CMS，使用 typed JSON/YAML。

当任务结构稳定后，再接入 CMS：

- 想省维护和编辑体验好：Sanity。
- 想开源自托管：Strapi 或 Directus。

CMS 应管理：

- Quest 元数据。
- Chapter/Stage。
- 对话文案。
- 教师材料。
- 多语言文本。
- 图片、音频、视频资源。
- Activity 参数。

不要让 CMS 管复杂业务逻辑。业务逻辑应留在 `quest-core` 的状态机和 activity plugin 中。

## 6. 推荐代码组织

建议使用 monorepo：

```text
apps/
  web/
    # Next.js 产品与任务入口
  cms/
    # Sanity Studio、Strapi 或 Directus 配置，MVP 可暂缓

packages/
  quest-core/
    # Quest schema、XState 状态机、评分规则、事件类型
  game-runtime/
    # Phaser 封装、Scene 管理、资源加载、React/Phaser 事件桥
  ml-labs/
    # TensorFlow.js、KNN、模拟模型、Web Worker
  ui/
    # React UI 组件
  content-schema/
    # 内容 schema、校验、CMS adapter
```

核心原则：

- 把“任务内容”做成数据。
- 把“任务流程”做成状态机。
- 把“游戏表现”做成可替换 activity renderer。
- 把“AI 训练/预测”做成独立服务层。
- 把“用户进度”做成事件和状态快照，而不是散落在组件状态里。

## 7. Activity 插件模型

建议将任务中的互动抽象为 activity plugin。

示例 activity 类型：

```text
dialogue
collect-data
clean-data
select-features
train-model
test-model
simulation
quiz
recap
```

每个 activity 应包含：

- schema：内容参数。
- renderer：React 或 Phaser 实现。
- events：向状态机发送的事件。
- scoring：评分或完成规则。
- persistence：需要保存的状态。

这样新增任务时，大多数时候只需要新增内容，而不是新增代码。

## 8. MVP 路线

### 阶段 1：验证核心体验

目标：做出一个可玩的单任务原型。

范围：

- Next.js 项目。
- 一个 quest：例如“预测洪水风险”或“识别健康图像”。
- typed JSON 内容。
- React 对话和任务 UI。
- Phaser 地图或简单场景。
- XState 管完整流程。
- 本地存储进度。
- 模拟模型，不接真实后端。

验收标准：

- 用户可以从入口进入任务。
- 能完成数据收集、训练/模拟训练、测试、结果反馈。
- 刷新后能恢复进度。
- 新增一段对话或一个阶段不需要改核心流程代码。

### 阶段 2：产品化基础

目标：让产品可以给小范围用户试用。

范围：

- Supabase Auth。
- Postgres 保存进度。
- 基础事件日志。
- 多任务列表。
- 任务版本号。
- 基础教师/学生角色。
- 资源加载和错误边界。

验收标准：

- 用户登录后能跨设备恢复进度。
- 管理端能看到基础完成情况。
- 任务内容可以版本化。
- 数据权限通过 RLS 控制。

### 阶段 3：内容生产能力

目标：让非工程人员也能参与内容维护。

范围：

- 接入 Sanity/Strapi/Directus。
- 内容 schema。
- 草稿/发布流程。
- 多语言字段。
- 媒体库。
- 内容校验和预览。

验收标准：

- 新增任务主要通过 CMS 完成。
- 内容发布前可以预览。
- 错误内容不会破坏线上任务。

### 阶段 4：真实 ML 与规模化

目标：增强 AI 体验和用户规模承载能力。

范围：

- TensorFlow.js Worker。
- 更复杂的模型活动。
- 事件分析。
- A/B 测试。
- 教师班级报表。
- 隐私和安全策略。

验收标准：

- ML 训练不阻塞 UI。
- 模型结果可解释。
- 教师能查看班级学习进度。
- 用户数据权限、隐私声明、内容审核流程明确。

## 9. 不推荐的路线

### 9.1 纯 React 实现全部游戏

短期简单，但后续地图、动画、小游戏、碰撞、时间线都会越来越难维护。

### 9.2 一开始直接 Unity/Godot WebGL

适合重度 3D 游戏，但不适合当前优先级。它会增加 Web 产品集成、加载性能、内容系统、可访问性和维护成本。

### 9.3 一开始完全依赖真实 AI/LLM

会带来成本、隐私、安全、不可控输出和教学不稳定。教育产品的第一目标是可解释、可控、可重复。

### 9.4 任务内容硬编码在组件里

这是后期维护风险最大的做法。新增任务和修改文案都需要工程介入，长期会拖慢内容生产。

## 10. 当前建议

当前最务实的起步方案：

```text
Next.js + React + Phaser + XState + typed JSON + localStorage
```

第一版不要急着接 CMS 和复杂后台，先验证：

- 任务体验是否成立。
- 状态机抽象是否合理。
- 内容 schema 是否能覆盖真实任务。
- React UI 和 Phaser 场景的边界是否清晰。
- 模拟模型是否能清楚表达 AI 学习目标。

验证成功后，再加入：

```text
Supabase/Postgres + Auth + quest_progress + quest_events
```

最后再接：

```text
Sanity/Strapi/Directus
```

最终目标不是复刻 AI Quests 的技术栈，而是复刻它的产品能力：

- 游戏化 AI 学习。
- 可扩展任务内容。
- 清晰可控的学习流程。
- 面向真实用户的进度和权限系统。
- 可维护的工程结构。

