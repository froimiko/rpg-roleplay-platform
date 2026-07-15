import SwiftUI

// 模块模型 —— 对齐 web「设置 → 模块模型」(agent-modules.js MODULES 全表),按功能分组,
// 给每个子模块单独分配模型。两种持久化:
//   · prefix 形:写 `<prefix>.api_id` + `<prefix>.model_real_name`
//   · dict 形(sub_agent/console):写 `<dictKey>` = {api_id, model_real_name}
struct ModuleModelsView: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.dismiss) private var dismiss

    struct Module: Identifiable {
        let id: String; let name: String; let desc: String; let group: String
        var prefix: String? = nil; var dictKey: String? = nil
    }
    // 与 web agent-modules.js 一一对应
    private let modules: [Module] = [
        // 对话核心(三贤者 + GM 管线)
        .init(id: "gm", name: "文宗 · 主叙事", desc: "生成剧情正文的主模型", group: "core", prefix: "gm"),
        .init(id: "sub_agent", name: "司命 · 子代理", desc: "RAG 检索闸 / 子任务调度", group: "core", dictKey: "sub_agent_model_override"),
        .init(id: "recorder", name: "史官 · 状态记录", desc: "把本回合状态变化结构化落库", group: "core", prefix: "recorder"),
        .init(id: "extractor", name: "提取器", desc: "从原文抽取世界书/人物/锚点", group: "core", prefix: "extractor"),
        .init(id: "verifier", name: "锚点校验", desc: "判定锚点是否达成", group: "core", prefix: "acceptance_verifier"),
        .init(id: "set_parser", name: "指令解析", desc: "解析 /set 等结构化指令", group: "core", prefix: "set_parser"),
        // 剧本与角色卡
        .init(id: "editor", name: "剧本编辑助手", desc: "剧本编辑器右栏 AI", group: "script", prefix: "editor"),
        .init(id: "console", name: "游戏台助手", desc: "游戏台内的辅助 AI", group: "script", dictKey: "console_assistant_model_override"),
        .init(id: "card_gen", name: "角色卡生成", desc: "生成/补全角色卡", group: "script", prefix: "character_card_generator"),
        .init(id: "card_import", name: "角色卡导入", desc: "解析导入的角色卡", group: "script", prefix: "card_import"),
        .init(id: "critic", name: "评审", desc: "卡/内容的 AI 复核", group: "script", prefix: "critic"),
        // 世界模拟与历史
        .init(id: "black_swan", name: "黑天鹅事件", desc: "主动触发世界事件", group: "world", prefix: "black_swan_agent"),
        .init(id: "phase_digest", name: "阶段摘要", desc: "长历史阶段性压缩", group: "world", prefix: "phase_digest"),
        // 检索与生成
        .init(id: "embedder", name: "向量检索", desc: "RAG embedding 模型", group: "gen", prefix: "embed"),
        .init(id: "image_gen", name: "生图", desc: "聊天/封面/头像生图", group: "gen", prefix: "image_gen"),
        // 通用兜底
        .init(id: "agent", name: "通用兜底", desc: "其它未单独配置的 AI 任务", group: "misc", prefix: "agent"),
    ]
    private let groupOrder = ["core", "script", "world", "gen", "misc"]
    private let groupName = ["core": "对话核心", "script": "剧本与角色卡", "world": "世界模拟与历史", "gen": "检索与生成", "misc": "通用"]

    @State private var providers: [PickerProvider] = []
    @State private var picks: [String: String] = [:]
    @State private var picking: String?

    // 引擎特性 —— 6 个 per-user 特性开关,默认全开
    private struct EngineFeature: Identifiable {
        let id: String; let name: String; let desc: String
    }
    private let engineFeatures: [EngineFeature] = [
        .init(id: "ctx_tiered",        name: "分层上下文缓存",   desc: "分层稳定前缀,命中前缀缓存,显著省 token。"),
        .init(id: "recorder_unified",  name: "史官三合一",        desc: "状态提取 + 锚点判定合并为一次 LLM 调用。"),
        .init(id: "narrator_slim",     name: "文宗精简",          desc: "主叙事单次成文、不带工具循环,状态交史官。"),
        .init(id: "rag_gate",          name: "RAG 检索闸",        desc: "司命判定本回合是否需检索,不需则跳过省 token。"),
        .init(id: "anchor_pace",       name: "世界线锚点节奏",    desc: "按对话节奏推进锚点、逐个标记 —— 治跳章。"),
        .init(id: "kb_state",          name: "存档知识库 DB 化",  desc: "存档状态以数据库行存储,便于检索维护。"),
    ]
    // key → Bool, defaulting to true when absent
    @State private var featureToggles: [String: Bool] = [:]

    var body: some View {
        NavigationStack {
            ZStack {
                WarmBackground()
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        Text("不设置则继承「默认模型」。各模块独立计费,按需为重模块选强模型、轻模块选便宜模型。")
                            .font(Theme.ui(12)).foregroundStyle(Theme.muted).padding(.horizontal, 2)
                        // 引擎特性分组
                        VStack(alignment: .leading, spacing: 9) {
                            Text(loc: "引擎特性").font(Theme.ui(11, .semibold)).foregroundStyle(Theme.accent).tracking(1.2)
                            VStack(spacing: 8) {
                                ForEach(engineFeatures) { feat in
                                    featureRow(feat)
                                }
                            }
                        }
                        ForEach(groupOrder, id: \.self) { g in
                            let ms = modules.filter { $0.group == g }
                            if !ms.isEmpty {
                                VStack(alignment: .leading, spacing: 9) {
                                    Text(loc: groupName[g] ?? g).font(Theme.ui(11, .semibold)).foregroundStyle(Theme.accent).tracking(1.2)
                                    VStack(spacing: 8) { ForEach(ms) { m in Button { picking = m.id } label: { row(m) }.buttonStyle(.plain) } }
                                }
                            }
                        }
                    }.padding(16)
                }
            }
            .navigationTitle("模块模型").navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Theme.bg, for: .navigationBar).toolbarBackground(.visible, for: .navigationBar)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("完成") { dismiss() }.foregroundStyle(Theme.accent) } }
            .task { await load() }
            .sheet(item: Binding(get: { picking.map { IdStr($0) } }, set: { picking = $0?.id })) { box in
                if let m = modules.first(where: { $0.id == box.id }) {
                    ModelPickerView(providers: providers, currentId: picks[box.id] ?? "") { sel in
                        picks[box.id] = sel.id
                        if !store.demo { Task { try? await store.api.setPreferences(base: store.serverURL, prefsFor(m, sel)) } }
                    }
                }
            }
        }
    }

    private func featureRow(_ feat: EngineFeature) -> some View {
        let key = "\(feat.id).enabled"
        let binding = Binding<Bool>(
            get: { featureToggles[feat.id] ?? true },
            set: { newVal in
                featureToggles[feat.id] = newVal
                guard !store.demo else { return }
                Task { try? await store.api.setPreferences(base: store.serverURL, [key: newVal]) }
            }
        )
        return HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text(loc: feat.name).font(Theme.ui(15, .medium)).foregroundStyle(Theme.text)
                Text(loc: feat.desc).font(Theme.ui(11.5)).foregroundStyle(Theme.muted2)
            }
            Spacer()
            Toggle("", isOn: binding).labelsHidden().tint(Theme.accent)
        }
        .padding(14)
        .background(RoundedRectangle(cornerRadius: 14).fill(Theme.panel))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.line, lineWidth: 1))
    }

    private func prefsFor(_ m: Module, _ sel: PickerModel) -> [String: Any] {
        if let dk = m.dictKey { return [dk: ["api_id": sel.apiId, "model_real_name": sel.id]] }
        let p = m.prefix ?? m.id
        return ["\(p).api_id": sel.apiId, "\(p).model_real_name": sel.id]
    }
    private func row(_ m: Module) -> some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text(loc: m.name).font(Theme.ui(15, .medium)).foregroundStyle(Theme.text)
                Text(loc: m.desc).font(Theme.ui(11.5)).foregroundStyle(Theme.muted2)
            }
            Spacer()
            Text(loc: picks[m.id].map(shortModel) ?? "继承默认").font(Theme.ui(12.5)).foregroundStyle(picks[m.id] == nil ? Theme.muted2 : Theme.accent).lineLimit(1)
            Image(systemName: "chevron.right").font(.system(size: 12, weight: .semibold)).foregroundStyle(Theme.muted2)
        }
        .padding(14)
        .background(RoundedRectangle(cornerRadius: 14).fill(Theme.panel))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.line, lineWidth: 1))
        .contentShape(Rectangle())
    }
    private func shortModel(_ s: String) -> String { s.count > 22 ? String(s.suffix(22)) : s }

    private func load() async {
        if store.demo { providers = DemoData.providers; return }
        if let r = try? await store.api.models(base: store.serverURL) { providers = r.pickerProviders }
        if let p = try? await store.api.profile(base: store.serverURL) {
            for m in modules {
                if let dk = m.dictKey, let d = p.prefs[dk] as? [String: Any], let v = d["model_real_name"] as? String, !v.isEmpty { picks[m.id] = v }
                else if let pref = m.prefix, let v = p.prefs["\(pref).model_real_name"] as? String, !v.isEmpty { picks[m.id] = v }
            }
            // 引擎特性开关初始值,缺省为 true
            for feat in engineFeatures {
                let key = "\(feat.id).enabled"
                if let v = p.prefs[key] as? Bool { featureToggles[feat.id] = v }
                else { featureToggles[feat.id] = true }
            }
        }
    }
}

private struct IdStr: Identifiable { let id: String; init(_ s: String) { id = s } }
