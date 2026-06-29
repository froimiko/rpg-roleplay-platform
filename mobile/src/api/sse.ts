/**
 * SSE-over-POST for the GM turn loop (POST /api/v1/chat, /api/v1/opening).
 *
 * react-native-sse supports POST bodies + custom headers over XHR, which is what we
 * need since the backend streams `text/event-stream` from a POST and auth rides on the
 * manually-attached rpg_session cookie. Native EventSource (GET-only) cannot do this.
 */
import EventSource from "react-native-sse";
import { baseUrl } from "./http";
import { getSessionCookie } from "./storage";

export type SseEventName =
  | "status"
  | "stage"
  | "token"
  | "tool_call"
  | "tool_result"
  | "confirmation_required"
  | "usage"
  | "system_receipt"
  | "worldbook_consulting"
  | "worldbook_ready"
  | "error"
  | "done";

export type SseHandlers = Partial<Record<SseEventName, (data: any) => void>> & {
  onOpen?: () => void;
  onError?: (err: { message: string; status?: number }) => void;
  onClose?: () => void;
};

export type SseController = { close: () => void };

const CUSTOM_EVENTS: SseEventName[] = [
  "status",
  "stage",
  "token",
  "tool_call",
  "tool_result",
  "confirmation_required",
  "usage",
  "system_receipt",
  "worldbook_consulting",
  "worldbook_ready",
  "error",
  "done",
];

function parseData(raw: string | null | undefined): any {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export async function streamPost(
  path: string,
  body: Record<string, unknown>,
  handlers: SseHandlers,
): Promise<SseController> {
  const base = await baseUrl();
  const cookie = await getSessionCookie();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
  };
  if (cookie) headers.Cookie = cookie;

  const es = new EventSource(base + path, {
    method: "POST",
    headers,
    body: JSON.stringify(body || {}),
    // The stream stays open for the whole turn; disable the library's idle timeout.
    timeout: 0,
    timeoutBeforeConnection: 0,
    pollingInterval: 0,
  });

  es.addEventListener("open", () => handlers.onOpen?.());

  for (const name of CUSTOM_EVENTS) {
    es.addEventListener(name as any, (event: any) => {
      const data = parseData(event?.data);
      handlers[name]?.(data);
      if (name === "done") {
        es.close();
        handlers.onClose?.();
      }
    });
  }

  es.addEventListener("error", (event: any) => {
    handlers.onError?.({
      message: event?.message || "流式连接出错",
      status: event?.xhrStatus,
    });
  });

  return {
    close: () => {
      try {
        es.close();
      } catch {
        /* noop */
      }
    },
  };
}
