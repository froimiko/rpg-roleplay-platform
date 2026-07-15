import SwiftUI

// 游戏台右侧「世界面板」抽屉 —— 状态 / 记忆 / 人物 / 时间线(对齐 web panels.jsx)。
struct GamePanelsDrawer: View {
    let snap: GameSnapshot
    let contextPct: Int
    let modelLabel: String
    @State private var tab = 0

    private let tabs = ["状态", "记忆", "人物", "时间线", "世界书", "规则", "上下文"]

    var body: some View {
        ZStack {
            Theme.bg.ignoresSafeArea()
            VStack(spacing: 0) {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(Array(tabs.enumerated()), id: \.offset) { i, t in
                            Button { tab = i } label: {
                                Text(loc: t).font(Theme.ui(13, .medium)).foregroundStyle(tab == i ? Theme.onAccent : Theme.muted)
                                    .padding(.horizontal, 12).padding(.vertical, 6)
                                    .background(Capsule().fill(tab == i ? Theme.accent : Theme.panel2))
                            }
                        }
                    }.padding(.horizontal, 14).padding(.vertical, 12)
                }
                Divider().overlay(Theme.lineSoft)
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        switch tab {
                        case 0: statusPanel
                        case 1: memoryPanel
                        case 2: cardsPanel
                        case 3: timelinePanel
                        case 4: worldbookPanel
                        case 5: rulesPanel
                        default: contextPanel
                        }
                    }.padding(16).frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
    }

    // 状态:角色 + 世界
    private var statusPanel: some View {
        VStack(alignment: .leading, spacing: 16) {
            section("角色") {
                kv("姓名", snap.playerName)
                kv("定位", snap.playerRole)
                kv("位置", snap.sceneLocation)
                if let bg = snap.playerBackground { para(bg) }
            }
            section("世界") {
                kv("时间", snap.sceneTime)
                kv("天气", snap.sceneWeather)
            }
        }
    }
    private var memoryPanel: some View {
        VStack(alignment: .leading, spacing: 16) {
            section("当前目标") { para(snap.objective ?? "—") }
            section("已知事实") {
                if snap.facts.isEmpty { emptyText }
                else { ForEach(snap.facts, id: \.self) { bullet($0) } }
            }
        }
    }
    private var cardsPanel: some View {
        section("在场人物") {
            if snap.entities.isEmpty { emptyText }
            else {
                ForEach(snap.entities) { e in
                    HStack(spacing: 10) {
                        ZStack { Circle().fill(Theme.accentSoft); Text(String(e.name.prefix(1))).font(Theme.serif(15)).foregroundStyle(Theme.accent) }
                            .frame(width: 32, height: 32)
                        VStack(alignment: .leading, spacing: 1) {
                            Text(e.name).font(Theme.ui(14, .medium)).foregroundStyle(Theme.text)
                            if let r = e.role { Text(r).font(Theme.ui(11)).foregroundStyle(Theme.muted) }
                        }
                        Spacer()
                    }
                }
            }
        }
    }
    private var timelinePanel: some View {
        section("已知事件") {
            if snap.knownEvents.isEmpty { emptyText }
            else {
                ForEach(Array(snap.knownEvents.enumerated()), id: \.offset) { _, e in
                    HStack(alignment: .top, spacing: 8) {
                        Circle().fill(Theme.accent).frame(width: 6, height: 6).padding(.top, 6)
                        Text(e).font(Theme.ui(13)).foregroundStyle(Theme.text)
                    }
                }
            }
        }
    }
    private var worldbookPanel: some View {
        section("世界书") {
            if snap.worldbookEntries.isEmpty { emptyText }
            else {
                ForEach(Array(snap.worldbookEntries.enumerated()), id: \.offset) { _, e in
                    VStack(alignment: .leading, spacing: 3) {
                        Text(e.name).font(Theme.ui(13, .semibold)).foregroundStyle(Theme.text)
                        if !e.content.isEmpty {
                            Text(e.content).font(Theme.ui(12)).foregroundStyle(Theme.muted).lineLimit(6)
                        }
                    }
                    .padding(10).frame(maxWidth: .infinity, alignment: .leading)
                    .background(RoundedRectangle(cornerRadius: 8).fill(Theme.panel))
                }
            }
        }
    }
    private var rulesPanel: some View {
        VStack(alignment: .leading, spacing: 16) {
            section("规则集") { para(snap.rulesetName ?? "—") }
            section("角色数值") {
                if snap.pcStats.isEmpty { emptyText }
                else { ForEach(Array(snap.pcStats.enumerated()), id: \.offset) { _, kv in self.kv(kv.0, kv.1) } }
            }
            section("骰子日志") {
                if snap.diceLog.isEmpty { emptyText }
                else { ForEach(Array(snap.diceLog.enumerated()), id: \.offset) { _, d in
                    Text(d).font(Theme.ui(12).monospaced()).foregroundStyle(Theme.text)
                } }
            }
        }
    }
    private var contextPanel: some View {
        VStack(alignment: .leading, spacing: 16) {
            section("上下文") {
                kv("已用", "\(contextPct)%")
                if snap.contextWindow > 0 { kv("窗口", "\(snap.contextWindow) tokens") }
                ProgressView(value: Double(contextPct), total: 100).tint(Theme.accent)
            }
            section("模型") { para(modelLabel) }
        }
    }

    // helpers
    private func section<C: View>(_ title: String, @ViewBuilder _ content: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(loc: title).font(Theme.ui(11, .semibold)).foregroundStyle(Theme.accent).tracking(1.2)
            content()
        }
    }
    @ViewBuilder private func kv(_ k: String, _ v: String?) -> some View {
        if let v, !v.isEmpty {
            HStack(alignment: .top) {
                Text(k).font(Theme.ui(12.5)).foregroundStyle(Theme.muted).frame(width: 54, alignment: .leading)
                Text(v).font(Theme.ui(13)).foregroundStyle(Theme.text).frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }
    private func para(_ s: String) -> some View {
        Text(s).font(Theme.serif(13.5)).foregroundStyle(Theme.text).lineSpacing(4).frame(maxWidth: .infinity, alignment: .leading)
    }
    private func bullet(_ s: String) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Text("·").foregroundStyle(Theme.accent)
            Text(s).font(Theme.ui(13)).foregroundStyle(Theme.text)
        }
    }
    private var emptyText: some View { Text("暂无").font(Theme.ui(12.5)).foregroundStyle(Theme.muted2) }
}
