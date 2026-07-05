# RATH·搖光观测台 v0(有界以假乱真实验)

目标(用户原话):「造假,但在一定范围内以假乱真」。对标 SAO 人工搖光的三条可工程化轴:
①离线世界钟(玩家不在时世界按真实时间推进);②NPC-NPC 离线场景(两个议程驱动的角色真的
互演一段并留下痕迹);③痕迹可被玩家验证(回来问 NPC,NPC 真的记得)。
实验载体:剧本 11《我的二战不可能这么萌》;入口:游玩导航组新增 RATH 分页。

## §1 核心架构铁律:离线绝不写游戏 state

离线 tick 的一切产物只写:
- **kb_events**(`live_repo.record_event`,born=当前活跃 commit):COW、谱系 CTE 分支隔离、
  天然被【情景召回】(episodic_recall,已全局开)当语料 → 玩家回来问 NPC 离线期间的事,
  召回真的能召到 → **以假乱真的闭环不需要任何新注入机制**。
- **rath_events 表**(观测台时间线,含完整 transcript,纯展示用)。
- **rath_experiments 表**(实验元数据:时钟/加速/预算/状态)。

不碰 state_snapshot/worktree/messages/世界时间(world.time 是 GM 主权,时间线机器不受扰)。
state 只读(runtime_checkouts.state_snapshot):取 npc_agendas/relationships/location/近况做材料。
玩家回归后,世界通过两条既有通道自然吸收离线事实:情景召回(问就有)+ GM 下回合正常记账。

## §2 组件

- `rpg/rath/engine.py`:实验 CRUD + `tick_experiment`(读快照→离线心跳 LLM→验收→落 kb_events
  + rath_events→更新时钟/预算)。世界钟=`world_clock_min += 真实流逝分钟 × accel`(默认 60x),
  仅实验层展示+提示词素材(「距玩家离开已过去世界内约X小时」),不写 world.time。
- `rpg/rath/npc_scene.py`:每第 2 个 tick(且快照里 ≥2 个议程 NPC)跑一场离线对手戏。
  prompt=两 NPC 档案(goal/stance/关系)+地点+世界钟+近期事件;输出严格 JSON
  {transcript≤8行, scene_summary, npc_updates{name:{goal?,stance?,private_memory}}}。
  防臆造闸:npc_updates 键必须 ∈ 被选两 NPC(同柱子3口径);地理铁律沿用心跳 prompt 第5条。
  scene_summary 落 kb_events;transcript/npc_updates 落 rath_events(kind=scene)。
- ticker:`core/startup.py` lifespan `asyncio.create_task`,每 60s 扫 due 实验
  (status=running 且 now-last_tick≥interval);**pg advisory lock 串行化(workers=2)**;
  tick 本体 `asyncio.to_thread`。
- 预算闸(有界!):tick 间隔默认 1800s;每实验每日 ≤48 tick/≤12 scene(day_key 归零);
  **72h 无人看(last_viewed_at)自动 pause**;每用户同时 ≤2 个 running 实验。
- API `rpg/routes/rath.py`(require_user+flag `rath_experiment` 默认关):
  GET/POST /api/rath/experiments;GET /{id}(bump last_viewed_at);POST /{id}/tick(手动,计预算);
  /{id}/pause /{id}/resume /{id}/accel。绑定**已有存档**(校验属主+script);无档引导先开一局。
- 前端 `pages/rath.jsx`:游玩组新分页。世界钟卡+加速档(1x/60x/240x)+搖光单元板
  (NPC goal/stance/private_memory)+观测时间线(心跳事件/对手戏 transcript 可展开)+
  立即演算一拍/暂停恢复。照 tavern 内嵌子页范式注册。

## §3 模型与费用

LLM 解析复用 recorder 的 BYOK 严格解析(api_id_override/model_override 可选,默认用户默认模型)。
离线烧的是档主自己的 key → 预算闸是产品边界不是可选项。

## §4 验收(e2e,剧本11)

新开一局玩 2-3 回合(种出 ≥2 个议程 NPC)→ 建实验 → 手动 tick×3(含一场对手戏)→
观测台可见事件/transcript → 回游戏问 NPC「我不在的时候你们……」→ 情景召回注入离线场景
→ NPC 答得上 = 闭环成立。

## §5 非目标(v0 不做)

改 world.time/state;每 NPC 独立记忆视角(轴③完整版);玩家离线时 GM 主动开场白;
多实验并行编排;FLA 千倍加速(240x 封顶,防预算失控)。
