# world_key 模型 v1 — 叙事脊柱 + 世界标签(时间线战役·批次2设计定稿)

> 状态:待用户批准 → 批次 3 实施。
> 血统:B 设计结论(与晓卡敲定,memory project_timeline_world_model)+ 批次 0 代码
> 侦察(2026-07-05)+ O 篇 §1 统一 KB 模型。
> 解决的用户可见问题:无限流/穿越/平行/倒叙书的时间线锚点是垃圾(章节标题当时间、
> 首锚点落在几十章、跨副本设定串味),线性书零影响。

## 0. 核心论纲(叙事学基础,不变)

- **唯一可靠主轴 = 叙事顺序(章节序,discourse time)**:任何书都单调、免费、无歧义。
- **故事时间(story time)非线性且多值**(倒叙/闪回/平行),只能当【段内标签】,
  永远不能当全局排序轴——这是旧时间线锚点全部乱象的根源。
- **世界(world)是第三个正交维度**:无限流的副本、穿越的两界、平行位面。同世界内
  的 in_world_time 才可比较;跨世界比较无意义。

## 1. 术语统一(第一铁律:绝不造第三套)

现状三套并存(批次 0 侦察实锤):

| 概念 | 现状 | 处置 |
|---|---|---|
| `script_worldlines` / `script_worldline_nodes`(wl_key/parent_wl/branch_at_node) | **已生产化**,steering 每回合读,粗弧层"世界树脊柱" | **保留原职**:玩家世界线分支(存档级"如果当时选了B")的脊柱。它管的是【玩家的分支】,不是【原著的多世界】——两个正交概念,名字近但语义不同,文档明示防混 |
| `reveal_anchors.worldline_key` / `save_reveal_frontier.worldline_key` | 休眠,只写 'main' | **定名统一点**:本设计的 world_key **就是它**——不加新列名,复用 `worldline_key` 字段名,语义定义为「原著叙事世界标签」 |
| B 设计口头的 `world_key` | 未落地 | 落地时一律写作 `worldline_key`(下文行文仍说 world_key 指概念,代码/DDL 全用 worldline_key) |

**层级关系**:`script_worldlines`(玩家分支脊柱,存档运行时) ⊥ `worldline_key`
(原著世界标签,剧本静态)。二者唯一交点:GM scope 取「当前玩家所处原著世界」时,
从进度/锚点推导 worldline_key,与玩家分支无关。文档级约定写进两处代码注释。

## 2. Schema(全部加性、可空,旧行 null=主世界=现状)

```sql
-- 提取产物层(贵的、已花用户钱的,只加列不动行)
alter table chapter_facts
  add column if not exists worldline_key text,          -- null = 主世界
  add column if not exists in_world_time text;          -- 世界内时间标签(复用 story_time_label 语义,但仅同 world 内可比)
alter table script_timeline_anchors
  add column if not exists worldline_key text;
-- kb_canon_entities 首版不加列:实体跨世界归属走 chapter_facts 关联推导,避免过度建模
```

- 旧数据零迁移成本:null 处处按 '主世界' 解释(读侧 `coalesce(worldline_key,'main')`)。
- `reveal_anchors.worldline_key` 已存在,回填时与 `script_timeline_anchors` 同源写。

## 3. world 检测 = 逐段三分类(相对上一段语境)

对每个「段」(以 arc/卷 为粒度,回退到章窗)判定 `{continuous | time_skip | new_world}`:

**第一层·结构先验(免费,确定性)**:
- `volume_title` 变化(卷/部切换);
- 章/卷标题命中先验词表:副本、世界、位面、穿越、轮回、第X世、序幕/尾声、
  梦境、回忆篇、if线、平行、异世界、【】括号编号变化;
- 命中 → 标记为 new_world **候选**,未命中默认 continuous。

**第二层·LLM 窄确认(只对候选,便宜模型)**:
- 输入:候选段前后各 1 段的已存 summary(读 chapter_facts,不重读原文)+ 卷/章标题。
- 输出(严格 JSON):`{"verdict":"continuous|time_skip|new_world","world_label":"...","evidence":"引用 summary 中的原话"}`——**new_world 必须举证**,无证据降级 continuous。

**第三层·过切回退(确定性)**:
- 产出的 world 数 ≥ arc 数 × 0.8 → 判过切,整书回退单世界 + log(宁漏勿误:
  漏切=退化成现状线性,不崩;误切=检索串味+时间线破碎,更糟)。
- world 数是**输出不是输入**,不猜题材、不设期望值。

## 4. 迁移 = 确定性零 LLM 回填(用户不重花钱)

- 贵的资产(`chapter_facts` 全行、`kb_canon_entities`)**一行不动**;
- 回填脚本只读已存 `summary`/`volume_title`/章标题跑第一层结构先验 → 写
  `worldline_key`/`in_world_time` 两列;弱信号书全 null=单世界=现状;
- 第二层 LLM 确认为**可选增强**(admin 工具按剧本手动触发,BYOK 报价先行,
  与「时间线锚点重做」同入口),默认不跑;
- 幂等可重跑(纯函数式覆盖两列,不碰其它列)。

## 5. 消费侧改造

**5a 聚合层**(`extract/resolve.build_timeline` + `rebuild.rebuild_timeline_from_db`):
- 分段逻辑从「story_time_label 相等聚合」改为「**先按 worldline_key 分组,组内
  按章节序 + 承接式时间标签聚合**」(2026-06-14 的承接式/序章修复语义保留);
- 锚点写入带 worldline_key;UI DTO 附 world 分组字段。

**5b RAG/GM scope**(防跨副本串味):
- retrieval 的章窗/worldbook/实体召回,在「当前 world 可判定」时追加
  `coalesce(worldline_key,'main') = 当前world` 过滤;判定不了(null 进度/单世界书)
  → 无过滤=现状。当前 world 推导 = 玩家进度章所属段的 worldline_key(确定性查表)。

**5c UI**:时间线面板按 world 分组渲染(组标题=world_label),单世界书渲染不变。

## 6. 与 frontier 的对接(预留,不在本战役做)

`save_reveal_frontier.worldline_key` 与本设计同名同义:将来 frontier 转正时,
前沿集合天然按 world 分域(穿越档在两个 world 各有前沿,互不剧透)。本战役只保证
**字段语义一致 + 回填同源**,不动 frontier 代码。

## 7. 分批实施表(批准后执行)

| 批次 | 内容 | 验收标准 |
|---|---|---|
| **3a** | schema 两列 + 结构先验回填脚本 + 幂等重跑 + 单测 | 无限流样本(script 133 类,多副本)回填出 ≥2 个 world 且分界落在卷/副本切换;线性样本(script 42/12)全 null;重跑幂等 |
| **3b** | 聚合层按 world 切段 + RAG/GM scope 过滤 + LLM 窄确认 admin 工具 | script 133 时间线锚点首锚在第 1 章、按副本分段;跨 world 检索串味用例(副本A查副本B实体)被过滤;线性样本聚合输出与改前逐字节一致(零变化守卫测试) |
| **3c** | UI 按 world 分组 + 「重做时间线」入口带 world 选项 | 真浏览器验收:多副本书时间线分组显示;线性书 UI 零变化 |

每批独立发版(3a/3b=minor)、探针验收、OSS 同步,照批次 1 纪律。

## 8. 风险与不做清单

**风险**:
- 先验词表误命中(如书名自带"世界"字样的章标题)→ 三分类有 LLM 确认层兜底 +
  过切回退;线性样本零变化守卫测试是硬闸。
- scope 过滤误伤跨世界贯穿实体(主角本人/系统金手指)→ 5b 只过滤 world 专属实体
  (chapter_facts 关联单一 world 的),多 world 出现的实体不过滤。

**明确不做(v1)**:
- kb_canon_entities 加列(走关联推导);
- frontier 行为改动(只对齐语义);
- 玩家分支(script_worldlines)与原著世界标签的任何合并——正交概念,各管各的;
- 自动全量 LLM 复核(只做 admin 手动触发的选择性复核)。
