"""修2:酒馆「AI 角色(character)」切换双源病根修——persona 已修,character 曾漏网。

病灶:bind-card role="character" 只写 game_saves FK 列(tavern_character_card_id),
不写 state.data['tavern']['character'](GM 实际读的位,context_providers/tavern.py 约52-53),
_fields=None 令活会话同步整体跳过 → 面板换了新角色,GM 继续演旧角色,重开存档才恢复。

修:写穿层 apply_persona_card_to_chat 加 role 参数泛化(character→card_to_dto 深合并进
tavern.character + FK + game_saves 快照 + 工作树快照 + snapshot_hash);bind 端点 character
分支走写穿 + 活会话同步。镜像 test_tavern_persona_switch.py;persona 原测试须保持绿。
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TP = (ROOT / "platform_app" / "tavern_persona.py").read_text(encoding="utf-8")
RT = (ROOT / "routes" / "tavern.py").read_text(encoding="utf-8")

import sys

sys.path.insert(0, str(ROOT))


class _RecordingDB:
    """记录所有 execute 的 SQL(归一化空白),验证写穿层 SQL 形状。"""

    def __init__(self):
        self.sql: list[tuple[str, object]] = []

    def execute(self, sql, params=None):
        self.sql.append((" ".join(sql.split()), params))

        class _R:
            @staticmethod
            def fetchone():
                return None

        return _R()

    def commit(self):
        pass


def _card() -> dict:
    return {
        "id": 77, "card_type": "npc", "name": "薇尔莉特", "identity": "剑士",
        "appearance": "银发", "personality": "冷静", "speech_style": "简短",
        "background": "流亡贵族", "sample_dialogue": ["哼。"], "metadata": {},
    }


def test_character_write_through_targets_character_layer():
    """character 写穿:FK=character 列,快照合并进 tavern.character(GM 读的位),三层俱全。"""
    from platform_app.tavern_persona import apply_persona_card_to_chat

    db = _RecordingDB()
    fields = apply_persona_card_to_chat(db, user_id=7, chat_id=42, card=_card(), role="character")

    # 投影=完整卡 DTO(与 activation._refresh_tavern_cards_from_library 同口径 card_to_dto)
    assert fields["name"] == "薇尔莉特"
    assert "appearance" in fields and "speech_style" in fields and "background" in fields

    joined = " || ".join(s for s, _ in db.sql)
    # FK 列=character 侧,且绝不误写 persona 列
    assert "tavern_character_card_id = %s" in joined, "必须写 character FK 列"
    assert "tavern_persona_card_id" not in joined, "character 路径不得误写 persona 列"
    # 快照合并进 tavern.character + tavern.character_card_id(GM/面板读的位)
    assert "'character'" in joined and "character_card_id" in joined
    # 三层俱全:game_saves 快照 + 工作树快照 + snapshot_hash 失效
    assert any("game_saves set state_snapshot" in s for s, _ in db.sql), "game_saves 快照"
    assert any("runtime_checkouts set state_snapshot" in s for s, _ in db.sql), "工作树快照(回合真相源)"
    assert "snapshot_hash = md5" in joined, "跨 worker 缓存失效(v1.28.3 家族病防复发)"


def test_bind_endpoint_character_shares_layer_and_syncs_character_key():
    """bind 端点:character 与 persona 同走共享写穿层;活会话同步对 character 也跑。"""
    i = RT.find("def api_tavern_bind_card")
    seg = RT[i:i + 4000]
    # 两 role 都走共享写穿层(不再复制平行实现)
    assert "role=role" in seg, "character 与 persona 同走共享写穿层"
    # 活会话同步:character 更新 state.data['tavern']['character'](GM 读的位)+ character_card_id
    assert 'setdefault("tavern", {})' in seg
    assert "character_card_id" in seg, "活会话同步须落 character_card_id"
    # persona 分支保留(原测试兼容 + 行为不回退)
    assert '.setdefault("player", {}).update' in seg


if __name__ == "__main__":
    import pytest

    raise SystemExit(pytest.main([__file__, "-v"]))
