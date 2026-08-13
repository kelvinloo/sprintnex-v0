import { INFERENCE_MODEL_ALIASES } from "@sprintnex/types/den/inference";

import {
  buildDenAuthUrl,
  getDenInferenceUrl,
  readDenBootstrapConfig,
  readDenSettings,
} from "../../../app/lib/den";

export const SPRINTNEX_MODELS_PROVIDER_ID = "openwork";
export const SPRINTNEX_MODELS_PROVIDER_NAME = "OpenWork Models";
export const SPRINTNEX_MODELS_PROMO_HIDDEN_KEY = "openwork.openworkModelsPromo.hidden";
export const SPRINTNEX_MODELS_PROMO_LAST_SHOWN_KEY = "openwork.openworkModelsPromo.lastShownAt";
export const SPRINTNEX_MODELS_STARTUP_PROMO_SHOWN_KEY = "openwork.openworkModelsPromo.startupShown";
export const openWorkModelsPromoChangedEvent = "openwork-openwork-models-promo-changed";
export const SPRINTNEX_MODELS_PROMO_SHOW_DELAY_MS = 4_000;
export const SPRINTNEX_MODELS_PROMO_VISIBLE_MS = 14_000;
export const SPRINTNEX_MODELS_PROMO_REPEAT_MS = 6 * 60 * 60 * 1000;

export function areOpenWorkModelsPromosDisabled() {
  return /^(1|true|yes|on)$/i.test(String(import.meta.env.VITE_DISABLE_SPRINTNEX_MODELS ?? "").trim());
}

export type OpenWorkModelPreview = {
  id: string;
  title: string;
  subtitle: string;
};

export const SPRINTNEX_MODEL_PREVIEWS: OpenWorkModelPreview[] = Object.entries(
  INFERENCE_MODEL_ALIASES,
)
  .filter(([, model]) => model.enabled)
  .map(([id, model]) => ({
    id,
    title: model.displayName.replace(/^OpenWork:\s*/, ""),
    subtitle: "OpenWork hosted",
  }));

export function hasOpenWorkModelsProvider(providerIds: readonly string[]) {
  return providerIds.some((id) => id.trim().toLowerCase() === SPRINTNEX_MODELS_PROVIDER_ID);
}

export function getOpenWorkModelsActionUrl(
  isSignedIn: boolean,
  authMode: "sign-in" | "sign-up" = "sign-in",
) {
  const settings = readDenSettings();
  const baseUrl = settings.baseUrl || readDenBootstrapConfig().baseUrl;
  // Signed-in users go straight to the OpenWork Models page — the value-prop
  // + subscribe surface — never to a bare auth or billing page.
  return isSignedIn ? getDenInferenceUrl(baseUrl) : buildDenAuthUrl(baseUrl, authMode);
}

export function isOpenWorkModelsPromoHidden() {
  if (areOpenWorkModelsPromosDisabled()) return true;
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SPRINTNEX_MODELS_PROMO_HIDDEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function hideOpenWorkModelsPromo() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SPRINTNEX_MODELS_PROMO_HIDDEN_KEY, "1");
    window.dispatchEvent(new Event(openWorkModelsPromoChangedEvent));
  } catch {}
}

export function wasOpenWorkModelsStartupPromoShown() {
  if (areOpenWorkModelsPromosDisabled()) return true;
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(SPRINTNEX_MODELS_STARTUP_PROMO_SHOWN_KEY) === "1";
  } catch {
    return true;
  }
}

export function markOpenWorkModelsStartupPromoShown() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SPRINTNEX_MODELS_STARTUP_PROMO_SHOWN_KEY, "1");
  } catch {}
}

export function shouldShowOpenWorkModelsPromo(now = Date.now()) {
  if (areOpenWorkModelsPromosDisabled() || typeof window === "undefined" || isOpenWorkModelsPromoHidden()) return false;
  try {
    const lastShown = Number(window.localStorage.getItem(SPRINTNEX_MODELS_PROMO_LAST_SHOWN_KEY) ?? "0");
    return !Number.isFinite(lastShown) || now - lastShown >= SPRINTNEX_MODELS_PROMO_REPEAT_MS;
  } catch {
    return true;
  }
}

export function markOpenWorkModelsPromoShown(now = Date.now()) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SPRINTNEX_MODELS_PROMO_LAST_SHOWN_KEY, String(now));
  } catch {}
}
