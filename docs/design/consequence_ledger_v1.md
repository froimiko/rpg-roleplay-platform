# 后果账本 Consequence Ledger v1(活世界·柱子2)

目标:玩家的选择在 N 回合后**主动回响**(欠的债有人来讨、救过的人再出现、许下的约定到期),
不再只靠 memory/facts 被检索命中碰运气。生产基线局实证:承诺只活在 6 回合历史窗里,
滚出窗口即蒸发 —— 这是长局「GM 忘事」的机制根源之一。

原则(与平台铁律一致):
- 调度/触发/注入 = 确定性代码;只有「兑现的文案」由 GM 生成。
- feature flag 默认关,灰度验后开;**前端开关与后端同批交付**(吸取 episodic_recall
  「后端在≠前端可见」教训)。
- 写穿同一条 apply_ops 单写者路径,不造并行存储。

## 1. 状态结构

`state.data["consequence_ledger"]: list[dict]`,条目:

```json
{
  "id": "cq_a1b2c3",
  "text": "答应雷纳德查清林中兽伤,明天中午前带证据回村",
  "due": {"turns": 5},              // 或 {"location": "阿托菲村"}
  "created_turn": 12,
  "status": "pending",              // pending | fired
  "fired_turn": null,
  "origin": "gm"                    // gm | recorder | player
}
```

- pending 上限 20 条,超出拒绝并在 updates 里说明(防 LLM 刷屏)。
- 同 text+due 重复登记拒绝(指纹去重,复用 dedupe 思路)。

## 2. 写入通道

- 新 JSON op:`{"op": "consequence", "text": "...", "due_turns": 5}` 或
  `{"op": "consequence", "text": "...", "due_location": "..."}` →
  `apply_structured_updates` 新分支(走既有写门控;question op 旁边加)。
- dispatcher 工具 `schedule_consequence`(origin 用现行合法值,照 worldbook_add 模式注册),
  GM function-calling 与 recorder ops 双通道都能写。

## 3. 触发引擎(确定性)

每回合 GM 生成前(provider collect 时)扫描 pending:
- turns 型:`state.turn_count >= created_turn + due.turns` → 触发。
- location 型:当前 `player.current_location` 包含 due.location 子串 → 触发。
触发即 `status=fired` + 记 `fired_turn`(幂等:fired 不再触发)。

## 4. 注入(新 context provider)

`rpg/context_providers/consequence_echo.py`,priority 85,加入 novel + freeform 两份
manifest,feature gate 包裹。内容 = 本回合刚触发的 + 最近 3 条 fired 未满 3 回合的
(给 GM 连续几回合的兑现窗口),模板:

> 【后果回响】过去的因正在追上来,GM 应在本回合或接下来几回合让它们自然兑现
> (以剧情事件呈现,不要生硬复述本清单):
> - (第12回合种下)答应雷纳德查清林中兽伤……

## 5. Flag 与前端

- `core/feature_flags.py`:`"consequence_ledger": ("RPG_CONSEQUENCE_LEDGER", "0")`。
- `frontend/src/agent-modules.js` FEATURES 补条目 + zh/en i18n(设置页可见可开关)。

## 6. 测试(不依赖 DB)

- 触发判定纯函数:turns 到期/未到期、location 命中/不命中、fired 幂等。
- 上限与指纹去重。
- apply op 分支:合法登记/缺字段拒绝且不崩。
- provider 输出:gate 关=skip、无触发=空、触发=含模板文案。

## 7. v1 明确不做

- 时间标签触发(要等时间连续性护栏)、跨存档回响、账本管理 UI(后续按需)。
- recorder 三合一「consequences」任务扩展(从对话里挖承诺)= GM 敏感改动,单独批次人工做。
