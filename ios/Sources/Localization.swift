import Foundation
import SwiftUI

extension Text {
    /// 把「经函数参数传入的 UI 文案」按本地化 key 渲染。
    /// SwiftUI 里 `Text("字面量")` 会查表本地化,但 `Text(变量)` 是逐字(verbatim)。
    /// 很多 UI 文案是字面量传给辅助函数(stat/navRow/card…)后再 Text(参数),会丢失本地化;
    /// 这些地方改用 `Text(loc:)` 即可把运行时字符串当 key 查表。仅用于 UI 文案,不要用于用户内容/模型名等数据。
    init(loc s: String) { self.init(LocalizedStringKey(s)) }
}

/// 运行时把一个字符串当本地化 key 取译文(用于插值/计算出的文案,如问候语)。
/// Bundle.main 已被 AppLanguage.apply 重定向,故返回当前语言译文;未命中则原样返回。
func tr(_ s: String) -> String { Bundle.main.localizedString(forKey: s, value: s, table: nil) }

/// 当前界面语言码。
var currentUILang: String { UserDefaults.standard.string(forKey: "app_language") ?? AppLanguage.resolveInitial() }
var isEnglishUI: Bool { currentUILang == "en" }

/// 字数本地化:中文按「万/字」,英文按 k/M。
func locWordCount(_ n: Int) -> String {
    if isEnglishUI {
        if n >= 1_000_000 { return String(format: "%.1fM words", Double(n) / 1_000_000) }
        if n >= 1_000 { return String(format: "%.0fk words", Double(n) / 1_000) }
        return "\(n) words"
    }
    return n >= 10000 ? String(format: "%.0f万字", Double(n) / 10000) : "\(n)字"
}

// 运行时切换 App 界面语言。
//
// SwiftUI 的 `Text("中文字面量")` 本就是 LocalizedStringKey,会去 Localizable.strings 查表;
// 之前没有 .strings 文件,所以全部回退到中文。这里:
//   1. 提供 en.lproj / zh-Hans.lproj 两份 .strings(已生成);
//   2. 用 object_setClass 把 Bundle.main 换成可重定向的子类,使查表走「用户选定语言」的 .lproj;
//   3. 配合根视图的 .environment(\.locale) + .id(language) 触发整树重渲染,即时生效、无需重启。
//
// 语言代码沿用 web:"zh-CN" / "zh-TW" / "en";映射到 .lproj 资源目录。

private var kAssocBundleKey: UInt8 = 0

final class RedirectableBundle: Bundle, @unchecked Sendable {
    override func localizedString(forKey key: String, value: String?, table tableName: String?) -> String {
        if let target = objc_getAssociatedObject(self, &kAssocBundleKey) as? Bundle {
            return target.localizedString(forKey: key, value: value, table: tableName)
        }
        return super.localizedString(forKey: key, value: value, table: tableName)
    }
}

enum AppLanguage {
    // web 语言码 → .lproj 目录名。zh-Hant.lproj 由 zh-Hans 经 opencc(s2twp 台湾正体)生成。
    static func lproj(for code: String) -> String {
        switch code {
        case "en": return "en"
        case "zh-TW", "zh-Hant": return "zh-Hant"
        default: return "zh-Hans"
        }
    }
    // 用于数字/日期格式化的 Locale 标识。
    static func localeId(for code: String) -> String {
        switch code {
        case "en": return "en"
        case "zh-TW": return "zh-Hant"
        default: return "zh-Hans"
        }
    }

    private static let swizzleOnce: Void = {
        object_setClass(Bundle.main, RedirectableBundle.self)
    }()

    /// 把 Bundle.main 的查表重定向到指定语言的 .lproj。
    static func apply(_ code: String) {
        _ = swizzleOnce
        let dir = lproj(for: code)
        let target = Bundle.main.path(forResource: dir, ofType: "lproj").flatMap { Bundle(path: $0) }
        objc_setAssociatedObject(Bundle.main, &kAssocBundleKey, target, .OBJC_ASSOCIATION_RETAIN_NONATOMIC)
    }

    /// 首次启动的默认语言:已存偏好优先,否则跟随设备语言(中文→zh-CN,其余→en)。
    static func resolveInitial() -> String {
        if let saved = UserDefaults.standard.string(forKey: "app_language"), !saved.isEmpty { return saved }
        let dev = Locale.preferredLanguages.first ?? "en"
        return dev.hasPrefix("zh") ? "zh-CN" : "en"
    }
}
