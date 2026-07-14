# docs/knowledge/ — 知识目录维护规约

给 AI 协作者的仓库导航体系。目标:任何新 session 打开仓库就能快速掌握全局,加功能前查得到「什么已存在、住在哪」,不重复造轮子。

## 文件构成

| 文件 | 作用 | 谁读 |
|---|---|---|
| `/CLAUDE.md`(仓库根) | 顶层定位 + **权威单一真相源清单** + 模块速览 + 工程铁律。≤150 行,每个 session 自动加载 | 所有 session,开工前必读 |
| `docs/knowledge/backend-map.md` | 后端 `rpg/` 逐包职责与关键入口,标注热路径/别碰清单 | 改后端前查 |
| `docs/knowledge/frontend-map.md` | 前端 `frontend/src/` 逐目录职责与关键入口 | 改前端前查 |
| `docs/knowledge/README.md`(本文件) | 维护规约 | 改动结构 / 核对时读 |

分工:`CLAUDE.md` 精炼(它进每个 session 的上下文预算,只放最高频必查);两张 map 是深读,细节都放这里。

## 维护规约(硬性)

1. **同一 commit 同步更新**:任何模块搬家、新增子系统、拆包/合包、改动权威真相源的位置,**必须在同一个 commit 里**更新对应的 map + 必要时更新 `CLAUDE.md` 的真相源清单。代码结构与文档漂移视为未完成的改动。
2. **真相源清单是最高优先级**:`CLAUDE.md` 的「权威单一真相源清单」里任一条目的函数/文件被改名、移动或废弃,**立即修正或剔除**——这份清单失效比不存在更危险(会把人导向错误实现)。
3. **别写死行号**:引用用「文件 + 符号名」(如 `perms.py` 的 `owns_save`),不写行号——行号一改就烂。正在拆分的文件(`settings.jsx`/`scripts.jsx` 等)只写「拆分中,以完成后结构为准」并留 TODO,不描述内部细节。
4. **每个重构批次收尾核对**:主代理完成一个重构批次后,核对一次两张 map 与实际结构是否一致(可用 `ls rpg/`、`ls frontend/src/` 对照顶层清单),把新增/消失的模块补上或删掉。
5. **保持操作性**:这是给 AI 协作者看的操作文档,不是营销/设计叙事。每条一到三行说清「是什么 + 关键入口 + 是否热路径/别碰」即可。设计动机与历史演进归 `docs/design/`,不进这里。

## 硬约束(与仓库一致)

本仓库同步公开 OSS。**严禁**在这套文档写入:服务器地址 / SSH / 凭据 / cookie / 生产运维细节 / 用户数据 / 小说正文。运维知识属于内部 runbook,不进知识目录。

## 核对速查

```
# 顶层结构对照(看有没有新增/消失的包)
ls rpg/                    # 对照 backend-map.md 的包清单
ls rpg/platform_app/       # 平台层
ls frontend/src/           # 对照 frontend-map.md
ls frontend/src/components/ frontend/src/pages/

# 真相源清单抽查(符号是否还在)
grep -nE "def (owns_save|script_readable|script_owned)" rpg/platform_app/perms.py
grep -nE "def (safe_urlopen|safe_httpx_client)" rpg/core/outbound.py
grep -n  "def call_agent_json_guarded" rpg/agents/_harness.py
grep -rn "def get_progress_window" rpg/agents/anchor_seed_agent.py
```
