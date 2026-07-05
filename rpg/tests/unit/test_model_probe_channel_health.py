"""渠道健康门控(韧性战役):被动失败计数滑动窗口 + GET /api/models 的 degraded 标记。

生产事故形态:某中转站网关连环 502 期间,模型选择器照样把挂掉的渠道端给每个用户,
人人各撞一次。这里不做主动探测,只是把已分类为 upstream/ratelimit 的失败被动记下来,
滑动窗口内达到阈值就把该 api_id 标记 degraded。

时间一律用可注入 clock 参数,不真 sleep。
"""
import model_probe


def _reset():
    """每个测试前清空模块级失败计数,避免测试间串扰(模块级 dict 单例)。"""
    model_probe._FAILURE_EVENTS.clear()


class _FakeClock:
    """可控前进的假时钟,ticks() 返回当前值,advance() 前移。"""

    def __init__(self, start: float = 1_000_000.0):
        self.now = start

    def __call__(self) -> float:
        return self.now

    def advance(self, seconds: float) -> None:
        self.now += seconds


def test_below_threshold_not_degraded():
    _reset()
    clock = _FakeClock()
    model_probe.note_channel_failure("deepseek", user_id=1, clock=clock)
    model_probe.note_channel_failure("deepseek", user_id=1, clock=clock)
    assert model_probe.channel_failure_count("deepseek", clock=clock) == 2
    assert not model_probe.is_channel_degraded("deepseek", clock=clock)


def test_reaches_threshold_marks_degraded():
    _reset()
    clock = _FakeClock()
    model_probe.note_channel_failure("deepseek", user_id=1, clock=clock)
    model_probe.note_channel_failure("deepseek", user_id=1, clock=clock)
    model_probe.note_channel_failure("deepseek", user_id=1, clock=clock)
    assert model_probe.channel_failure_count("deepseek", clock=clock) == 3
    assert model_probe.is_channel_degraded("deepseek", clock=clock)


def test_aggregates_across_different_users():
    # 事故场景:多个不同用户各自只撞一次同一渠道,合起来达到阈值 —— 不该因为
    # 单个用户次数不够就漏判。
    _reset()
    clock = _FakeClock()
    model_probe.note_channel_failure("openrouter", user_id=1, clock=clock)
    model_probe.note_channel_failure("openrouter", user_id=2, clock=clock)
    model_probe.note_channel_failure("openrouter", user_id=3, clock=clock)
    assert model_probe.is_channel_degraded("openrouter", clock=clock)


def test_different_api_id_not_affected():
    _reset()
    clock = _FakeClock()
    model_probe.note_channel_failure("deepseek", user_id=1, clock=clock)
    model_probe.note_channel_failure("deepseek", user_id=1, clock=clock)
    model_probe.note_channel_failure("deepseek", user_id=1, clock=clock)
    assert model_probe.is_channel_degraded("deepseek", clock=clock)
    assert not model_probe.is_channel_degraded("openai", clock=clock)


def test_sliding_window_expires_old_failures():
    _reset()
    clock = _FakeClock()
    model_probe.note_channel_failure("deepseek", user_id=1, clock=clock)
    model_probe.note_channel_failure("deepseek", user_id=1, clock=clock)
    clock.advance(301.0)  # 超过 5 分钟窗口
    model_probe.note_channel_failure("deepseek", user_id=1, clock=clock)
    # 前两次已过期,窗口内只剩 1 次 —— 不该 degraded
    assert model_probe.channel_failure_count("deepseek", clock=clock) == 1
    assert not model_probe.is_channel_degraded("deepseek", clock=clock)


def test_window_boundary_just_under_threshold_seconds():
    _reset()
    clock = _FakeClock()
    model_probe.note_channel_failure("deepseek", user_id=1, clock=clock)
    clock.advance(299.0)  # 仍在窗口内(< 300s)
    model_probe.note_channel_failure("deepseek", user_id=1, clock=clock)
    clock.advance(0.5)
    model_probe.note_channel_failure("deepseek", user_id=1, clock=clock)
    assert model_probe.channel_failure_count("deepseek", clock=clock) == 3
    assert model_probe.is_channel_degraded("deepseek", clock=clock)


def test_success_clears_only_that_user_bucket():
    _reset()
    clock = _FakeClock()
    model_probe.note_channel_failure("deepseek", user_id=1, clock=clock)
    model_probe.note_channel_failure("deepseek", user_id=1, clock=clock)
    model_probe.note_channel_failure("deepseek", user_id=2, clock=clock)
    assert model_probe.channel_failure_count("deepseek", clock=clock) == 3
    model_probe.note_channel_success("deepseek", user_id=1)
    # user 1 的桶清零,user 2 的失败仍在 —— 聚合计数应降到 1
    assert model_probe.channel_failure_count("deepseek", clock=clock) == 1
    assert not model_probe.is_channel_degraded("deepseek", clock=clock)


def test_success_noop_when_no_prior_failures():
    _reset()
    # 不应抛异常
    model_probe.note_channel_success("deepseek", user_id=99)
    assert model_probe.channel_failure_count("deepseek") == 0


def test_note_failure_empty_api_id_is_noop():
    _reset()
    model_probe.note_channel_failure("", user_id=1)
    assert model_probe.channel_failure_count("") == 0


def test_anonymous_user_id_bucketed_as_zero():
    # 未登录请求 user_id=None,应归到 0 桶而不是抛异常/跨用户串扰。
    _reset()
    clock = _FakeClock()
    model_probe.note_channel_failure("deepseek", user_id=None, clock=clock)
    model_probe.note_channel_failure("deepseek", user_id=None, clock=clock)
    model_probe.note_channel_failure("deepseek", user_id=None, clock=clock)
    assert model_probe.is_channel_degraded("deepseek", clock=clock)


def test_inject_health_marks_degraded_api_and_models():
    """GET /api/models 的 _inject_health 必须对 degraded 的 api_id 加 degraded:true,
    且不隐藏不删除任何模型(目录降权,不是过滤)。"""
    import routes.models as models_route

    _reset()
    # _inject_health 内部用 model_probe.is_channel_degraded 的默认 clock=time.time,
    # 记录失败时也必须用真实 time.time() 的量级,否则假时钟(从 1_000_000 起)记的事件
    # 相对真实 time.time() 早了几十年,窗口判定必然过期。
    import time as _time
    model_probe.note_channel_failure("flaky_provider", user_id=1, clock=_time.time)
    model_probe.note_channel_failure("flaky_provider", user_id=1, clock=_time.time)
    model_probe.note_channel_failure("flaky_provider", user_id=1, clock=_time.time)

    catalog = {
        "apis": [
            {
                "id": "flaky_provider",
                "models": [
                    {"real_name": "model-a"},
                    {"real_name": "model-b"},
                ],
            },
            {
                "id": "healthy_provider",
                "models": [{"real_name": "model-c"}],
            },
        ]
    }
    out = models_route._inject_health(catalog)
    flaky = next(a for a in out["apis"] if a["id"] == "flaky_provider")
    healthy = next(a for a in out["apis"] if a["id"] == "healthy_provider")

    assert flaky.get("degraded") is True
    assert all(m.get("degraded") is True for m in flaky["models"])
    # 不隐藏不删除:两个 model 都还在
    assert {m["real_name"] for m in flaky["models"]} == {"model-a", "model-b"}
    assert "degraded" not in healthy
    assert not any(m.get("degraded") for m in healthy["models"])

    _reset()


def test_inject_health_no_degraded_key_when_healthy():
    _reset()
    catalog = {"apis": [{"id": "calm_provider", "models": [{"real_name": "m1"}]}]}
    import routes.models as models_route
    out = models_route._inject_health(catalog)
    api = out["apis"][0]
    assert "degraded" not in api
    assert "degraded" not in api["models"][0]
    _reset()
