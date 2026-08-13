export const deepLinkBridgeEvent = "openwork:deep-link";
export const nativeDeepLinkEvent = "openwork:deep-link-native";

export type DeepLinkBridgeDetail = {
  urls: string[];
};

declare global {
  interface Window {
    __SPRINTNEX__?: {
      deepLinks?: string[];
    };
  }
}

function normalizeDeepLinks(urls: readonly string[]): string[] {
  return urls.flatMap((url) => {
    const trimmed = url.trim();
    return trimmed ? [trimmed] : [];
  });
}

export function pushPendingDeepLinks(target: Window, urls: readonly string[]): string[] {
  const normalized = normalizeDeepLinks(urls);
  if (normalized.length === 0) {
    return [];
  }

  target.__SPRINTNEX__ ??= {};
  const pending = target.__SPRINTNEX__.deepLinks ?? [];
  target.__SPRINTNEX__.deepLinks = [...pending, ...normalized];
  target.dispatchEvent(
    new CustomEvent<DeepLinkBridgeDetail>(deepLinkBridgeEvent, {
      detail: { urls: normalized },
    }),
  );
  return normalized;
}

export function drainPendingDeepLinks(target: Window): string[] {
  const pending = target.__SPRINTNEX__?.deepLinks ?? [];
  if (target.__SPRINTNEX__) {
    target.__SPRINTNEX__.deepLinks = [];
  }
  return [...pending];
}
