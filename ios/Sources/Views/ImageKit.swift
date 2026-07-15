import SwiftUI
import PhotosUI

// ─────────────────────────────────────────────────────────────────────────────
// 图片基础件(重设计 · 「装帧/书页插图」方向)——
//   每张图都像一本精装书里的插图版面:暖色暗底上轻微抬起的投影、发丝级描边 + 微终焉色内缘、
//   连续圆角;加载时走烛光微光(shimmer)。换图=磨砂笔触控件 + 定制操作单(非系统弹窗);
//   查看=可双击/捏合缩放、下拉关闭的灯箱;生成=带可视比例版面 + 风格便签的「落墨」单。
//
// 全 app 复用(封面/头像/聊天生成图)。所有对外签名与旧版一致,调用处零改动。
//   · ServerImageThumb / ServerImageView:展示
//   · ImageSetControl:换图(相册 / AI 生成 / 查看 / 移除)
//   · ImageLightbox:全屏查看   · GenImageSheet:AI 生成单
// 依赖 ChatAttach.swift 的 absoluteImageURL / AttachLoader。
// ─────────────────────────────────────────────────────────────────────────────

enum ServerImageStyle {
    case coverPortrait   // 3:4 圆角矩形(剧本封面)
    case avatarSquare    // 1:1 圆角矩形(卡头像)
    case avatarCircle    // 1:1 圆形(个人头像/说话者)

    var isCircle: Bool { self == .avatarCircle }
    var aspect: CGFloat { self == .coverPortrait ? 3.0 / 4.0 : 1 }
    var corner: CGFloat { self == .coverPortrait ? 12 : 14 }
    var genSize: String { self == .coverPortrait ? "832x1216" : "1024x1024" }
    var genKind: String { self == .coverPortrait ? "cover" : "avatar" }
}

// ── 装帧:发丝描边 + 抬起投影(+ focused 时终焉色内缘)──
private struct PlateFrame: ViewModifier {
    let shape: AnyShape
    let width: CGFloat
    var focused: Bool = false
    func body(content: Content) -> some View {
        content
            .overlay(shape.stroke(Theme.line, lineWidth: 1))
            .overlay(shape.stroke(Theme.accentEdge, lineWidth: focused ? 1.5 : 0))
            .shadow(color: .black.opacity(0.30), radius: max(2, width * 0.06), x: 0, y: max(1, width * 0.03))
    }
}
private extension View {
    func plate(_ shape: AnyShape, width: CGFloat, focused: Bool = false) -> some View {
        modifier(PlateFrame(shape: shape, width: width, focused: focused))
    }
}

// ── 烛光微光(加载态)──
private struct Shimmer: View {
    @State private var x: CGFloat = -1.2
    var body: some View {
        GeometryReader { g in
            LinearGradient(colors: [.clear, Theme.accent.opacity(0.13), Color(0xfff8f3, 0.06), .clear],
                           startPoint: .topLeading, endPoint: .bottomTrailing)
                .frame(width: g.size.width * 1.6)
                .offset(x: x * g.size.width * 1.4)
                .onAppear { withAnimation(.easeInOut(duration: 1.5).repeatForever(autoreverses: false)) { x = 1.2 } }
        }
        .allowsHitTesting(false)
    }
}

private func plateShape(_ style: ServerImageStyle) -> AnyShape {
    style.isCircle ? AnyShape(Circle()) : AnyShape(RoundedRectangle(cornerRadius: style.corner, style: .continuous))
}

// ── 展示:服务端图片(有 url 显示;加载走 shimmer;无/失败=精致占位版面)──
struct ServerImageThumb: View {
    let base: String
    let path: String?
    let style: ServerImageStyle
    var width: CGFloat
    var explicitHeight: CGFloat? = nil
    var placeholderIcon: String = "photo"

    private var height: CGFloat { explicitHeight ?? (style.aspect == 1 ? width : width / style.aspect) }
    private var shape: AnyShape { plateShape(style) }

    var body: some View {
        Group {
            if let p = path, !p.isEmpty, let url = absoluteImageURL(base: base, path: p) {
                AsyncImage(url: url, transaction: .init(animation: .easeOut(duration: 0.35))) { phase in
                    switch phase {
                    case .success(let img): img.resizable().scaledToFill()
                    case .empty: placeholder(loading: true)
                    default: placeholder(loading: false, broken: true)
                    }
                }
            } else { placeholder(loading: false) }
        }
        .frame(width: width, height: height)
        .clipShape(shape)
        .plate(shape, width: width)
    }

    private func placeholder(loading: Bool, broken: Bool = false) -> some View {
        ZStack {
            Theme.panel2
            // 内缘细线,像版面压痕
            shape.stroke(Theme.lineSoft, lineWidth: 1).padding(5).opacity(0.7)
            Image(systemName: broken ? "exclamationmark.triangle" : placeholderIcon)
                .font(.system(size: width * (style.isCircle ? 0.34 : 0.28), weight: .light))
                .foregroundStyle(Theme.muted2.opacity(broken ? 0.9 : 0.55))
            if loading { Shimmer() }
        }
    }
}

// ── 聊天气泡里的服务端生成图(可点开灯箱)──
struct ServerImageView: View {
    let base: String
    let path: String
    @State private var lightbox = false
    private let shape = AnyShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

    var body: some View {
        Button { lightbox = true } label: {
            AsyncImage(url: absoluteImageURL(base: base, path: path),
                       transaction: .init(animation: .easeOut(duration: 0.35))) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().scaledToFit().frame(maxWidth: 264)
                case .empty:
                    ZStack { Theme.panel2; Shimmer() }
                        .frame(width: 220, height: 220)
                case .failure:
                    HStack(spacing: 6) { Image(systemName: "photo"); Text(loc: "图片加载失败").font(Theme.ui(12)) }
                        .foregroundStyle(Theme.muted2).frame(width: 200, height: 120).background(Theme.panel2)
                @unknown default: EmptyView()
                }
            }
            .clipShape(shape)
            .plate(shape, width: 240)
        }
        .buttonStyle(PressableStyle())
        .fullScreenCover(isPresented: $lightbox) { ImageLightbox(base: base, path: path) }
    }
}

// 轻微按压反馈
struct PressableStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.spring(response: 0.3, dampingFraction: 0.7), value: configuration.isPressed)
    }
}

// ── 灯箱:模糊暗底 + 浮起插图 + 捏合/双击缩放 + 下拉关闭 ──
struct ImageLightbox: View {
    @Environment(\.dismiss) private var dismiss
    let base: String
    let path: String
    @State private var scale: CGFloat = 1
    @State private var drag: CGSize = .zero
    @State private var appeared = false

    private var dismissProgress: CGFloat { min(1, abs(drag.height) / 320) }

    var body: some View {
        ZStack {
            Color.black.opacity(0.92 * (1 - dismissProgress * 0.6)).ignoresSafeArea()
            if let url = absoluteImageURL(base: base, path: path) {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let img):
                        img.resizable().scaledToFit()
                            .scaleEffect(scale)
                            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                            .shadow(color: .black.opacity(0.6), radius: 30, y: 12)
                            .padding(16)
                            .offset(drag)
                            .scaleEffect(appeared ? (1 - dismissProgress * 0.12) : 0.92)
                            .opacity(appeared ? 1 : 0)
                            .gesture(
                                MagnificationGesture()
                                    .onChanged { scale = max(1, min(4, $0)) }
                                    .onEnded { _ in withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) { scale = max(1, min(4, scale)) } }
                            )
                            .simultaneousGesture(dragToDismiss)
                            .onTapGesture(count: 2) {
                                withAnimation(.spring(response: 0.35, dampingFraction: 0.75)) { scale = scale > 1.3 ? 1 : 2.2 }
                            }
                    case .empty: ProgressView().tint(.white)
                    default: Image(systemName: "photo").font(.system(size: 40)).foregroundStyle(.white.opacity(0.5))
                    }
                }
            }
            VStack {
                HStack {
                    Spacer()
                    Button { dismiss() } label: {
                        Image(systemName: "xmark").font(.system(size: 15, weight: .semibold)).foregroundStyle(.white)
                            .frame(width: 40, height: 40).background(.ultraThinMaterial, in: Circle())
                    }
                    .accessibilityLabel(Text(loc: "关闭窗口")).padding(16)
                }
                Spacer()
                if scale <= 1.01 {
                    Text(loc: "捏合放大 · 双击 · 下拉关闭")
                        .font(Theme.ui(11)).foregroundStyle(.white.opacity(0.55)).padding(.bottom, 22)
                        .opacity(1 - dismissProgress)
                }
            }
        }
        .onAppear { withAnimation(.spring(response: 0.4, dampingFraction: 0.82)) { appeared = true } }
    }

    private var dragToDismiss: some Gesture {
        DragGesture()
            .onChanged { if scale <= 1.01 { drag = $0.translation } }
            .onEnded { v in
                if scale <= 1.01 && abs(v.translation.height) > 150 { dismiss() }
                else { withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) { drag = .zero } }
            }
    }
}

// ── 定制换图操作单(替代系统 confirmationDialog)──
enum ImageAction { case photo, generate, view, remove }

private struct ImageActionSheet: View {
    @Environment(\.dismiss) private var dismiss
    let title: String
    let hasImage: Bool
    let allowRemove: Bool
    var onSelect: (ImageAction) -> Void

    var body: some View {
        VStack(spacing: 0) {
            Capsule().fill(Theme.lineStrong).frame(width: 38, height: 4).padding(.top, 10).padding(.bottom, 14)
            Text(loc: title).font(Theme.serif(18, .semibold)).foregroundStyle(Theme.text).padding(.bottom, 14)
            VStack(spacing: 8) {
                row("从相册选择", "photo.on.rectangle.angled", "上传你自己的图片") { onSelect(.photo) }
                row("AI 生成", "sparkles", "用一句描述生成画面") { onSelect(.generate) }
                if hasImage { row("查看大图", "arrow.up.left.and.arrow.down.right", "全屏查看当前图片") { onSelect(.view) } }
                if hasImage && allowRemove { row("移除", "trash", "清除当前图片", danger: true) { onSelect(.remove) } }
            }.padding(.horizontal, 16)
            Button { dismiss() } label: {
                Text(loc: "取消").font(Theme.ui(15, .medium)).foregroundStyle(Theme.textQuiet)
                    .frame(maxWidth: .infinity).padding(.vertical, 13)
                    .background(RoundedRectangle(cornerRadius: 13).fill(Theme.panel2))
            }.padding(16)
        }
        .frame(maxWidth: .infinity)
        .background(Theme.bg)
        .presentationDetents([.height(hasImage ? (allowRemove ? 410 : 360) : 300)])
        .presentationDragIndicator(.hidden)
        .presentationBackground(Theme.bg)
    }

    private func row(_ title: String, _ icon: String, _ sub: String, danger: Bool = false, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 13) {
                ZStack {
                    RoundedRectangle(cornerRadius: 11, style: .continuous)
                        .fill(danger ? Theme.danger.opacity(0.14) : Theme.accentSoft)
                    Image(systemName: icon).font(.system(size: 17)).foregroundStyle(danger ? Theme.danger : Theme.accent)
                }.frame(width: 42, height: 42)
                VStack(alignment: .leading, spacing: 2) {
                    Text(loc: title).font(Theme.ui(15.5, .medium)).foregroundStyle(danger ? Theme.danger : Theme.text)
                    Text(loc: sub).font(Theme.ui(11.5)).foregroundStyle(Theme.muted)
                }
                Spacer()
                Image(systemName: "chevron.right").font(.system(size: 12, weight: .semibold)).foregroundStyle(Theme.muted2)
            }
            .padding(.horizontal, 13).padding(.vertical, 10)
            .background(RoundedRectangle(cornerRadius: 13).fill(Theme.panel))
            .overlay(RoundedRectangle(cornerRadius: 13).stroke(Theme.line, lineWidth: 1))
            .contentShape(Rectangle())
        }.buttonStyle(PressableStyle())
    }
}

/// 可编辑「换图」控件:展示当前图(磨砂笔触按钮)+ 定制操作单。upload/generate 由调用方绑定端点。
struct ImageSetControl: View {
    let base: String
    let currentURL: String?
    let style: ServerImageStyle
    var width: CGFloat = 96
    var canEdit: Bool = true
    var label: String? = nil
    var placeholderIcon: String = "photo"
    var upload: (Data, String) async throws -> String
    var generate: (String, String) async throws -> String
    var remove: (() async throws -> Void)? = nil
    var onUpdated: (String?) -> Void

    @State private var photoItem: PhotosPickerItem?
    @State private var showActions = false
    @State private var showPhoto = false
    @State private var showGen = false
    @State private var showLightbox = false
    @State private var pending: ImageAction?
    @State private var busy = false
    @State private var err: String?

    private var hasImage: Bool { (currentURL ?? "").isEmpty == false }
    private var shape: AnyShape { plateShape(style) }
    private var height: CGFloat { style.aspect == 1 ? width : width / style.aspect }

    var body: some View {
        VStack(spacing: 8) {
            ZStack(alignment: .bottomTrailing) {
                Button { tap() } label: {
                    ZStack {
                        ServerImageThumb(base: base, path: currentURL, style: style, width: width, placeholderIcon: placeholderIcon)
                        if busy {
                            shape.fill(.black.opacity(0.45)).frame(width: width, height: height)
                            ProgressView().tint(.white)
                        } else if !hasImage && canEdit {
                            // 空态提示「点此添加」
                            VStack(spacing: 3) {
                                Image(systemName: "plus").font(.system(size: width * 0.18, weight: .semibold))
                                if width >= 80 { Text(loc: "添加").font(Theme.ui(11)) }
                            }.foregroundStyle(Theme.accent.opacity(0.9))
                        }
                    }
                }.buttonStyle(PressableStyle()).disabled(busy)

                if canEdit && hasImage {
                    let badge = max(22, width * 0.28)
                    Image(systemName: "camera.fill").font(.system(size: max(9, width * 0.12), weight: .semibold))
                        .foregroundStyle(Theme.onAccent)
                        .frame(width: badge, height: badge)
                        .background(Circle().fill(Theme.accent))
                        .overlay(Circle().stroke(Theme.bg, lineWidth: 2))
                        .shadow(color: .black.opacity(0.3), radius: 3, y: 1)
                        .offset(x: 4, y: 4)
                        .allowsHitTesting(false)
                }
            }
            if let label { Text(loc: label).font(Theme.ui(11.5)).foregroundStyle(Theme.muted) }
            if let err { Text(err).font(Theme.ui(11)).foregroundStyle(Theme.danger).multilineTextAlignment(.center) }
        }
        .photosPicker(isPresented: $showPhoto, selection: $photoItem, matching: .images)
        .onChange(of: photoItem) { _, item in if let item { handlePhoto(item) } }
        .sheet(isPresented: $showActions, onDismiss: runPending) {
            ImageActionSheet(title: label ?? "更换图片", hasImage: hasImage, allowRemove: remove != nil) { act in
                pending = act; showActions = false
            }
        }
        .sheet(isPresented: $showGen) {
            GenImageSheet(suggestedStyle: style.genKind) { prompt, size in runGenerate(prompt, size) }
        }
        .fullScreenCover(isPresented: $showLightbox) {
            if let u = currentURL, !u.isEmpty { ImageLightbox(base: base, path: u) }
        }
    }

    private func tap() {
        if canEdit { showActions = true }
        else if hasImage { showLightbox = true }
    }
    private func runPending() {
        guard let p = pending else { return }
        pending = nil
        switch p {
        case .photo: showPhoto = true
        case .generate: showGen = true
        case .view: showLightbox = true
        case .remove:
            Task { busy = true; defer { busy = false }
                do { try await remove?(); onUpdated(nil) } catch { err = (error as? LocalizedError)?.errorDescription } }
        }
    }
    private func handlePhoto(_ item: PhotosPickerItem) {
        Task {
            busy = true; err = nil; defer { busy = false }
            guard let data = try? await item.loadTransferable(type: Data.self) else { err = "读取图片失败"; photoItem = nil; return }
            let jpeg = UIImage(data: data)?.jpegData(compressionQuality: 0.85) ?? data
            do { onUpdated(try await upload(jpeg, "image/jpeg")) }
            catch { err = (error as? LocalizedError)?.errorDescription ?? "上传失败" }
            photoItem = nil
        }
    }
    private func runGenerate(_ prompt: String, _ size: String) {
        Task {
            busy = true; err = nil; defer { busy = false }
            do { onUpdated(try await generate(prompt, size)) }
            catch { err = (error as? LocalizedError)?.errorDescription ?? "生成失败" }
        }
    }
}

// ── AI 生成单(重设计 · 可视比例版面 + 风格便签)──
struct GenImageSheet: View {
    @Environment(\.dismiss) private var dismiss
    var suggestedStyle: String = "chat"   // cover/avatar/chat — 仅用于默认比例
    var onGenerate: (String, String) -> Void

    @State private var prompt = ""
    @State private var size = ""
    @State private var styleHint: String?

    private let ratios: [(id: String, name: String, w: CGFloat, h: CGFloat)] = [
        ("1024x1024", "方形", 1, 1), ("832x1216", "竖图", 3, 4), ("1216x832", "横图", 4, 3),
    ]
    private let styles = ["写实", "动漫", "油画", "电影感", "水彩", "赛博朋克"]

    var body: some View {
        NavigationStack {
            ZStack {
                WarmBackground()
                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        section("画面描述") {
                            ZStack(alignment: .topLeading) {
                                if prompt.isEmpty {
                                    Text(loc: "例如:暮色里的废墟天台,少女独坐,远处霓虹微光…")
                                        .font(Theme.ui(14)).foregroundStyle(Theme.muted2)
                                        .padding(.horizontal, 14).padding(.vertical, 13)
                                }
                                TextEditor(text: $prompt).font(Theme.ui(14.5)).foregroundStyle(Theme.text).tint(Theme.accent)
                                    .scrollContentBackground(.hidden).padding(9).frame(height: 132)
                            }
                            .background(RoundedRectangle(cornerRadius: 14).fill(Theme.panel))
                            .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.line, lineWidth: 1))
                        }
                        section("比例") {
                            HStack(spacing: 12) {
                                ForEach(ratios, id: \.id) { r in ratioPlate(r) }
                                Spacer()
                            }
                        }
                        section("风格(可选)") {
                            FlowChips(styles, selected: styleHint) { s in styleHint = (styleHint == s) ? nil : s }
                        }
                        Button { fire() } label: {
                            HStack(spacing: 7) {
                                Image(systemName: "sparkles").font(.system(size: 15))
                                Text(loc: "生成画面").font(Theme.ui(16, .semibold))
                            }
                            .foregroundStyle(Theme.onAccent).frame(maxWidth: .infinity).padding(.vertical, 15)
                            .background(canFire ? Theme.accent : Theme.panel3, in: RoundedRectangle(cornerRadius: 15))
                            .shadow(color: canFire ? Theme.accent.opacity(0.35) : .clear, radius: 12, y: 5)
                        }.disabled(!canFire)
                        Text(loc: "需先在「我的 → 模型与密钥」配置生图模型与 Key。")
                            .font(Theme.ui(11)).foregroundStyle(Theme.muted2)
                        Spacer(minLength: 8)
                    }.padding(18).frame(maxWidth: 520).frame(maxWidth: .infinity)
                }
            }
            .navigationTitle(Text(loc: "生成图片")).navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Theme.bg, for: .navigationBar).toolbarBackground(.visible, for: .navigationBar)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button(tr("取消")) { dismiss() }.foregroundStyle(Theme.textQuiet) } }
            .onAppear { if size.isEmpty { size = defaultRatio } }
        }
    }

    private var defaultRatio: String { suggestedStyle == "cover" ? "832x1216" : "1024x1024" }
    private var canFire: Bool { !prompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
    private func fire() {
        var p = prompt.trimmingCharacters(in: .whitespacesAndNewlines)
        if let s = styleHint { p += "，\(s)风格" }
        guard !p.isEmpty else { return }
        onGenerate(p, size.isEmpty ? defaultRatio : size); dismiss()
    }

    private func section<C: View>(_ title: String, @ViewBuilder _ content: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 9) {
            Text(loc: title).font(Theme.ui(11, .semibold)).foregroundStyle(Theme.accent).tracking(1.4)
            content()
        }
    }
    private func ratioPlate(_ r: (id: String, name: String, w: CGFloat, h: CGFloat)) -> some View {
        let on = (size.isEmpty ? defaultRatio : size) == r.id
        let base: CGFloat = 30
        return Button { size = r.id } label: {
            VStack(spacing: 7) {
                RoundedRectangle(cornerRadius: 4, style: .continuous)
                    .fill(on ? Theme.accent : Theme.panel3)
                    .frame(width: base * r.w / max(r.w, r.h), height: base * r.h / max(r.w, r.h))
                    .frame(width: base, height: base)
                    .overlay(RoundedRectangle(cornerRadius: 4).stroke(on ? Theme.accent : Theme.line, lineWidth: 1))
                Text(loc: r.name).font(Theme.ui(11.5, .medium)).foregroundStyle(on ? Theme.accent : Theme.muted)
            }
            .frame(width: 64).padding(.vertical, 10)
            .background(RoundedRectangle(cornerRadius: 12).fill(on ? Theme.accentSoft : Theme.panel))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(on ? Theme.accentEdge : Theme.line, lineWidth: 1))
        }.buttonStyle(PressableStyle())
    }
}

// 风格便签流式布局(单选)
private struct FlowChips: View {
    let items: [String]; let selected: String?; let onTap: (String) -> Void
    init(_ items: [String], selected: String?, onTap: @escaping (String) -> Void) {
        self.items = items; self.selected = selected; self.onTap = onTap
    }
    var body: some View {
        // 两行简单换行
        let rows = stride(from: 0, to: items.count, by: 3).map { Array(items[$0..<min($0+3, items.count)]) }
        VStack(alignment: .leading, spacing: 8) {
            ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                HStack(spacing: 8) {
                    ForEach(row, id: \.self) { s in
                        let on = selected == s
                        Button { onTap(s) } label: {
                            Text(loc: s).font(Theme.ui(13, .medium)).foregroundStyle(on ? Theme.onAccent : Theme.textQuiet)
                                .padding(.horizontal, 14).padding(.vertical, 8)
                                .background(Capsule().fill(on ? Theme.accent : Theme.panel2))
                                .overlay(Capsule().stroke(on ? Theme.accent : Theme.line, lineWidth: 1))
                        }.buttonStyle(PressableStyle())
                    }
                    Spacer()
                }
            }
        }
    }
}
