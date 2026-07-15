import SwiftUI

struct ModelPickerView: View {
    let providers: [PickerProvider]
    let currentId: String
    let onPick: (PickerModel) -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ZStack {
                WarmBackground()
                if providers.isEmpty {
                    VStack(spacing: 10) {
                        Image(systemName: "cpu").font(.system(size: 38)).foregroundStyle(Theme.muted2)
                        Text("没有可用模型").font(Theme.serif(17)).foregroundStyle(Theme.textQuiet)
                        Text("请在网页端配置 API 后再来。").font(Theme.ui(13)).foregroundStyle(Theme.muted)
                    }
                } else {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 18) {
                            ForEach(providers) { p in
                                VStack(alignment: .leading, spacing: 8) {
                                    Text(p.title.uppercased()).font(Theme.ui(11, .medium)).tracking(1.4)
                                        .foregroundStyle(Theme.muted2).padding(.leading, 4)
                                    VStack(spacing: 0) {
                                        ForEach(Array(p.models.enumerated()), id: \.element.id) { idx, m in
                                            Button { onPick(m); dismiss() } label: { row(m) }.buttonStyle(.plain)
                                            if idx < p.models.count - 1 {
                                                Rectangle().fill(Theme.lineSoft).frame(height: 1).padding(.leading, 16)
                                            }
                                        }
                                    }
                                    .background(Theme.panel, in: RoundedRectangle(cornerRadius: 14))
                                    .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.line, lineWidth: 1))
                                }
                            }
                        }.padding(16)
                    }
                }
            }
            .navigationTitle("选择模型").navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Theme.bg, for: .navigationBar).toolbarBackground(.visible, for: .navigationBar)
            .toolbar { ToolbarItem(placement: .confirmationAction) {
                Button("完成") { dismiss() }.foregroundStyle(Theme.accent)
            }}
        }
    }

    private func row(_ m: PickerModel) -> some View {
        HStack(spacing: 10) {
            Text(m.display).font(Theme.ui(15)).foregroundStyle(m.id == currentId ? Theme.accent : Theme.text)
            Spacer()
            if m.id == currentId { Image(systemName: "checkmark").font(.system(size: 14, weight: .semibold)).foregroundStyle(Theme.accent) }
        }
        .padding(.horizontal, 14).padding(.vertical, 13).contentShape(Rectangle())
    }
}
