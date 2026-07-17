"""constant 世界书骨架构建 — build_constant_worldbook 行为快照。

不连 DB:用 FakeDB 记录 delete / kb_canon_entities select / worldbook_entries insert。
锁死三条确定性行为(下面的模块级纯函数提升重构必须保持不变):
  · 污染过滤:concept 的 summary 命中场景污染词(穿着/正在/…)→ 该 entity 剔除。
  · importance 门槛:concept/location/faction importance < 5 → 剔除(canon 有数据时)。
  · 索引 + detail entries 形状:同 subtype ≥2 成员先出一条索引条(priority 88),
    每个成员一条 detail 条(faction detail priority 78);character/item 不入库。
"""
import types
import unittest

from extract.resolve import build_constant_worldbook


class _FakeDB:
    """记录 build_constant_worldbook 发出的 SQL:canon select 回放构造行,insert 落表。"""

    def __init__(self, canon_rows):
        self._canon_rows = canon_rows
        self.inserts = []  # (title, content, priority)
        self._last = ""

    def execute(self, sql, params=None):
        self._last = sql
        if "insert into worldbook_entries" in sql.lower():
            # params 顺序: (book_id, script_id, title, content, keys, priority, metadata)
            self.inserts.append((params[2], params[3], params[5]))
        return self

    def fetchall(self):
        if "kb_canon_entities" in self._last.lower():
            return self._canon_rows
        return []

    def fetchone(self):
        return None


def _canon_rows():
    return [
        {"logical_key": "lk_de", "name": "德军", "type": "faction",
         "entity_subtype": "军队", "parent_logical_key": "",
         "summary": "德意志国防军,二战主要军事力量。", "aliases": [],
         "first_revealed_chapter": 1, "importance": 20},
        {"logical_key": "lk_us", "name": "美军", "type": "faction",
         "entity_subtype": "军队", "parent_logical_key": "",
         "summary": "美利坚合众国武装部队。", "aliases": [],
         "first_revealed_chapter": 2, "importance": 15},
        # importance < 5 → 门槛剔除
        {"logical_key": "lk_small", "name": "小股游击队", "type": "faction",
         "entity_subtype": "军队", "parent_logical_key": "",
         "summary": "地方游击力量。", "aliases": [],
         "first_revealed_chapter": 3, "importance": 2},
        # 干净 concept → 保留
        {"logical_key": "lk_ether", "name": "以太体系", "type": "concept",
         "entity_subtype": "力量", "parent_logical_key": "",
         "summary": "以太是本作驱动超凡能力的基础能量。", "aliases": [],
         "first_revealed_chapter": 1, "importance": 30},
        # 被污染的 concept(summary 含"穿着")→ 剔除
        {"logical_key": "lk_kimono", "name": "和服", "type": "concept",
         "entity_subtype": "服饰", "parent_logical_key": "",
         "summary": "茜茜和薇欧拉穿着华丽的和服出席。", "aliases": [],
         "first_revealed_chapter": 5, "importance": 12},
        # character 不走 worldbook
        {"logical_key": "lk_cici", "name": "茜茜", "type": "character",
         "entity_subtype": "", "parent_logical_key": "",
         "summary": "女主角。", "aliases": [],
         "first_revealed_chapter": 1, "importance": 50},
    ]


class BuildConstantWorldbookBehavior(unittest.TestCase):
    def setUp(self):
        self.db = _FakeDB(_canon_rows())
        seed = types.SimpleNamespace(era="", power_system=None, key_factions=None)
        self.written = build_constant_worldbook(self.db, 101, 202, seed)
        self.titles = [t for (t, _c, _p) in self.db.inserts]
        self.by_title = {t: (c, p) for (t, c, p) in self.db.inserts}

    def test_written_count_and_return(self):
        # 4 条:1 索引(军队)+ 2 detail(德军/美军)+ 1 concept detail(以太体系)
        self.assertEqual(self.written, 4)
        self.assertEqual(len(self.db.inserts), 4)

    def test_contaminated_concept_dropped(self):
        # "和服" summary 含"穿着" → 场景污染,不得入库
        self.assertNotIn("概念·和服", self.titles)
        self.assertFalse(any("和服" in t for t in self.titles))

    def test_low_importance_dropped(self):
        # importance=2 < 5 → 剔除
        self.assertFalse(any("游击" in t for t in self.titles))

    def test_character_not_in_worldbook(self):
        self.assertFalse(any("茜茜" in t for t in self.titles))

    def test_index_entry_shape(self):
        # 同 subtype ≥2 成员 → 一条索引条,priority 88
        self.assertIn("势力索引·军队", self.by_title)
        content, priority = self.by_title["势力索引·军队"]
        self.assertEqual(priority, 88)
        self.assertEqual(content, "【军队类 faction】德军、美军")

    def test_detail_entry_shape(self):
        # faction detail:标题 势力·<name>,content = 干净 summary,priority 78
        self.assertIn("势力·德军", self.by_title)
        content, priority = self.by_title["势力·德军"]
        self.assertEqual(priority, 78)
        self.assertEqual(content, "德意志国防军,二战主要军事力量。")
        self.assertIn("势力·美军", self.by_title)
        self.assertEqual(self.by_title["势力·美军"][1], 78)

    def test_concept_detail_present(self):
        self.assertIn("概念·以太体系", self.by_title)
        content, priority = self.by_title["概念·以太体系"]
        self.assertEqual(priority, 70)
        self.assertEqual(content, "以太是本作驱动超凡能力的基础能量。")


if __name__ == "__main__":
    unittest.main()
