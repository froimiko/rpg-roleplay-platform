# 时间线重构战役 · 作战计划(阶段3,用户已拍板方向)

> 状态:待用户过目。批次 0/1 为诊断与确定性快赢,已按既有授权先行;批次 2 起的
> 大件按本计划节奏走,每批独立上线 + save 347/新建 rail 探针局验收 + 版本纪律。

## 0. 三份设计稿与代码现状的真实关系(2026-07-05 侦察定案)

| 设计 | 现状 |
|---|---|
| ARCH_107 双时间线(save 级 phase 摘要/时间线锚点/世界书 overlay) | ✅ 已全部上线(v33 迁移起),非本战役对象 |
| O 篇统一时间感知 KB(前沿 DAG 揭示门控) | 代码 P0-P5 已落地但 **flag 全 off=生产 0% 生效**;只有单链 main,fork/分叉 0%;kb_edges 有写无读 |
| B 完整 world_key 模型(叙事脊柱+世界标签,本战役主攻) | **0% 落地,正式设计文档待写(=批次 2)** |

⚠️ **三套世界线概念并存风险**:`script_worldlines`(脊柱,已生产化,有 parent_wl/branch_at_node)
/ `reveal_anchors.worldline_key`(休眠,只写 'main')/ B 设计的 `world_key`(未落地)。
本战役第一铁律:**统一成一个概念,绝不造第三套**(灰度不收尾留并行路径的病根就在眼前)。

## 关键洞察(反馈聚类 top1 与本战役的交点)

**估章激进化与 rail 忠实度的结构性冲突**:b185419fa/d5cd5204d 为救「自插入卡章」
玩家放宽了史官估章 → `progress_chapter` 更激进前推 → rail 档正文注入窗口
(get_progress_window 依赖它)跳过玩家尚未经历的章 → 「跳过关键情节」= id115 十天
连报的候选根因。**标量进度信号服务不了两类玩家**;前沿 reached-set(已建、休眠)
正是解耦机制:rail 窗口应跟「实际到达的锚点」走,估章只服务发散节奏。

## 批次划分

### 批次 0 · 诊断收尾(读侧,当天)
- rail 根因实证:用已授权的生产只读,取 id115 的 rail 存档,重放 progress_chapter/
  occurred 锚点/注入窗口随回合的演化,验证「估章过激→窗口跳章」链路是否实锤。
- 出生点观感问题(聚类 top2):后端判定无回归(4/4 测试+行级 git 历史),转查前端
  建档向导 birthpoint 传参链路。
- 验收物:两份判定报告,决定批次 1 的精确改法。

### 批次 1 · rail 忠实度确定性修复(快赢,1-2 天,minor 版本)
- 原则:**rail 档的窗口下限只认确定性信号**(已 occurred 锚点 / 出生点),估章
  (`_apply_estimate`)不得推动 rail 档的注入窗口;非 rail 档行为不变(自插入玩家
  的救济保留)。实现按批次 0 实证结果定,预计是 get_progress_window / retrieval
  的 rail 分支加确定性护栏,小缝改动。
- 验收:新建 rail 探针局逐章走原著,验证关键情节不跳;id115 反馈闭环回复。

### 批次 2 · B 模型正式设计文档(1 天,纯文档,发用户过目)
- `docs/design/world_key_model_v1.md`:
  - 术语统一:B 的 `world_key` ≡ O 的 `worldline_key`,并给出与 `script_worldlines`
    (脊柱)的打通方案(脊柱=粗弧层,world_key=章节/锚点层标签,映射关系明确)。
  - schema:`chapter_facts`/`script_timeline_anchors` 加**可空** `world_key`/
    `in_world_time`(旧行 null=主世界=现状,不动已花钱的提取产物)。
  - world 检测=逐段相对上段三分类 {continuous/time_skip/new_world},结构先验
    (卷名/标题命中副本·世界·位面·第X天)免费先筛 → LLM 窄确认 → 过切回退
    (world 数≈arc 数则退单世界);world 数是输出非输入,宁漏勿误。
  - 迁移=确定性零 LLM 回填(读已存 summary/volume_title),用户不重花钱;
    弱信号书退化单世界=现状不崩。
  - 聚合层(build_timeline/rebuild)按 world 切段;RAG/GM 按 world scope(防无限流
    跨副本串味);UI 时间线按 world 分组。

### 批次 3 · world_key 落地(2-3 天,分 3a schema+回填 / 3b 聚合+scope / 3c UI)
- 每小批独立上线;真书验收用无限流样本(script 133 类,多副本)+ 线性样本
  (单世界退化=零变化)。

### 批次 4 · 前沿双轨收尾评估(灰度,与批次 3 并行可选)
- 开 `RPG_TKB_FRONTIER_SHADOW`(仅日志比对,零行为变化)积累新旧门控分歧数据;
- kb_edges 读路径接入评估(P2「关系图生效」价值兑现)或明确冷藏并写明理由;
- fork_anchor 分叉留待 world_key 落地后与其联动设计,不单独做。

## 纪律(沿用柱子战役打法)
- 每批:默认关 flag/可空列 → 测试全绿 → 发版(feature=minor)→ 部署 → 探针验收
  → OSS 三方同步 → 战报。
- GM/估章相关改动亲自做;机械件紧规格委派;与代理共库提交前查重叠面。
- 设计冲突(如术语统一)一律先写进文档定案再动代码。
