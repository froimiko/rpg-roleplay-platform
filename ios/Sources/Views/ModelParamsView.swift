import SwiftUI

// 模型参数 —— 1:1 对齐 web MobileSettings「模型参数」:预设 + 全部采样/惩罚/上下文/NSFW/Mirostat。
// 全部写 `settings.<key>` 偏好(POST /api/me/preference)。
struct ModelParamsView: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.dismiss) private var dismiss

    @State private var preset = "balanced"
    @State private var temperature = 0.78
    @State private var reasoningEffort = "medium"
    @State private var topP = 0.92
    @State private var topK = 40.0
    @State private var repPenalty = 1.15
    @State private var freqPenalty = 0.20
    @State private var presPenalty = 0.10
    @State private var maxTokens = 4096.0
    @State private var contextSize = 16384
    @State private var seedText = "-1"
    @State private var stop = ""
    @State private var nsfwMode = "soft"
    @State private var nsfwIntensity = 0.5
    @State private var nsfwExtra = ""
    @State private var mirostatAdvanced = false
    @State private var mirostatMode = "off"
    @State private var mirostatTau = 5.0
    @State private var mirostatEta = 0.10
    @State private var jsonExpanded = false
    @State private var loaded = false

    private let ctxOptions = [4096, 8192, 16384, 32768, 65536, 131072, 1048576]

    var body: some View {
        NavigationStack {
            ZStack {
                WarmBackground()
                ScrollView {
                    VStack(alignment: .leading, spacing: 22) {
                        presetSection
                        samplingSection
                        lengthSection
                        nsfwSection
                        mirostatSection
                        jsonSection
                    }.padding(16).padding(.bottom, 24)
                }
            }
            .navigationTitle("模型参数").navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Theme.bg, for: .navigationBar).toolbarBackground(.visible, for: .navigationBar)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("完成") { dismiss() }.foregroundStyle(Theme.accent) } }
            .task { await load() }
        }
    }

    // MARK: 预设
    private var presetSection: some View {
        group("预设") {
            segment(["balanced": "均衡", "conservative": "保守", "creative": "创意", "deterministic": "确定", "custom": "自定义"],
                    order: ["balanced", "conservative", "creative", "deterministic", "custom"],
                    sel: preset) { applyPreset($0) }
        }
    }

    // MARK: 采样
    private var samplingSection: some View {
        group("采样") {
            sliderRow("Temperature", $temperature, 0...2, 0.05, "%.2f") { save("temperature", temperature); markCustom() }
            labelRow("推理强度")
            segment(["low": "低", "medium": "中", "high": "高"], order: ["low", "medium", "high"], sel: reasoningEffort) {
                reasoningEffort = $0; save("reasoning_effort", $0)
            }
            sliderRow("Top-p", $topP, 0...1, 0.01, "%.2f") { save("top_p", topP); markCustom() }
            sliderRow("Top-k", $topK, 0...200, 1, "%.0f") { save("top_k", Int(topK)); markCustom() }
            sliderRow("重复惩罚", $repPenalty, 1...2, 0.01, "%.2f") { save("repetition_penalty", repPenalty); markCustom() }
            sliderRow("Frequency Penalty", $freqPenalty, -2...2, 0.05, "%.2f") { save("frequency_penalty", freqPenalty); markCustom() }
            sliderRow("Presence Penalty", $presPenalty, -2...2, 0.05, "%.2f") { save("presence_penalty", presPenalty); markCustom() }
        }
    }

    // MARK: 长度 / 上下文 / 种子 / 停止词
    private var lengthSection: some View {
        group("输出与上下文") {
            sliderRow("最大输出 tokens", $maxTokens, 512...32768, 256, "%.0f") { save("max_tokens", Int(maxTokens)) }
            labelRow("上下文长度")
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(ctxOptions, id: \.self) { v in
                        Button { contextSize = v; save("context_size", v) } label: {
                            Text(ctxLabel(v)).font(Theme.ui(12.5, .medium)).foregroundStyle(contextSize == v ? Theme.onAccent : Theme.muted)
                                .padding(.horizontal, 12).padding(.vertical, 6)
                                .background(Capsule().fill(contextSize == v ? Theme.accent : Theme.panel2))
                        }
                    }
                }
            }
            fieldRow("随机种子", text: $seedText, placeholder: "-1 = 随机", keyboard: .numbersAndPunctuation) {
                save("seed", Int(seedText) ?? -1)
            }
            fieldRow("停止词", text: $stop, placeholder: "用 | 分隔,如 player:|system:") { save("stop", stop) }
        }
    }

    // MARK: NSFW
    private var nsfwSection: some View {
        group("内容过滤") {
            segment(["block": "屏蔽", "soft": "柔和", "open": "开放", "explicit": "完全"],
                    order: ["block", "soft", "open", "explicit"], sel: nsfwMode) { nsfwMode = $0; save("nsfw_mode", $0) }
            if nsfwMode != "block" {
                sliderRow("强度", $nsfwIntensity, 0...1, 0.05, "%.2f") { save("nsfw_intensity", nsfwIntensity) }
                fieldRow("补充提示词", text: $nsfwExtra, placeholder: "可选") { save("nsfw_extra_prompt", nsfwExtra) }
            }
            Text("过滤由所连服务器/模型执行;自建服务器按你的设置生效。").font(Theme.ui(11)).foregroundStyle(Theme.muted2)
        }
    }

    // MARK: Mirostat
    private var mirostatSection: some View {
        group("Mirostat(高级)") {
            Toggle(isOn: $mirostatAdvanced) { Text("启用高级采样").font(Theme.ui(14)).foregroundStyle(Theme.text) }
                .tint(Theme.accent)
            if mirostatAdvanced {
                segment(["off": "关", "v1": "v1", "v2": "v2"], order: ["off", "v1", "v2"], sel: mirostatMode) {
                    mirostatMode = $0; save("mirostat_mode", $0)
                }
                sliderRow("τ (tau)", $mirostatTau, 0...10, 0.1, "%.1f") { save("mirostat_tau", mirostatTau) }
                sliderRow("η (eta)", $mirostatEta, 0...1, 0.01, "%.2f") { save("mirostat_eta", mirostatEta) }
            }
        }
    }

    // MARK: JSON 预览
    private var jsonSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Button {
                withAnimation(.easeInOut(duration: 0.2)) { jsonExpanded.toggle() }
            } label: {
                HStack {
                    Text("查看 JSON").font(Theme.ui(11, .semibold)).foregroundStyle(Theme.accent).tracking(1.2)
                    Spacer()
                    Image(systemName: jsonExpanded ? "chevron.up" : "chevron.down")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(Theme.muted)
                }
            }
            .buttonStyle(.plain)
            if jsonExpanded {
                ScrollView(.horizontal, showsIndicators: false) {
                    Text(currentParamsJSON())
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundStyle(Theme.text)
                        .padding(12)
                }
                .background(RoundedRectangle(cornerRadius: 14).fill(Theme.panel2))
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.line, lineWidth: 1))
            }
        }
    }

    private func currentParamsJSON() -> String {
        var dict: [String: Any] = [
            "preset": preset,
            "temperature": temperature,
            "reasoning_effort": reasoningEffort,
            "top_p": topP,
            "top_k": Int(topK),
            "repetition_penalty": repPenalty,
            "frequency_penalty": freqPenalty,
            "presence_penalty": presPenalty,
            "max_tokens": Int(maxTokens),
            "context_size": contextSize,
            "seed": Int(seedText) ?? -1,
            "stop": stop,
            "nsfw_mode": nsfwMode,
            "nsfw_intensity": nsfwIntensity,
            "nsfw_extra_prompt": nsfwExtra,
            "mirostat_mode": mirostatMode,
            "mirostat_tau": mirostatTau,
            "mirostat_eta": mirostatEta,
        ]
        if let data = try? JSONSerialization.data(withJSONObject: dict, options: [.prettyPrinted, .sortedKeys]),
           let str = String(data: data, encoding: .utf8) {
            return str
        }
        // fallback: manual compact representation
        return dict.map { "\"\($0.key)\": \($0.value)" }.sorted().joined(separator: "\n")
    }

    // MARK: 组件
    private func group<C: View>(_ title: String, @ViewBuilder _ content: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(loc: title).font(Theme.ui(11, .semibold)).foregroundStyle(Theme.accent).tracking(1.2)
            VStack(alignment: .leading, spacing: 14) { content() }
                .padding(14)
                .background(RoundedRectangle(cornerRadius: 14).fill(Theme.panel))
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.line, lineWidth: 1))
        }
    }
    private func labelRow(_ t: String) -> some View { Text(loc: t).font(Theme.ui(13.5)).foregroundStyle(Theme.text) }

    private func sliderRow(_ label: String, _ value: Binding<Double>, _ range: ClosedRange<Double>, _ step: Double, _ fmt: String, _ onCommit: @escaping () -> Void) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(loc: label).font(Theme.ui(13.5)).foregroundStyle(Theme.text)
                Spacer()
                Text(String(format: fmt, value.wrappedValue)).font(Theme.ui(13)).foregroundStyle(Theme.muted).monospacedDigit()
            }
            Slider(value: value, in: range, step: step) { editing in if !editing { onCommit() } }.tint(Theme.accent)
        }
    }
    private func segment(_ map: [String: String], order: [String], sel: String, _ onPick: @escaping (String) -> Void) -> some View {
        HStack(spacing: 6) {
            ForEach(order, id: \.self) { k in
                Button { onPick(k) } label: {
                    Text(map[k] ?? k).font(Theme.ui(12.5, .medium)).foregroundStyle(sel == k ? Theme.onAccent : Theme.muted)
                        .frame(maxWidth: .infinity).padding(.vertical, 7)
                        .background(RoundedRectangle(cornerRadius: 8).fill(sel == k ? Theme.accent : Theme.panel2))
                }
            }
        }
    }
    private func fieldRow(_ label: String, text: Binding<String>, placeholder: String, keyboard: UIKeyboardType = .default, _ onCommit: @escaping () -> Void) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(loc: label).font(Theme.ui(13.5)).foregroundStyle(Theme.text)
            TextField(placeholder, text: text).font(Theme.ui(13.5)).foregroundStyle(Theme.text).tint(Theme.accent)
                .keyboardType(keyboard).autocorrectionDisabled().textInputAutocapitalization(.never)
                .padding(.horizontal, 10).padding(.vertical, 8)
                .background(RoundedRectangle(cornerRadius: 8).fill(Theme.panel2))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(Theme.line, lineWidth: 1))
                .onSubmit(onCommit)
        }
    }
    private func ctxLabel(_ v: Int) -> String {
        switch v { case 1048576: return "1M"; default: return "\(v/1024)K" }
    }

    // MARK: 预设
    private func applyPreset(_ name: String) {
        preset = name
        let presets: [String: (temp: Double, topP: Double, rep: Double, freq: Double, pres: Double)] = [
            "conservative": (0.4, 0.85, 1.05, 0.1, 0.0),
            "balanced": (0.78, 0.92, 1.15, 0.2, 0.1),
            "creative": (1.0, 0.98, 1.2, 0.3, 0.2),
            "deterministic": (0.1, 0.5, 1.0, 0.0, 0.0),
        ]
        guard let p = presets[name] else {
            // custom — just record the preset key
            guard loaded, !store.demo else { return }
            Task { try? await store.api.setPreferences(base: store.serverURL, ["settings.preset": name]) }
            return
        }
        // Update @State so sliders move immediately
        temperature = p.temp; topP = p.topP; repPenalty = p.rep; freqPenalty = p.freq; presPenalty = p.pres
        // Single batch write
        guard loaded, !store.demo else { return }
        Task {
            try? await store.api.setPreferences(base: store.serverURL, [
                "settings.preset": name,
                "settings.temperature": p.temp,
                "settings.top_p": p.topP,
                "settings.repetition_penalty": p.rep,
                "settings.frequency_penalty": p.freq,
                "settings.presence_penalty": p.pres,
            ])
        }
    }
    private func markCustom() { if preset != "custom" { preset = "custom"; save("preset", "custom") } }

    // MARK: 持久化
    private func save(_ key: String, _ value: Any) {
        guard loaded, !store.demo else { return }
        Task { try? await store.api.setPreferences(base: store.serverURL, ["settings.\(key)": value]) }
    }

    private func load() async {
        if store.demo { loaded = true; return }
        guard let p = try? await store.api.profile(base: store.serverURL) else { loaded = true; return }
        let prefs = p.prefs
        func dbl(_ k: String, _ def: Double) -> Double {
            for key in ["settings.\(k)", k] {
                if let v = prefs[key] as? Double { return v }
                if let v = prefs[key] as? Int { return Double(v) }
                if let v = prefs[key] as? NSNumber { return v.doubleValue }
                if let s = prefs[key] as? String, let d = Double(s) { return d }
            }
            return def
        }
        func sv(_ k: String, _ def: String) -> String {
            for key in ["settings.\(k)", k] { if let v = prefs[key] as? String, !v.isEmpty { return v } }
            return def
        }
        func iv(_ k: String, _ def: Int) -> Int {
            for key in ["settings.\(k)", k] {
                if let v = prefs[key] as? Int { return v }
                if let v = prefs[key] as? Double { return Int(v) }
                if let v = prefs[key] as? NSNumber { return v.intValue }
            }
            return def
        }
        preset = sv("preset", "balanced")
        temperature = dbl("temperature", 0.78)
        reasoningEffort = sv("reasoning_effort", "medium")
        topP = dbl("top_p", 0.92)
        topK = dbl("top_k", 40)
        repPenalty = dbl("repetition_penalty", 1.15)
        freqPenalty = dbl("frequency_penalty", 0.20)
        presPenalty = dbl("presence_penalty", 0.10)
        maxTokens = dbl("max_tokens", 4096)
        contextSize = iv("context_size", 16384)
        seedText = "\(iv("seed", -1))"
        stop = sv("stop", "")
        nsfwMode = sv("nsfw_mode", "soft")
        nsfwIntensity = dbl("nsfw_intensity", 0.5)
        nsfwExtra = sv("nsfw_extra_prompt", "")
        mirostatMode = sv("mirostat_mode", "off")
        mirostatTau = dbl("mirostat_tau", 5.0)
        mirostatEta = dbl("mirostat_eta", 0.10)
        mirostatAdvanced = (mirostatMode != "off")
        loaded = true
    }
}
