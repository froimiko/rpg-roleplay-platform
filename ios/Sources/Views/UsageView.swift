import SwiftUI

// 用量 —— 对齐 web「用量」:近 30 天总览 + 预测 + 按模型 + 每条消息(计费明细)。
struct UsageView: View {
    @EnvironmentObject var store: AppStore
    @State private var data: [String: Any] = [:]
    @State private var loading = true

    var body: some View {
        SettingsScaffold(title: "用量(近 30 天)") {
            if loading {
                ProgressView().tint(Theme.accent).frame(maxWidth: .infinity).padding(.vertical, 24)
            } else if (num("total_tokens") ?? 0) == 0 && recent.isEmpty {
                VStack(spacing: 8) {
                    Image(systemName: "chart.bar.xaxis").font(.system(size: 34)).foregroundStyle(Theme.muted2)
                    Text(loc: "暂无用量数据(BYOK 调用后才会出现)。").font(Theme.ui(13)).foregroundStyle(Theme.muted)
                }.frame(maxWidth: .infinity).padding(.vertical, 30)
            } else {
                overview
                breakdown
                byModel
                recentMessages
            }
        } onLoad: { await load() }
    }

    // ── 总览:总 token + 费用 + 30 天投影 ──
    private var overview: some View {
        card("总览") {
            HStack(spacing: 12) {
                bigStat(fmtInt(num("total_tokens")), "总 token")
                Rectangle().fill(Theme.line).frame(width: 1, height: 38)
                bigStat(money(num("cost_usd")), "费用")
            }
            if let proj = forecast["projected_30d_cost"] as? Double ?? (forecast["projected_30d_cost"] as? NSNumber)?.doubleValue {
                Divider().overlay(Theme.lineSoft).padding(.vertical, 2)
                HStack {
                    Text(loc: "按当前速率 · 30 天投影").font(Theme.ui(12.5)).foregroundStyle(Theme.muted)
                    Spacer()
                    Text(money(proj)).font(Theme.ui(13.5, .semibold)).foregroundStyle(Theme.text).monospacedDigit()
                    if let t = forecast["trend_7d_vs_prev_7d_pct"] as? Double ?? (forecast["trend_7d_vs_prev_7d_pct"] as? NSNumber)?.doubleValue, abs(t) >= 1 {
                        Text((t > 0 ? "↑" : "↓") + String(format: "%.0f%%", abs(t)))
                            .font(Theme.ui(11.5, .semibold)).foregroundStyle(t > 0 ? Theme.danger : Theme.accent)
                    }
                }
            }
        }
    }
    private var breakdown: some View {
        card("Token 构成") {
            statRow("输入", fmtInt(num("input_tokens")))
            statRow("输出", fmtInt(num("output_tokens")))
            if let cached = num("cached_input_tokens"), cached > 0 { statRow("缓存命中输入", fmtInt(cached)) }
        }
    }
    @ViewBuilder private var byModel: some View {
        let models = arr("by_model")
        if !models.isEmpty {
            card("按模型") {
                ForEach(Array(models.enumerated()), id: \.offset) { i, m in
                    if i > 0 { Divider().overlay(Theme.lineSoft) }
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text(str(m, "model").isEmpty ? str(m, "api_id") : str(m, "model"))
                                .font(Theme.ui(13.5, .medium)).foregroundStyle(Theme.text).lineLimit(1)
                            Spacer()
                            Text(money(dnum(m, "cost_usd"))).font(Theme.ui(13, .semibold)).foregroundStyle(Theme.accent).monospacedDigit()
                        }
                        Text("\(Int(dnum(m, "turns") ?? 0)) 次 · 入 \(fmtInt(dnum(m, "input_tokens"))) · 出 \(fmtInt(dnum(m, "output_tokens")))")
                            .font(Theme.ui(11.5)).foregroundStyle(Theme.muted).monospacedDigit()
                    }
                }
            }
        }
    }
    // ── 每条消息计费明细 ──
    @ViewBuilder private var recentMessages: some View {
        if !recent.isEmpty {
            card("每条消息 · 计费明细") {
                ForEach(Array(recent.enumerated()), id: \.offset) { i, r in
                    if i > 0 { Divider().overlay(Theme.lineSoft) }
                    VStack(alignment: .leading, spacing: 3) {
                        HStack(spacing: 6) {
                            Text(scenarioCN(str(r, "scenario"))).font(Theme.ui(9.5, .semibold)).foregroundStyle(Theme.accent)
                                .padding(.horizontal, 6).padding(.vertical, 1).background(Capsule().fill(Theme.accentSoft))
                            Text(shortTime(str(r, "at"))).font(Theme.ui(11)).foregroundStyle(Theme.muted2)
                            Spacer()
                            Text(money(dnum(r, "cost_usd"))).font(Theme.ui(13, .semibold)).foregroundStyle(Theme.accent).monospacedDigit()
                        }
                        HStack(spacing: 10) {
                            Text("入 \(fmtInt(dnum(r, "input_tokens"))) → 出 \(fmtInt(dnum(r, "output_tokens")))")
                                .font(Theme.ui(11.5)).foregroundStyle(Theme.textQuiet).monospacedDigit()
                            let cu = dnum(r, "context_used") ?? 0, cm = dnum(r, "context_max") ?? 0
                            if cm > 0 {
                                Text("上下文 \(fmtInt(cu))/\(fmtInt(cm))").font(Theme.ui(11)).foregroundStyle(Theme.muted).monospacedDigit()
                            }
                            Spacer()
                        }
                    }
                }
                if (data["recent_total"] as? Int ?? recent.count) > recent.count {
                    Text("仅显示最近 \(recent.count) 条 · 更多请到网页端查看")
                        .font(Theme.ui(11)).foregroundStyle(Theme.muted2).padding(.top, 2)
                }
            }
        }
    }

    // ── 小组件 ──
    private func bigStat(_ v: String, _ label: String) -> some View {
        VStack(spacing: 3) {
            Text(v).font(Theme.serif(22, .semibold)).foregroundStyle(Theme.text).monospacedDigit()
            Text(loc: label).font(Theme.ui(11)).foregroundStyle(Theme.muted)
        }.frame(maxWidth: .infinity)
    }
    private func statRow(_ k: String, _ v: String) -> some View {
        HStack { Text(loc: k).font(Theme.ui(14)).foregroundStyle(Theme.text); Spacer()
            Text(v).font(Theme.ui(15, .semibold)).foregroundStyle(Theme.accent).monospacedDigit() }
    }

    // ── 数据解析 ──
    private var forecast: [String: Any] { data["forecast"] as? [String: Any] ?? [:] }
    private var recent: [[String: Any]] { arr("recent_turns") }
    private func arr(_ k: String) -> [[String: Any]] { (data[k] as? [[String: Any]]) ?? [] }
    private func str(_ d: [String: Any], _ k: String) -> String { (d[k] as? String) ?? "" }
    private func dnum(_ d: [String: Any], _ k: String) -> Double? {
        if let v = d[k] as? Double { return v }; if let v = d[k] as? Int { return Double(v) }
        if let v = d[k] as? NSNumber { return v.doubleValue }; return nil
    }
    private func num(_ k: String) -> Double? {
        if let t = data["totals"] as? [String: Any] { if let v = dnum(t, k) { return v } }
        return dnum(data, k)
    }
    private func money(_ v: Double?) -> String {
        guard let v, v > 0 else { return "$0" }
        return v < 0.01 ? String(format: "$%.4f", v) : String(format: "$%.2f", v)
    }
    private func fmtInt(_ v: Double?) -> String {
        guard let v else { return "—" }
        if v >= 1_000_000 { return String(format: "%.2fM", v / 1_000_000) }
        if v >= 1_000 { return String(format: "%.1fK", v / 1_000) }
        return "\(Int(v))"
    }
    private func shortTime(_ s: String) -> String {
        // "2026-06-23 12:01:33..." → "06-23 12:01"
        let t = s.replacingOccurrences(of: "T", with: " ")
        guard t.count >= 16 else { return t }
        return String(t.dropFirst(5).prefix(11))
    }
    private func scenarioCN(_ s: String) -> String {
        switch s {
        case "chat": return tr("对话")
        case "game", "gm": return tr("游戏")
        case "tavern": return tr("酒馆")
        case "image", "image_gen": return tr("生图")
        case "import", "extract": return tr("导入")
        case "": return tr("对话")
        default: return s
        }
    }

    private func load() async {
        if store.demo { data = DemoData.usage; loading = false; return }
        data = await store.api.usage(base: store.serverURL, days: 30)
        loading = false
    }
}
