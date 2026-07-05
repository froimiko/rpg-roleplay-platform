# 跨渠道 Fallback v0(韧性战役·最后一项)

目标:主渠道重试耗尽仍失败时,自动切换到玩家自己配置的备用渠道把本回合讲完,
玩家看到「已切换到备用模型」而不是「生成失败请自己去设置换模型」。

生产依据:
- 上游 502 连环炸时玩家只能手动换模型重发(韧性审计 P0-2);
- v1.43.0 已有首token前同渠道重试(≤2次),本设计接在它的「重试耗尽」之后;
- v1.44.0 健康门控提供 degraded 信号,备选解析时跳过 degraded 渠道。

## 原则

- **严格 BYOK**:候选只来自该用户自己已配凭据的渠道,绝不引入平台代付。
- **同一提交语义**:只在【未提交任何事件】(无正文token/无工具调用,与 stream_retry
  的 committed 判定完全同源)时才允许切换——已提交后切换=换人续写,风格断裂+工具
  双重副作用,绝不做。
- 确定性=候选解析/触发判定/切换/通知;LLM 零参与。
- flag `channel_fallback` 默认关,前端开关同批(FEATURES 全套,吸取教训)。
- 每回合最多切换 1 次(防在多个坏渠道间震荡)。

## 触发条件(全部满足)

1. flag 开(用户级)。
2. stream_with_pretoken_retry 同渠道重试耗尽后仍抛出,且分类为 upstream/ratelimit
   (classify_provider_error 单一决策源,与重试/健康门控同口径)。
3. 包装器层面 committed == False(未提交任何事件)。
4. 本回合尚未切换过。

## 候选解析(确定性,server 侧)

`resolve_fallback_channel(user_id, exclude_api_id) -> (api_id, model) | None`:
1. 取该用户全部已配凭据的 api_id(list_credentials,排除当前失败渠道)。
2. 过滤:catalog enabled、非 embedding-only、`model_probe.is_channel_degraded` 为假。
3. 每个候选 api 的模型 = 该用户对该 api 的既有偏好模型(gm.* 偏好/user_model_entries
   已同步模型里的第一个/catalog 该 api 的默认),与现有模型解析链同源,不发明新逻辑。
4. 排序:用户 `gm.fallback_api_id` 偏好(若设置,后续 UI 支持;v0 无 UI 只认偏好键)
   优先,否则按 catalog 顺序取第一个。无候选 → None(走原错误路径)。

## 执行(chat_pipeline run_gm_phase 层)

现 v1.43.0 结构:`_st_retry(_gm_stream_factory, stop_event=_gm_stop)`。改造:

```
外层 while(最多 2 轮:主渠道轮 + fallback 轮):
    try: async for event in bridge(_st_retry(factory(当前gm), ...)) → 正常消费,轮结束
    except exc:
        if 已提交 or 分类不可切 or 已切过 or flag关: raise(原错误路径)
        candidate = resolve_fallback_channel(...)
        if not candidate: raise
        备用gm = GameMaster(model=cand_model, api_id=cand_api, user_id=...)
        yield agent 事件「主渠道 X 持续失败,已切换备用模型 Y,重新生成中…」
        当前gm = 备用gm;continue
```

- 「已提交」信号:stream_retry 包装器已跟踪 committed,把它暴露出来——包装器改为
  可传入一个 `committed_flag = threading.Event()`(或返回带状态的对象),外层读它判定。
- prompt/bundle/tools 复用同一份(与 retry 同理,重新生成整段);史官/后处理不感知
  切换(它们只看最终 response)。
- 备用 GM 构造失败(凭据解密炸等)→ 原样抛,走原错误路径,绝不递归。
- usage 记账:备用轮照常记(scenario 不变,api_id 自然是备用渠道的)。

## 玩家可见性

- 切换时 SSE agent 事件(phase="gm_fallback",status="running")+ 本回合 done 后的
  updates 附一条「本回合由备用模型 X 生成(主渠道故障)」——玩家必须知情,模型质量
  可能有差异。
- 切换成功同时 `model_probe.note_channel_failure(主api)`(健康门控自然累计,
  目录很快显示 degraded)。

## 明确不做(v0)

- 会话级粘滞切换(切了就一直用备用)——每回合独立,主渠道恢复即自动回主。
- 平台兜底渠道 / 中途续写切换 / 自动改用户默认模型偏好。
- 候选 UI 配置页(偏好键 `gm.fallback_api_id` 先留接口,UI 后续)。

## 测试

- resolve_fallback_channel:无凭据/只有当前渠道/degraded 全跳/偏好优先/顺序兜底
  (DB 依赖 monkeypatch list_credentials)。
- 触发判定纯逻辑:已提交不切/分类不符不切/flag 关不切/一回合只切一次。
- 包装器 committed 状态暴露的单测(扩展 test_stream_retry)。
- 源码守卫:fallback 轮存在于 async 生产路径(防再接错支线)。
