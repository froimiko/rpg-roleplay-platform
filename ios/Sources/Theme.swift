import SwiftUI

// 与网站 tokens.css + 原型 1:1 的设计令牌(暖色暗色 + 衬线叙事)。
extension Color {
    init(_ hex: UInt, _ alpha: Double = 1) {
        self.init(.sRGB,
                  red: Double((hex >> 16) & 0xff) / 255,
                  green: Double((hex >> 8) & 0xff) / 255,
                  blue: Double(hex & 0xff) / 255,
                  opacity: alpha)
    }
}

enum Theme {
    // surfaces
    static let bg        = Color(0x1a1817)
    static let bgDeep    = Color(0x131211)
    static let bgWarm    = Color(0x211d1a)
    static let panel     = Color(0x211f1d)
    static let panel2    = Color(0x282623)
    static let panel3    = Color(0x2f2c28)
    // lines
    static let line      = Color(0x36322d)
    static let lineSoft  = Color(0x2a2724)
    static let lineStrong = Color(0x4a4540)
    // text
    static let text      = Color(0xebe7df)
    static let textQuiet = Color(0xc8c2b7)
    static let muted     = Color(0x968f85)
    // 提亮至 ~4.6:1(WCAG AA);旧 0x6b655e 仅 3.07:1 不达标,仍比 muted 略暗以保层级。
    static let muted2    = Color(0x8a847b)
    // accent
    static let accent    = Color(0xc96442)
    static let accentSoft = Color(0xc96442, 0.14)
    static let accentEdge = Color(0xc96442, 0.42)
    static let onAccent  = Color(0xfff8f3)
    // status
    static let danger    = Color(0xc8675d)

    // 叙事/字标用衬线(系统 serif:Latin=New York,中文=宋体,自动按语言切换);UI 用系统 sans。
    // 支持「动态字体」:按用户的文字大小偏好缩放(WCAG 1.4.4),封顶 1.4× 以免密集布局溢出。
    static func serif(_ size: CGFloat, _ w: Font.Weight = .regular) -> Font { .system(size: scaled(size), weight: w, design: .serif) }
    static func ui(_ size: CGFloat, _ w: Font.Weight = .regular) -> Font { .system(size: scaled(size), weight: w) }
    private static func scaled(_ s: CGFloat) -> CGFloat { min(UIFontMetrics.default.scaledValue(for: s), s * 1.4) }
}

// 烛光暖色背景(对齐原型:顶部终焉色微光 + 暖色径向 → 深色)。
struct WarmBackground: View {
    var body: some View {
        ZStack {
            Theme.bgDeep
            RadialGradient(colors: [Theme.bgWarm, Theme.bg, Theme.bgDeep],
                           center: .top, startRadius: 0, endRadius: 760)
            RadialGradient(colors: [Color(0xc96442, 0.12), .clear],
                           center: UnitPoint(x: 0.5, y: -0.04), startRadius: 0, endRadius: 340)
            if UIImage(named: "grain") != nil {
                Image("grain").resizable(resizingMode: .tile)
                    .opacity(0.045).blendMode(.overlay).ignoresSafeArea()
            }
        }
        .ignoresSafeArea()
    }
}

// 终焉色脉冲在场点
struct PresenceDot: View {
    @State private var on = false
    var body: some View {
        Circle().fill(Theme.accent).frame(width: 5, height: 5)
            .overlay(Circle().stroke(Theme.accent, lineWidth: 1).scaleEffect(on ? 2.6 : 1).opacity(on ? 0 : 0.6))
            .animation(.easeOut(duration: 2.0).repeatForever(autoreverses: false), value: on)
            .onAppear { on = true }
            .accessibilityHidden(true)
    }
}
