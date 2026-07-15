import SwiftUI
import PhotosUI
import UniformTypeIdentifiers

// 聊天附件 + 生图 —— 游戏台与酒馆共用。

struct ChatAttachment: Identifiable, Equatable {
    let id = UUID()
    var name: String
    var mime: String
    var dataURL: String     // data:<mime>;base64,xxxx
    var kind: String        // image | file
    var isImage: Bool { kind == "image" || mime.hasPrefix("image/") }
    // /api/chat 期望的 attachment 结构(与 web 一致)
    var bodyDict: [String: Any] { ["name": name, "type": mime, "data_url": dataURL, "kind": kind] }
}

func makeDataURL(_ data: Data, mime: String) -> String { "data:\(mime);base64,\(data.base64EncodedString())" }

func uiImageFromDataURL(_ s: String) -> UIImage? {
    let b64: String
    if let comma = s.firstIndex(of: ",") { b64 = String(s[s.index(after: comma)...]) } else { b64 = s }
    guard let d = Data(base64Encoded: b64) else { return nil }
    return UIImage(data: d)
}

func absoluteImageURL(base: String, path: String) -> URL? {
    if path.hasPrefix("http") { return URL(string: path) }
    var b = base.trimmingCharacters(in: .whitespaces)
    if b.hasSuffix("/") { b.removeLast() }
    return URL(string: b + (path.hasPrefix("/") ? path : "/" + path))
}

// 输入框上方的附件 chip 条
struct AttachChipsStrip: View {
    let attachments: [ChatAttachment]
    var onRemove: (ChatAttachment) -> Void
    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(attachments) { a in
                    HStack(spacing: 6) {
                        if a.isImage, let img = uiImageFromDataURL(a.dataURL) {
                            Image(uiImage: img).resizable().scaledToFill().frame(width: 26, height: 26).clipShape(RoundedRectangle(cornerRadius: 6))
                        } else {
                            Image(systemName: "doc.text").font(.system(size: 13)).foregroundStyle(Theme.muted)
                        }
                        Text(a.name).font(Theme.ui(11.5)).foregroundStyle(Theme.text).lineLimit(1).frame(maxWidth: 110)
                        Button { onRemove(a) } label: { Image(systemName: "xmark.circle.fill").font(.system(size: 13)).foregroundStyle(Theme.muted2) }
                    }
                    .padding(.horizontal, 8).padding(.vertical, 5)
                    .background(Capsule().fill(Theme.panel2)).overlay(Capsule().stroke(Theme.line, lineWidth: 1))
                }
            }.padding(.horizontal, 14)
        }
        .padding(.bottom, 6)
    }
}

// 消息气泡里渲染本地附件缩略图
struct AttachThumbsView: View {
    let thumbs: [String]
    var body: some View {
        let imgs = thumbs.compactMap { uiImageFromDataURL($0) }
        if !imgs.isEmpty {
            HStack(spacing: 6) {
                ForEach(Array(imgs.enumerated()), id: \.offset) { _, img in
                    Image(uiImage: img).resizable().scaledToFill().frame(width: 90, height: 90)
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                        .overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.line, lineWidth: 1))
                }
            }
        }
    }
}

// 注:ServerImageView / GenImageSheet 已迁至 ImageKit.swift(装帧重设计版),此处不再定义。

// 把 PhotosPickerItem / 文件 URL 转成 ChatAttachment
enum AttachLoader {
    static func fromPhoto(_ item: PhotosPickerItem) async -> ChatAttachment? {
        guard let data = try? await item.loadTransferable(type: Data.self) else { return nil }
        // 压缩到合理尺寸,避免 base64 过大
        let mime = "image/jpeg"
        let jpeg = UIImage(data: data)?.jpegData(compressionQuality: 0.82) ?? data
        let name = (item.itemIdentifier ?? "image") + ".jpg"
        return ChatAttachment(name: name, mime: mime, dataURL: makeDataURL(jpeg, mime: mime), kind: "image")
    }
    static func fromFileURL(_ url: URL) -> ChatAttachment? {
        let access = url.startAccessingSecurityScopedResource()
        defer { if access { url.stopAccessingSecurityScopedResource() } }
        guard let data = try? Data(contentsOf: url) else { return nil }
        if data.count > 12 * 1024 * 1024 { return nil }
        let mime = UTType(filenameExtension: url.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
        let kind = mime.hasPrefix("image/") ? "image" : "file"
        return ChatAttachment(name: url.lastPathComponent, mime: mime, dataURL: makeDataURL(data, mime: mime), kind: kind)
    }
}
