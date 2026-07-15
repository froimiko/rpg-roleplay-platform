import SwiftUI

struct QuickSettingsSheet: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.dismiss) private var dismiss
    @State private var displayName = ""
    @State private var temperature = 0.8
    @State private var maxTokens = 4096.0
    @State private var saving = false

    var body: some View {
        NavigationStack {
            ZStack {
                WarmBackground()
                Form {
                    Section {
                        HStack {
                            Text("昵称").foregroundStyle(Theme.text)
                            Spacer()
                            TextField("昵称", text: $displayName).multilineTextAlignment(.trailing)
                                .foregroundStyle(Theme.text).tint(Theme.accent)
                        }.listRowBackground(Theme.panel)
                    } header: { Text("个人").foregroundStyle(Theme.muted) }

                    Section {
                        VStack(alignment: .leading, spacing: 6) {
                            HStack { Text("Temperature").foregroundStyle(Theme.text); Spacer()
                                Text(String(format: "%.2f", temperature)).foregroundStyle(Theme.muted).monospacedDigit() }
                            Slider(value: $temperature, in: 0...2, step: 0.05).tint(Theme.accent)
                        }.listRowBackground(Theme.panel)
                        VStack(alignment: .leading, spacing: 6) {
                            HStack { Text("最大输出 tokens").foregroundStyle(Theme.text); Spacer()
                                Text("\(Int(maxTokens))").foregroundStyle(Theme.muted).monospacedDigit() }
                            Slider(value: $maxTokens, in: 512...16384, step: 256).tint(Theme.accent)
                        }.listRowBackground(Theme.panel)
                    } header: { Text("模型参数").foregroundStyle(Theme.muted) }
                    footer: { Text("全局生效;单次对话的模型在输入框上方切换。").foregroundStyle(Theme.muted2) }
                }
                .scrollContentBackground(.hidden)
            }
            .navigationTitle("快捷设置").navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Theme.bg, for: .navigationBar).toolbarBackground(.visible, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("取消") { dismiss() }.foregroundStyle(Theme.textQuiet) }
                ToolbarItem(placement: .confirmationAction) {
                    Button(saving ? "保存中…" : "保存") { save() }.foregroundStyle(Theme.accent).disabled(saving)
                }
            }
            .task { await load() }
        }
    }

    private func load() async {
        displayName = store.user?.displayName ?? ""
        if store.demo { return }
        if let p = try? await store.api.profile(base: store.serverURL) {
            if let n = p.displayName { displayName = n }
            if let t = p.prefs["temperature"] as? Double { temperature = t }
            else if let t = p.prefs["temperature"] as? NSNumber { temperature = t.doubleValue }
            if let m = p.prefs["max_tokens"] as? Double { maxTokens = m }
            else if let m = p.prefs["max_tokens"] as? NSNumber { maxTokens = m.doubleValue }
        }
    }

    private func save() {
        saving = true
        Task {
            defer { saving = false; dismiss() }
            if store.demo { return }
            let name = displayName.trimmingCharacters(in: .whitespaces)
            if !name.isEmpty, name != store.user?.displayName {
                try? await store.api.saveDisplayName(base: store.serverURL, name: name)
            }
            try? await store.api.setPreferences(base: store.serverURL,
                ["temperature": (temperature * 100).rounded() / 100, "max_tokens": Int(maxTokens)])
        }
    }
}
