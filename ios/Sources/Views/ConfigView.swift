import SwiftUI

struct ConfigView: View {
    @EnvironmentObject var store: AppStore
    @State private var showServer = false

    var body: some View {
        NavigationStack {
            ZStack {
                WarmBackground()
                Form {
                    Section {
                        HStack(spacing: 12) {
                            ZStack { Circle().fill(Theme.accentSoft); Circle().stroke(Theme.accentEdge, lineWidth: 1)
                                Text(String((store.user?.displayName ?? store.user?.username ?? "U").prefix(1)))
                                    .font(Theme.serif(20)).foregroundStyle(Theme.accent)
                            }.frame(width: 48, height: 48)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(store.user?.displayName ?? store.user?.username ?? "用户")
                                    .font(Theme.ui(16, .medium)).foregroundStyle(Theme.text)
                                Text(loc: store.demo ? "演示模式" : (store.user?.username ?? "")).font(Theme.ui(12)).foregroundStyle(Theme.muted)
                            }
                            Spacer()
                        }.listRowBackground(Theme.panel)
                    } header: { Text("账户").foregroundStyle(Theme.muted) }

                    Section {
                        row("服务器", value: serverHost) { showServer = true }
                    } header: { Text("连接").foregroundStyle(Theme.muted) }
                    footer: { Text("可连官方服务器或你自建的服务器。").foregroundStyle(Theme.muted2) }

                    Section {
                        infoRow("版本", "1.0.0")
                        infoRow("定位", "通用对话客户端")
                    } header: { Text("关于").foregroundStyle(Theme.muted) }

                    Section {
                        Button(role: .destructive) { Task { await store.logout() } } label: {
                            Text(loc: store.demo ? "退出演示" : "退出登录").foregroundStyle(Theme.danger)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }.listRowBackground(Theme.panel)
                    }
                }
                .scrollContentBackground(.hidden)
            }
            .navigationTitle("配置")
            .toolbarBackground(Theme.bg, for: .navigationBar).toolbarBackground(.visible, for: .navigationBar)
            .sheet(isPresented: $showServer) { ServerSettingsView() }
        }
    }

    private var serverHost: String { URL(string: store.serverURL)?.host ?? store.serverURL }

    private func row(_ title: String, value: String, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack {
                Text(loc: title).foregroundStyle(Theme.text)
                Spacer()
                Text(value).foregroundStyle(Theme.muted).lineLimit(1)
                Image(systemName: "chevron.right").font(.system(size: 12, weight: .semibold)).foregroundStyle(Theme.muted2)
            }
        }.listRowBackground(Theme.panel)
    }
    private func infoRow(_ title: String, _ value: String) -> some View {
        HStack { Text(loc: title).foregroundStyle(Theme.text); Spacer(); Text(value).foregroundStyle(Theme.muted) }
            .listRowBackground(Theme.panel)
    }
}
