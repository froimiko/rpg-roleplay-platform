import SwiftUI

struct TavernDrawer: View {
    let charName: String?
    let character: TavernCharacter?
    let persona: PlayerState?
    @Binding var immersive: Bool
    let onToggleImmersive: (Bool) -> Void
    let initialSystemPrompt: String
    let onSaveSystemPrompt: (String) -> Void
    let canEdit: Bool          // demo 模式禁用保存
    var serverBase: String = ""               // 用于 ServerImageView 加载头像/人设图
    var onBindCard: ((String, Int) -> Void)? = nil   // (role, cardId) 绑定/更换角色卡

    @Environment(\.dismiss) private var dismiss
    @State private var tab = 0
    @State private var sp = ""
    @State private var spEditing = false
    @State private var pickRole: PickRole?

    struct PickRole: Identifiable { let id = UUID(); let role: String }

    var body: some View {
        NavigationStack {
            ZStack {
                WarmBackground()
                VStack(spacing: 0) {
                    immersiveRow
                    Picker("", selection: $tab) {
                        Text(loc: "角色卡").tag(0); Text(loc: "我的角色").tag(1); Text(loc: "系统提示").tag(2)
                    }
                    .pickerStyle(.segmented).padding(.horizontal, 16).padding(.bottom, 8)
                    ScrollView {
                        Group {
                            if tab == 0 { characterTab }
                            else if tab == 1 { personaTab }
                            else { systemTab }
                        }.padding(16)
                    }
                }
            }
            .navigationTitle("详情").navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Theme.bg, for: .navigationBar).toolbarBackground(.visible, for: .navigationBar)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("完成") { dismiss() }.foregroundStyle(Theme.accent) } }
            .onAppear { sp = initialSystemPrompt }
            .sheet(item: $pickRole) { pr in CardPickerSheet(role: pr.role, serverBase: serverBase) { cid in
                pickRole = nil
                onBindCard?(pr.role, cid)
            } }
        }
    }

    @ViewBuilder private func heroImage(_ path: String?) -> some View {
        if let path, !path.isEmpty, !serverBase.isEmpty {
            ServerImageView(base: serverBase, path: path)
                .frame(maxWidth: .infinity).frame(maxHeight: 300)
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.line, lineWidth: 1))
        }
    }
    @ViewBuilder private func chooseCardButton(_ role: String, _ title: String) -> some View {
        if onBindCard != nil {
            Button { pickRole = PickRole(role: role) } label: {
                HStack(spacing: 6) {
                    Image(systemName: "rectangle.stack").font(.system(size: 12))
                    Text(loc: title).font(Theme.ui(13, .medium))
                }.foregroundStyle(Theme.accent).frame(maxWidth: .infinity).padding(.vertical, 9)
                .background(Theme.accentSoft, in: RoundedRectangle(cornerRadius: 10))
            }
        }
    }

    private var immersiveRow: some View {
        HStack(spacing: 12) {
            Image(systemName: "sun.max").font(.system(size: 16)).foregroundStyle(Theme.accent)
                .frame(width: 36, height: 36).background(Theme.panel2, in: RoundedRectangle(cornerRadius: 10))
            VStack(alignment: .leading, spacing: 2) {
                Text("沉浸式拟人模式").font(Theme.ui(14.5, .medium)).foregroundStyle(Theme.text)
                Text("像真人一样实时对话,不替你叙述").font(Theme.ui(11.5)).foregroundStyle(Theme.muted)
            }
            Spacer()
            Toggle("", isOn: Binding(get: { immersive }, set: { onToggleImmersive($0) })).labelsHidden().tint(Theme.accent)
        }
        .padding(.horizontal, 16).padding(.vertical, 12)
        .overlay(alignment: .bottom) { Rectangle().fill(Theme.lineSoft).frame(height: 1) }
    }

    @ViewBuilder private var characterTab: some View {
        VStack(alignment: .leading, spacing: 16) {
            chooseCardButton("character", "选择 / 更换角色卡")
            if let c = character, (c.name?.isEmpty == false) || !c.fields.isEmpty {
                heroImage(c.avatar)
                if let n = c.name, !n.isEmpty {
                    Text(n).font(Theme.serif(22, .medium)).foregroundStyle(Theme.text)
                }
                if let tags = c.tags, !tags.isEmpty {
                    HStack { ForEach(tags, id: \.self) { tagPill($0) } }
                }
                ForEach(c.fields, id: \.0) { f in fieldBlock(f.0, f.1) }
            } else { emptyTab("还没设定 AI 角色,直接开聊即可即兴扮演。") }
        }.frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder private var personaTab: some View {
        VStack(alignment: .leading, spacing: 16) {
            chooseCardButton("persona", "从角色卡库选择我的角色")
            if let p = persona, (p.name?.isEmpty == false) || !p.fields.isEmpty {
                heroImage(p.avatar)
                if let n = p.name, !n.isEmpty { Text(n).font(Theme.serif(22, .medium)).foregroundStyle(Theme.text) }
                ForEach(p.fields, id: \.0) { f in fieldBlock(f.0, f.1) }
            } else { emptyTab("还没设定你的角色。点上方按钮从角色卡库选择。") }
        }.frame(maxWidth: .infinity, alignment: .leading)
    }

    private var systemTab: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("系统提示词").font(Theme.ui(13, .medium)).foregroundStyle(Theme.muted)
                Spacer()
                if canEdit && !spEditing {
                    Button("编辑") { spEditing = true }.font(Theme.ui(13)).foregroundStyle(Theme.accent)
                }
            }
            if spEditing {
                TextEditor(text: $sp).font(Theme.ui(14)).foregroundStyle(Theme.text).scrollContentBackground(.hidden)
                    .frame(minHeight: 200).padding(10)
                    .background(Theme.panel, in: RoundedRectangle(cornerRadius: 12))
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.line, lineWidth: 1))
                HStack {
                    Button("取消") { sp = initialSystemPrompt; spEditing = false }.foregroundStyle(Theme.textQuiet)
                    Spacer()
                    Button("保存") { onSaveSystemPrompt(sp); spEditing = false }
                        .font(Theme.ui(14, .medium)).foregroundStyle(Theme.onAccent)
                        .padding(.horizontal, 16).padding(.vertical, 8).background(Theme.accent, in: Capsule())
                }
            } else {
                Text(loc: sp.isEmpty ? "(无)" : sp).font(Theme.serif(14.5)).foregroundStyle(sp.isEmpty ? Theme.muted2 : Theme.textQuiet)
                    .lineSpacing(5).frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    private func fieldBlock(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(loc: label).font(Theme.ui(11.5, .medium)).tracking(0.5).foregroundStyle(Theme.accent.opacity(0.85))
            Text(value).font(Theme.serif(15)).foregroundStyle(Theme.textQuiet).lineSpacing(4)
        }.frame(maxWidth: .infinity, alignment: .leading)
    }
    private func tagPill(_ t: String) -> some View {
        Text(loc: t).font(Theme.ui(11)).foregroundStyle(Theme.muted)
            .padding(.horizontal, 8).padding(.vertical, 3).background(Theme.panel3, in: Capsule())
    }
    private func emptyTab(_ s: String) -> some View {
        VStack(spacing: 8) { Image(systemName: "person.crop.circle.dashed").font(.system(size: 34)).foregroundStyle(Theme.muted2)
            Text(s).font(Theme.ui(13)).foregroundStyle(Theme.muted).multilineTextAlignment(.center) }
            .frame(maxWidth: .infinity).padding(.top, 50)
    }
}

// 从统一角色卡库选卡(酒馆「选择 / 更换角色卡 / 我的角色」)。
struct CardPickerSheet: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.dismiss) private var dismiss
    let role: String
    let serverBase: String
    let onPick: (Int) -> Void
    @State private var cards: [CharacterCardItem] = []
    @State private var loading = true

    var body: some View {
        NavigationStack {
            ZStack {
                WarmBackground()
                ScrollView {
                    if loading {
                        ProgressView().tint(Theme.accent).frame(maxWidth: .infinity).padding(.top, 50)
                    } else if cards.isEmpty {
                        VStack(spacing: 8) {
                            Image(systemName: "rectangle.stack.badge.xmark").font(.system(size: 32)).foregroundStyle(Theme.muted2)
                            Text("还没有角色卡,先在「角色」里创建或导入。").font(Theme.ui(13)).foregroundStyle(Theme.muted).multilineTextAlignment(.center)
                        }.frame(maxWidth: .infinity).padding(.top, 60).padding(.horizontal, 30)
                    } else {
                        LazyVStack(spacing: 8) {
                            ForEach(cards) { c in
                                Button { onPick(c.id) } label: { cardRow(c) }.buttonStyle(.plain)
                            }
                        }.padding(16)
                    }
                }
            }
            .navigationTitle(role == "character" ? "选择角色卡" : "选择我的角色")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Theme.bg, for: .navigationBar).toolbarBackground(.visible, for: .navigationBar)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("取消") { dismiss() }.foregroundStyle(Theme.textQuiet) } }
            .task { await load() }
        }
    }
    private func cardRow(_ c: CharacterCardItem) -> some View {
        HStack(spacing: 12) {
            if let a = c.avatar, !a.isEmpty, !serverBase.isEmpty {
                ServerImageView(base: serverBase, path: a).frame(width: 44, height: 44).clipShape(RoundedRectangle(cornerRadius: 8))
            } else {
                ZStack { RoundedRectangle(cornerRadius: 8).fill(Theme.panel2)
                    Text(String((c.name ?? "?").prefix(1))).font(Theme.serif(18)).foregroundStyle(Theme.accent) }
                    .frame(width: 44, height: 44)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(c.name ?? "未命名").font(Theme.ui(14, .semibold)).foregroundStyle(Theme.text)
                if let id = c.identity, !id.isEmpty { Text(id).font(Theme.ui(12)).foregroundStyle(Theme.muted).lineLimit(1) }
            }
            Spacer()
            Image(systemName: "chevron.right").font(.system(size: 12)).foregroundStyle(Theme.muted2)
        }.padding(10).background(Theme.panel, in: RoundedRectangle(cornerRadius: 12)).contentShape(Rectangle())
    }
    private func load() async {
        loading = true; defer { loading = false }
        if store.demo { cards = []; return }
        cards = (try? await store.api.characterCards(base: store.serverURL)) ?? []
    }
}
