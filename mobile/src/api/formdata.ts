/**
 * Centralized helpers for building FormData payloads that work with both:
 *   - expo-fetch (default in Expo SDK 56) — needs Blob/File entries, not {uri,name,type}
 *   - RN's legacy fetch — accepts {uri,name,type}
 *
 * The trick: expo-file-system's `File` class extends Blob and points at a `file://` URI.
 * When you put it into FormData, expo-fetch's converter happily streams its bytes; RN's
 * native uploader also handles it because the underlying URI is real.
 *
 * Why this exists: when a release build uses expo-fetch and you append a bare
 * `{uri, name, type}` to FormData, the converter throws "Unsupported FormDataPart
 * implementation" because it only accepts string | Blob | { bytes }. Wrapping the URI
 * in `new File(uri)` makes it a Blob.
 */
import { File as ExpoFile } from "expo-file-system";

/**
 * Append a picked file (from DocumentPicker / ImagePicker) to a FormData under the
 * given field name. Internally constructs an `expo-file-system.File` (a Blob-like)
 * so the upload works regardless of which fetch implementation is active.
 *
 * The `name` / `type` are passed through for legacy compatibility but the Blob's own
 * internal URI is what actually streams.
 */
export function appendFile(
  form: FormData,
  field: string,
  asset: { uri: string; name?: string | null; mimeType?: string | null; type?: string | null },
) {
  const filename = asset.name || (asset.uri.split("/").pop() ?? "upload.bin");
  const mime = asset.mimeType || asset.type || "application/octet-stream";

  try {
    const f = new ExpoFile(asset.uri);
    // Some callers / picker results give "content://" or non-file URIs; in those cases
    // ExpoFile is still happy to wrap them but exposing them as a Blob is enough.
    // Patch name/type so multipart boundary headers carry the correct filename.
    (f as any).name = filename;
    (f as any).type = mime;
    form.append(field, f as any);
  } catch {
    // Fallback to the legacy RN shape if File construction fails for some reason.
    form.append(field, { uri: asset.uri, name: filename, type: mime } as any);
  }
}
