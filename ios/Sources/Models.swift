import Foundation

// 后端 DTO(只取客户端需要的字段;后端多余字段忽略)。

struct APIUser: Codable, Identifiable {
    let id: Int
    let username: String?
    let displayName: String?
    let role: String?
    var avatarURL: String?

    enum CodingKeys: String, CodingKey {
        case id, username, role
        case displayName = "display_name"
        case avatarURL = "avatar_url"
    }
}

struct LoginResponse: Codable {
    let ok: Bool
    let user: APIUser?
    let error: String?
}

struct MeResponse: Codable {
    let ok: Bool?
    let user: APIUser?
}

// 酒馆对话列表项 —— GET /api/tavern/chats → {chats:[...]}
struct TavernChat: Codable, Identifiable, Hashable {
    let id: Int
    let title: String?
    let characterName: String?
    let lastSnippet: String?
    let updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case id, title
        case characterName = "character_name"
        case lastSnippet = "last_snippet"
        case updatedAt = "updated_at"
    }

    var displayTitle: String {
        if let t = title, !t.isEmpty { return t }
        if let c = characterName, !c.isEmpty { return c }
        return "对话 #\(id)"
    }
}

struct TavernListResponse: Codable {
    let chats: [TavernChat]?
}

// 创建对话 → {save:{id,...}}
struct TavernCreateResponse: Codable {
    let ok: Bool?
    let save: TavernSaveRef?
    // [round-4-P2] 去死字段:该端点后端只返回 {save:{id}},无顶层 save_id。
    var newId: Int? { save?.id }
}
struct TavernSaveRef: Codable { let id: Int? }

// 聊天气泡(本地 UI 模型)
struct ChatMessage: Identifiable, Equatable {
    enum Role: String { case user, assistant }
    let id = UUID()
    var role: Role
    var content: String
    var streaming: Bool = false
    var imageURL: String? = nil        // 服务端生成图(相对/绝对路径)
    var attachThumbs: [String]? = nil  // 本地附件缩略(data URL)
    var generating: Bool = false       // 生图占位中
    var serverIndex: Int? = nil        // 该消息在服务端 history 的原始下标(回滚/分叉用,本地数组会跳空回合)
}

// /api/state → 顶层含 history / tavern / player / permissions
struct GameState: Codable {
    let history: [HistoryEntry]?
    let tavern: TavernState?
    let player: PlayerState?
    let permissions: PermissionsState?
    let data: InnerState?

    struct InnerState: Codable {
        let history: [HistoryEntry]?
        let tavern: TavernState?
        let player: PlayerState?
        let permissions: PermissionsState?
    }
    var resolvedHistory: [HistoryEntry] { history ?? data?.history ?? [] }
    var resolvedTavern: TavernState? { tavern ?? data?.tavern }
    var resolvedPlayer: PlayerState? { player ?? data?.player }
    var resolvedPermission: String { (permissions ?? data?.permissions)?.mode ?? "full_access" }
}

struct HistoryEntry: Codable {
    let role: String?
    let content: String?
}

struct PermissionsState: Codable { let mode: String? }

struct TavernState: Codable {
    let immersive: Bool?
    let character: TavernCharacter?
    let system_prompt: String?
}

// 角色卡(只取展示字段;sample_dialogue 形态不定,略)
struct TavernCharacter: Codable {
    var id: Int? = nil
    let name: String?
    let identity: String?
    let role: String?
    let personality: String?
    let appearance: String?
    let speech_style: String?
    let background: String?
    let current_status: String?
    let tags: [String]?
    var avatar_path: String? = nil
    var avatar_url: String? = nil
    var avatar: String? { (avatar_path?.isEmpty == false ? avatar_path : nil) ?? (avatar_url?.isEmpty == false ? avatar_url : nil) }

    var fields: [(String, String)] {
        var out: [(String, String)] = []
        func add(_ label: String, _ v: String?) { if let v, !v.isEmpty { out.append((label, v)) } }
        add("身份", identity ?? role)
        add("性格", personality)
        add("外貌", appearance)
        add("说话风格", speech_style)
        add("背景", background)
        add("当前状态", current_status)
        return out
    }
}

struct PlayerState: Codable {
    var id: Int? = nil
    let name: String?
    let role: String?
    let background: String?
    var avatar_path: String? = nil
    var avatar_url: String? = nil
    var avatar: String? { (avatar_path?.isEmpty == false ? avatar_path : nil) ?? (avatar_url?.isEmpty == false ? avatar_url : nil) }
    var fields: [(String, String)] {
        var out: [(String, String)] = []
        func add(_ label: String, _ v: String?) { if let v, !v.isEmpty { out.append((label, v)) } }
        add("定位", role)
        add("背景", background)
        return out
    }
}

// SSE 事件
enum ChatEvent {
    case stage(String)
    case token(String)
    case usage(Double)   // context_pct
    case done(String?)   // 携带后端已清洗的最终正文(done.status.history 末条 assistant),用于替换流式原始文本
    case error(String)
}

/// 去掉 GM 流式输出末尾泄漏的状态 ops 块(```json [..] ``` 或裸 [ {"op":..} ])。
/// 后端流式只发原始 token(含 ops 块),done 才给清洗后的 history;此函数用于流式过程中的实时清洗兜底,
/// 镜像后端 strip_leaked_scaffold 的可见效果。
func cleanNarrative(_ s: String) -> String {
    var cut = s.endIndex
    for m in ["```json", "```\n[", "[\n  {\"op\"", "[{\"op\"", "[ {\"op\"", "[\n{\"op\""] {
        if let r = s.range(of: m), r.lowerBound < cut { cut = r.lowerBound }
    }
    return String(s[..<cut]).trimmingCharacters(in: .whitespacesAndNewlines)
}

// ── 模型目录(/api/models)──
struct ModelsResponse: Decodable {
    struct Catalog: Decodable { let apis: [ProviderAPI]? }
    let models: Catalog?
    let apis: [ProviderAPI]?
    let selected: SelectedModel?
    var providers: [ProviderAPI] { models?.apis ?? apis ?? [] }
}

struct ProviderAPI: Decodable, Identifiable {
    let apiId: String?
    let idField: String?
    let name: String?
    let displayName: String?
    let enabled: Bool?
    let baseUrl: String?
    let keyHint: String?
    let models: [ModelEntry]?
    let entries: [ModelEntry]?
    enum CodingKeys: String, CodingKey {
        case apiId = "api_id", idField = "id", name, enabled, models, entries
        case displayName = "display_name", baseUrl = "base_url", keyHint = "key_hint"
    }
    var id: String { apiId ?? idField ?? "" }
    var title: String { (displayName?.isEmpty == false ? displayName : nil) ?? name ?? id }
    var list: [ModelEntry] { (models ?? entries ?? []).filter { !$0.isEmbeddingOnly } }
    var allModels: [ModelEntry] { models ?? entries ?? [] }
    var visible: Bool { enabled ?? true }
}

// 用户凭据 GET /api/me/credentials → {items:[...]}
struct CredItem: Decodable, Identifiable {
    let api_id: String?
    let enabled: Bool?
    let base_url_override: String?
    let key_hint: String?
    let proxy_url: String?
    let has_key: Bool?
    let has_credential: Bool?
    var id: String { api_id ?? "" }
    var configured: Bool { (has_key ?? has_credential ?? false) || (key_hint?.isEmpty == false) }
    var baseURL: String { base_url_override ?? "" }
    var proxy: String { proxy_url ?? "" }
}
struct CredListResponse: Decodable { let items: [CredItem]? }

// 凭据测试结果
struct CredTestResult { let ok: Bool; let message: String }

struct ModelEntry: Decodable, Identifiable {
    let realName: String?
    let idField: String?
    let modelId: String?
    let label: String?
    let capabilities: [String]?
    let caps: [String]?
    let enabled: Bool?
    let hidden: Bool?
    // [round-4-P1] 后端发的是 display_name(非 label)→ 原来 label 恒 nil,显示总是回退到裸 model id。
    enum CodingKeys: String, CodingKey { case realName = "real_name", idField = "id", modelId = "model_id", label = "display_name", capabilities, caps, enabled, hidden }
    var id: String { realName ?? modelId ?? idField ?? "" }
    var display: String { (label?.isEmpty == false ? label : nil) ?? id }
    var isEmbeddingOnly: Bool { let c = capabilities ?? caps ?? []; return c.count == 1 && c.first == "embedding" }
    var visible: Bool { (enabled ?? true) && !(hidden ?? false) }
}

struct SelectedModel: Decodable {
    let apiId: String?
    let realName: String?
    let modelId: String?
    let label: String?
    enum CodingKeys: String, CodingKey { case apiId = "api_id", realName = "real_name", modelId = "model_id", label = "display_name" }
    var modelName: String { realName ?? modelId ?? "" }
    var display: String { (label?.isEmpty == false ? label : nil) ?? modelName }
}

// 人格 skill(/api/me/persona-skills):导入的 markdown 角色档蒸馏成的卡的登记项。
struct PersonaSkillItem: Codable, Identifiable {
    let id: Int
    let name: String?
    let source: String?
    let source_ref: String?
    let card_id: Int?
    var avatar_path: String?
    var display: String { (name?.isEmpty == false ? name : nil) ?? "人格 skill" }
    var sourceLabel: String { (source ?? "") == "github" ? "GitHub" : "上传" }
}
struct PersonaSkillsResponse: Codable { let items: [PersonaSkillItem]?; var list: [PersonaSkillItem] { items ?? [] } }

// 角色卡库项(/api/me/character-cards)
struct CharacterCardItem: Codable, Identifiable {
    let id: Int
    let name: String?
    let identity: String?
    let personality: String?
    let avatar_url: String?
    var avatar_path: String?   // 后端 DTO 实际字段(列表/详情都用 avatar_path)
    let card_type: String?
    /// 统一头像地址:优先 avatar_path,回退旧 avatar_url。
    var avatar: String? { (avatar_path?.isEmpty == false ? avatar_path : nil) ?? (avatar_url?.isEmpty == false ? avatar_url : nil) }
    // 扩展字段(列表/详情都可能带;编辑表单用)
    var full_name: String?
    var background: String?
    var appearance: String?
    var speech_style: String?
    var current_status: String?
    var secrets: String?
    var aliases: [String]?
    var tags: [String]?
    var token_budget: Int?
    var importance: Int?
    var enabled: Bool?
    var is_public: Bool?
    var pinned: Bool?
    var uses: Int?
    var updated_at: String?
    // 剧本编辑器额外字段
    var first_revealed_chapter: Int?
    var priority: Int?
    var display: String { (name?.isEmpty == false ? name : nil) ?? "角色 #\(id)" }
    var subtitle: String { (identity?.isEmpty == false ? identity : nil) ?? (personality ?? "角色卡") }
}

// 人设图(完整角色立绘;与卡片「头像」缩略是两套接口/两套 URL)。
struct PersonaImage: Codable, Identifiable {
    let id: Int
    let image_url: String?
    var is_current: Bool?
    var source: String?
    var created_at: String?
}

// 剧本世界书条目(只读浏览,对齐 web /md-editor)。
struct WorldbookEntryItem: Codable, Identifiable {
    let id: Int
    let title: String?
    let content: String?
    var keys: [String]?
    var priority: Int?
    var enabled: Bool?
    var display: String { (title?.isEmpty == false ? title : nil) ?? "条目 #\(id)" }
}

// 剧本正史实体(只读浏览)。
struct CanonEntityItem: Codable, Identifiable {
    let id: Int
    let name: String?
    var full_name: String?
    var type: String?
    var summary: String?
    var identity: String?
    var background: String?
    var importance: Int?
    var first_revealed_chapter: Int?
    var display: String { (name?.isEmpty == false ? name : nil) ?? "实体 #\(id)" }
    var subtitle: String { (type?.isEmpty == false ? type : nil) ?? (identity ?? "实体") }
}

// 新游戏出生点(时间线锚点)
struct Birthpoint: Identifiable {
    let anchorId: String
    let label: String       // story_time_label
    let phase: String       // phase_label
    let chapterMin: Int?
    let chapterMax: Int?
    let summary: String?
    var id: String { anchorId }
    var sub: String {
        var p: [String] = []
        if !phase.isEmpty { p.append(phase) }
        if let c = chapterMin { p.append("第\(c)章") }
        return p.joined(separator: " · ")
    }
}

// 选择器用的精简视图模型(real + demo 共用)
struct PickerModel: Identifiable, Hashable { let id: String; let display: String; let apiId: String }
struct PickerProvider: Identifiable, Hashable { let id: String; let title: String; let models: [PickerModel] }

extension ModelsResponse {
    var pickerProviders: [PickerProvider] {
        providers.filter { $0.visible }.compactMap { p in
            let ms = p.list.map { PickerModel(id: $0.id, display: $0.display, apiId: p.id) }
            return ms.isEmpty ? nil : PickerProvider(id: p.id, title: p.title, models: ms)
        }
    }
}
