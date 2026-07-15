import Foundation

// 演示/游客模式的本地 mock 数据(不联网)。供未登录体验设计 + App Store 审核。
enum DemoData {
    static let chats: [TavernChat] = [
        TavernChat(id: 1, title: "莉莉", characterName: "莉莉",
                   lastSnippet: "她把匕首插回鞘里,抬眼打量你。", updatedAt: nil),
        TavernChat(id: 2, title: "罗萨莉", characterName: "罗萨莉",
                   lastSnippet: "她横剑在膝,拇指摩挲过剑刃的浅痕。", updatedAt: nil),
        TavernChat(id: 3, title: "新对话", characterName: nil,
                   lastSnippet: "还没设定要扮演谁,直接开聊。", updatedAt: nil),
    ]

    static func session(_ id: Int) -> (name: String?, scene: String?, msgs: [ChatMessage]) {
        switch id {
        case 1:
            return ("莉莉", "旧城 · 黄昏", [
                ChatMessage(role: .assistant, content: "风裹着沙尘掠过坍塌的立交桥。她蹲在便利店残骸的阴影里,听见你的脚步,匕首尖停在锈罐头边缘。\n\n「……旅人?」声音沙哑,说不上友好,也不算敌意。"),
                ChatMessage(role: .user, content: "我把水壶递过去,问她叫什么名字。"),
                ChatMessage(role: .assistant, content: "她盯着水壶看了两秒,没急着接。指节在罐头边敲了敲,才慢慢伸手。\n\n抿了一小口,喉结动了动。\n\n「莉莉。」她把壶还你,「废土上名字不值钱——你呢?」"),
            ])
        case 2:
            return ("罗萨莉", "官道 · 正午", [
                ChatMessage(role: .assistant, content: "罗萨莉靠着老榆树擦剑。听见你的话,手上一顿,嘴角扯出一个笑。\n\n「跟了多久?」"),
            ])
        default:
            return ("角色", nil, [])
        }
    }

    static func character(_ id: Int) -> TavernCharacter? {
        switch id {
        case 1: return TavernCharacter(name: "莉莉", identity: "废土幸存者", role: nil,
            personality: "警惕、嘴硬,但内心善良", appearance: "深棕色头发扎成一束,浅灰色眼睛,脸上沾着灰土",
            speech_style: "简短、带防备,偶尔讽刺", background: "灾变后独自在旧城讨生活,住在废弃地铁维修段",
            current_status: "在便利店残骸前撬罐头", tags: ["废土", "幸存者"])
        case 2: return TavernCharacter(name: "罗萨莉", identity: "流浪剑客", role: nil,
            personality: "洒脱、护短", appearance: "一身风尘,横剑在膝", speech_style: "爽利带笑",
            background: "四处游历的剑客", current_status: "靠树擦剑", tags: ["剑客"])
        default: return nil
        }
    }
    static let persona = PlayerState(name: "旅人卡尔", role: "流浪旅人", background: "穿越各废土聚落、收集旧世界故事的人")
    static let systemPrompt = "你扮演废土幸存者『莉莉』。严格保持人设:警惕但善良,说话简短带防备。绝不跳出角色。"

    static let providers: [PickerProvider] = [
        PickerProvider(id: "anthropic", title: "Anthropic", models: [
            PickerModel(id: "claude-opus-4-8", display: "Claude Opus 4.8", apiId: "anthropic"),
            PickerModel(id: "claude-sonnet-4-6", display: "Claude Sonnet 4.6", apiId: "anthropic"),
            PickerModel(id: "claude-haiku-4-5", display: "Claude Haiku 4.5", apiId: "anthropic"),
        ]),
        PickerProvider(id: "vertex_ai", title: "Google Vertex", models: [
            PickerModel(id: "gemini-3.1-pro-preview", display: "Gemini 3.1 Pro", apiId: "vertex_ai"),
            PickerModel(id: "gemini-3.5-flash", display: "Gemini 3.5 Flash", apiId: "vertex_ai"),
        ]),
        PickerProvider(id: "deepseek", title: "DeepSeek", models: [
            PickerModel(id: "deepseek-chat", display: "DeepSeek Chat", apiId: "deepseek"),
            PickerModel(id: "deepseek-reasoner", display: "DeepSeek Reasoner", apiId: "deepseek"),
        ]),
    ]
    static let selectedModelId = "claude-sonnet-4-6"
    static let selectedModelDisplay = "Claude Sonnet 4.6"

    static let reply = "她沿着你指的方向望过去,眯起眼。\n\n「往西北两公里,塌了一半的加油站,后院有口还能压出水的井。」她顿了顿,把碎发别到耳后,「不过那一带……不太平。要去,得趁天没黑。」\n\n她重新看向你:「你,跟我一起?」"

    static func stream(_ playerText: String) -> AsyncThrowingStream<ChatEvent, Error> {
        AsyncThrowingStream { c in
            Task {
                try? await Task.sleep(nanoseconds: 650_000_000)
                c.yield(.stage("正在落笔…"))
                var i = reply.startIndex
                while i < reply.endIndex {
                    let j = reply.index(i, offsetBy: 2, limitedBy: reply.endIndex) ?? reply.endIndex
                    c.yield(.token(String(reply[i..<j])))
                    i = j
                    try? await Task.sleep(nanoseconds: 16_000_000)
                }
                c.yield(.done(nil))
                c.finish()
            }
        }
    }

    // ── 剧情游戏平台 演示数据 ──

    static let scripts: [ScriptItem] = [
        ScriptItem(id: 101, title: "我蕾穆丽娜不爱你", chapter_count: 612, word_count: 4_850_000, is_public: true, is_subscribed: false, cover_image_url: "https://picsum.photos/seed/lemu/400/560"),
        ScriptItem(id: 102, title: "废土黄昏", chapter_count: 88, word_count: 720_000, is_public: false, is_subscribed: false, cover_image_url: "https://picsum.photos/seed/wasteland/400/560"),
        ScriptItem(id: 103, title: "变成美少女", chapter_count: 42, word_count: 310_000, is_public: false, is_subscribed: true),
    ]

    static let saves: [SaveItem] = [
        SaveItem(id: 9001, title: "ctx-e2e", script_id: 102, script_title: "废土黄昏",
                 current: true, branch_count: 2, last_played_at: "2026-06-21", ts: nil,
                 save_kind: "game", turn: 37,
                 raw: SaveRaw(player_name: "无名者", turn: 37, world_time: "昏黄的白昼",
                              snippet: "右侧那片半塌的建筑物阴影里,传来极轻的碎石摩擦声。", last_message: nil, script_title: "废土黄昏")),
        SaveItem(id: 9002, title: "美少女线·序", script_id: 103, script_title: "变成美少女",
                 current: false, branch_count: 0, last_played_at: "2026-06-19", ts: nil,
                 save_kind: "game", turn: 6,
                 raw: SaveRaw(player_name: "你", turn: 6, world_time: "清晨", snippet: "镜子里的脸还很陌生。", last_message: nil, script_title: "变成美少女")),
        SaveItem(id: 9003, title: "蕾穆丽娜·第一卷", script_id: 101, script_title: "我蕾穆丽娜不爱你",
                 current: false, branch_count: 5, last_played_at: "2026-06-15", ts: nil,
                 save_kind: "game", turn: 124,
                 raw: SaveRaw(player_name: "旅人", turn: 124, world_time: "雨夜", snippet: "她没有回头。", last_message: nil, script_title: "我蕾穆丽娜不爱你")),
    ]

    // ── 剧本编辑器 演示数据(角色卡 / 世界书 / 正史)──
    static let scriptCards: [CharacterCardItem] = [
        CharacterCardItem(id: 7001, name: "蕾穆丽娜", identity: "圣女 · 女主角", personality: "外冷内热,骄傲而克制", avatar_url: "https://picsum.photos/seed/lemu_av/200/200", card_type: "npc",
                          full_name: "蕾穆丽娜·维斯佩尔", background: "教廷最年轻的圣女,自幼被预言绑定。表面顺从教义,内心对命运抱有隐秘的反叛。",
                          appearance: "银发垂至腰际,左眼下有一颗泪痣;常着素白祭服。", speech_style: "用词简练,极少用语气词,情绪压在句末。",
                          current_status: "刚结束一场失败的净化仪式,正独自留在钟楼。", secrets: "她其实能听见'不该存在的声音'。",
                          aliases: ["小蕾", "圣女大人"], tags: ["教廷", "女主角", "圣女"], token_budget: 600, importance: 100, enabled: true,
                          is_public: nil, pinned: nil, uses: 42, updated_at: nil, first_revealed_chapter: 1, priority: 100),
        CharacterCardItem(id: 7002, name: "卡尔", identity: "异端审判官", personality: "冷峻、务实,信奉结果", avatar_url: "https://picsum.photos/seed/karl_av/200/200", card_type: "npc",
                          full_name: "卡尔·冯·埃伦", background: "审判庭的中坚,手上沾过太多血,却始终怀疑教义本身。",
                          appearance: "高个,左臂有一道贯穿的旧疤。", speech_style: "命令式,句子短。",
                          current_status: "奉命追查钟楼异响。", secrets: "曾私自放走过一名'异端'。",
                          aliases: ["审判官"], tags: ["审判庭", "反派?"], token_budget: 450, importance: 70, enabled: true,
                          is_public: nil, pinned: nil, uses: 18, updated_at: nil, first_revealed_chapter: 3, priority: 70),
        CharacterCardItem(id: 7003, name: "薇", identity: "见习修女", personality: "怯懦但善良", avatar_url: nil, card_type: "npc",
                          full_name: nil, background: "蕾穆丽娜唯一的朋友。", appearance: "矮小,总抱着一本旧经书。",
                          speech_style: "结巴,爱用'那个…'开头。", current_status: "在膳房帮工。", secrets: nil,
                          aliases: [], tags: ["教廷"], token_budget: 300, importance: 35, enabled: false,
                          is_public: nil, pinned: nil, uses: 4, updated_at: nil, first_revealed_chapter: 5, priority: 35),
    ]
    static let scriptWorldbook: [WorldbookEntryItem] = [
        WorldbookEntryItem(id: 8001, title: "教廷 · 净化仪式", content: "每逢满月,圣女须在钟楼主持净化仪式,以歌声压制地脉中的'低语'。仪式失败会引来审判庭问责。", keys: ["净化", "仪式", "钟楼", "满月"], priority: 90, enabled: true),
        WorldbookEntryItem(id: 8002, title: "地脉低语", content: "一种只有极少数人能听见的声音,来源不明。教义称其为'异端的诱惑',实则与远古封印有关。", keys: ["低语", "地脉", "封印"], priority: 80, enabled: true),
        WorldbookEntryItem(id: 8003, title: "审判庭", content: "教廷的武装执法机构,负责清除异端。近年权力膨胀,与圣女体系暗中角力。", keys: ["审判庭", "异端"], priority: 60, enabled: false),
    ]
    static let scriptCanon: [CanonEntityItem] = [
        CanonEntityItem(id: 9101, name: "蕾穆丽娜", full_name: "蕾穆丽娜·维斯佩尔", type: "人物", summary: "教廷最年轻的圣女,故事的核心人物。", identity: "圣女", background: "自幼被预言选中。", importance: 100, first_revealed_chapter: 1),
        CanonEntityItem(id: 9102, name: "圣维斯佩尔教廷", full_name: nil, type: "组织", summary: "统治大陆信仰的宗教机构,分圣女体系与审判庭两脉。", identity: nil, background: nil, importance: 85, first_revealed_chapter: 1),
        CanonEntityItem(id: 9103, name: "钟楼", full_name: nil, type: "地点", summary: "举行净化仪式的高塔,也是蕾穆丽娜独处之所。", identity: nil, background: nil, importance: 50, first_revealed_chapter: 1),
    ]

    // 人设图(完整立绘)演示
    static let personaImages: [PersonaImage] = [
        PersonaImage(id: 1, image_url: "https://picsum.photos/seed/persona_a/600/900", is_current: true, source: "ai", created_at: nil),
        PersonaImage(id: 2, image_url: "https://picsum.photos/seed/persona_b/600/900", is_current: false, source: "upload", created_at: nil),
        PersonaImage(id: 3, image_url: "https://picsum.photos/seed/persona_c/600/900", is_current: false, source: "ai", created_at: nil),
    ]

    // 用量演示(对齐 /api/me/usage 结构)
    static let usage: [String: Any] = [
        "totals": ["input_tokens": 1_842_000, "output_tokens": 286_500, "cached_input_tokens": 920_000, "total_tokens": 2_128_500, "cost_usd": 6.84],
        "by_model": [
            ["api_id": "anthropic", "model": "claude-sonnet-4-6", "input_tokens": 1_510_000, "output_tokens": 220_000, "cost_usd": 5.21, "turns": 142],
            ["api_id": "vertex", "model": "gemini-3.1-pro", "input_tokens": 332_000, "output_tokens": 66_500, "cost_usd": 1.63, "turns": 38],
        ],
        "recent_turns": [
            ["at": "2026-06-23 12:01:33", "model": "claude-sonnet-4-6", "input_tokens": 12_400, "output_tokens": 820, "cost_usd": 0.0461, "context_used": 12_400, "context_max": 200_000, "scenario": "game"],
            ["at": "2026-06-23 11:58:10", "model": "claude-sonnet-4-6", "input_tokens": 11_900, "output_tokens": 640, "cost_usd": 0.0402, "context_used": 11_900, "context_max": 200_000, "scenario": "game"],
            ["at": "2026-06-23 11:40:02", "model": "gemini-3.1-pro", "input_tokens": 8_200, "output_tokens": 1_100, "cost_usd": 0.0288, "context_used": 8_200, "context_max": 1_000_000, "scenario": "tavern"],
        ],
        "recent_total": 180,
        "forecast": ["avg_daily_cost_usd": 0.71, "projected_30d_cost": 21.3, "trend_7d_vs_prev_7d_pct": 12.0],
    ]

    static let stats = MeStats(total_rounds: 318, branches: 7, login_streak: 9,
                               play_minutes_total: 1_460, assets: 24,
                               imported: MeStats.Imported(scripts: 3, words: 5_880_000))

    /// 游戏台运行时快照(模拟 /api/state 顶层 payload)。
    static func gameSnapshot(_ launch: GameLaunch) -> GameSnapshot {
        GameSnapshot([
            "save_id": launch.id,
            "save_title": launch.title,
            "permissions": ["mode": "full_access"],
            "suggestions": ["观察当前场景的可见人物、出口和风险点", "整理当下已知线索", "朝声音的来源靠近"],
            "history": [
                ["role": "assistant", "content": "这具身体很轻。陌生。\n\n视野前方大约二十米处,地面突兀地断裂了——一个直径惊人的巨坑,边缘焦黑,残留着某种高温熔化后又凝固的暗色痕迹,像一道巨大的伤疤刻在大地上。\n\n那里曾经是某座建筑。大概是地铁站的入口。\n\n四周太安静了。没有虫鸣,没有鸟叫,甚至没有风穿过废墟的声音。\n\n然后——\n\n右侧那片半塌的建筑物阴影里,传来极轻的碎石摩擦声。\n\n不是风吹的。有什么东西在那里移动。"],
                ["role": "user", "content": "我屏住呼吸,慢慢蹲低,朝声音的方向看过去。"],
            ],
            "player": [
                "name": "无名者", "role": "失忆的穿越者",
                "current_location": "秋叶广场遗址 · 巨坑边缘",
                "background": "醒来时已在废土,关于过去只剩零碎闪光。",
            ],
            "world": [
                "time": "昏黄的白昼", "weather": "阴霾,昏黄的日光透过雾霾",
                "known_events": ["大灾变摧毁了旧世界", "幸存者聚集在地下避难所", "地表出现变异生物"],
            ],
            "memory": [
                "current_objective": "查明碎石声的来源,并找到安全的落脚点。",
                "facts": ["你失去了大部分记忆", "这具身体不属于原来的你", "废土上物资极度稀缺"],
            ],
            "active_entities": [
                ["name": "阴影中的存在", "role": "未知 · 警戒"],
            ],
            "app": ["model": selectedModelDisplay, "context_window": 16384, "script_title": launch.scriptTitle ?? ""],
        ])
    }

    static let gameReply = "你的动作很慢,几乎没有发出声音。\n\n阴影里的轮廓顿住了。那是一个佝偻的身形,裹在层层叠叠的破布里,看不清面容——只有一双反射着微光的眼睛,正一动不动地盯着你的方向。\n\n它没有立刻扑过来,也没有逃。\n\n沙哑的、几乎不像人声的音节从布团深处挤出来:\n\n「……活的?」"

    static func gameStream(_ playerText: String) -> AsyncThrowingStream<ChatEvent, Error> {
        AsyncThrowingStream { c in
            Task {
                try? await Task.sleep(nanoseconds: 500_000_000)
                c.yield(.stage("整理上下文…"))
                try? await Task.sleep(nanoseconds: 500_000_000)
                c.yield(.stage("GM 落笔…"))
                var i = gameReply.startIndex
                while i < gameReply.endIndex {
                    let j = gameReply.index(i, offsetBy: 2, limitedBy: gameReply.endIndex) ?? gameReply.endIndex
                    c.yield(.token(String(gameReply[i..<j])))
                    i = j
                    try? await Task.sleep(nanoseconds: 16_000_000)
                }
                c.yield(.usage(34))
                c.yield(.done(nil))
                c.finish()
            }
        }
    }
}
