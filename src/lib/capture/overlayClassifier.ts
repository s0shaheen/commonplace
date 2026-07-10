// Pure overlay classifier: overlay FACTS in, VERDICT out (OVLY-01, capture-resilience §6.6).
//
// The content-script glue does every DOM read (finds the topmost dialog, extracts its text and
// button labels, probes a test scroll) and hands us plain facts. Nothing in here touches the DOM,
// the clock, or an RNG — so this is a deterministic unit test, not a vibe (invariant §5.1: every
// decision lives in a pure module behind thin glue).
//
// Live evidence (2026-07-10): TikTok's ~1hr screen-time reminder ("Okay → enter passcode" / "Snooze"
// 10-min) swallowed scroll input and killed two capture runs — the loop couldn't tell "a modal is
// eating my input" from "TikTok stopped responding." Same class: captcha overlays, cookie/login nags.
// The fix is to CLASSIFY the overlay and respond like a person: snooze the reminder (NEVER type the
// passcode — that self-control choice stays human), route captcha to the challenge path, pause+notify
// on anything unknown.

export type OverlayKind =
  | "none"
  | "screen_time"
  | "captcha"
  | "login_wall"
  | "cookie_consent"
  | "unknown_blocking";

export interface OverlayFacts {
  /** A modal/dialog-ish element currently sits over the page. */
  hasBlockingLayer: boolean;
  /** Visible text of the topmost dialog/overlay (lowercased by the glue is fine; treated case-insensitively). */
  overlayText: string;
  /** Accessible/button labels found inside the overlay, in DOM order. */
  buttonLabels: string[];
  /** True if the glue saw a captcha-shaped container (iframe/src or known container attrs) — a strong signal. */
  captchaContainerPresent: boolean;
  /** True if a test scroll issued by the glue moved scrollTop by ~0 while hasBlockingLayer — input is being swallowed. */
  inputSwallowed: boolean;
}

export type OverlayAction =
  | { kind: "none" }
  | { kind: "snooze"; buttonLabel: string } // click this button (the Snooze/Not now control) — glue clicks by matching label
  | { kind: "challenge" } // hand to A4's captcha challenge path: pause+notify+auto-resume
  | { kind: "dismiss"; buttonLabel: string } // benign cookie/consent: click accept/dismiss to proceed
  | { kind: "pause_notify"; reason: string }; // unknown input-swallowing overlay: stop, surface a human-readable reason

export interface OverlayVerdict {
  overlay: OverlayKind;
  action: OverlayAction;
}

// Human-readable pause reasons (kept as consts so glue/tests reference the same strings verbatim).
export const PAUSE_REASON = {
  /** Recognized screen-time reminder whose only remaining path is a passcode. We NEVER type it. */
  passcode: "screen-time passcode required — enter it yourself to continue",
  login: "login wall — sign in to continue",
  unknown: "an unrecognized overlay is blocking capture",
} as const;

// Keyword/regex sets per kind. Exported so the integrator/reviewer can sanity-check against real
// TikTok copy without importing the classifier's internals piecemeal.
export const OVERLAY_PATTERNS = {
  /** Captcha container/text/buttons. Wins over everything — never auto-click through a captcha. */
  captcha: /captcha|verify|puzzle|slide to|are you a human|drag the/i,
  /** Screen-time reminder copy ("you've been on tiktok", "take a break", "screen time"). */
  screenTime:
    /screen[\s-]?time|time reminder|time limit|you'?ve been on tiktok|you have been on tiktok|take a break|been scrolling for/i,
  /** A numeric passcode step. Matching it NEVER produces a passcode-entry action — only pause_notify. */
  passcode: /pass[\s-]?code|numeric code|\d[\s-]?digit code/i,
  /** The benign "snooze/not now" controls we may auto-click on a screen-time reminder. */
  snooze: /snooze|not now|keep watching|remind me later/i,
  /** Cookie/consent copy. */
  cookie: /cookie|consent|we use cookies|privacy preferences|manage preferences/i,
  /** The accept/allow control that makes a cookie banner benign-dismissable. */
  accept: /accept all|accept|allow all|allow|agree|got it|i agree|i understand/i,
  /** Login/signup wall copy. */
  login: /log[\s-]?in|sign[\s-]?in|sign[\s-]?up|continue with (google|apple|facebook|email|phone)|create account/i,
  /** A benign escape from a login wall ("not now", "continue as guest", close). */
  loginDismiss: /not now|continue as guest|continue without|maybe later|skip for now|skip|close|dismiss/i,
} as const;

/**
 * Classify a blocking overlay and pick a person-like response.
 *
 * Precedence (tested): captcha container > screen_time(text+snooze) > cookie_consent > login_wall >
 * unknown_blocking(only if input is swallowed) > none. Captcha is checked FIRST and overrides even a
 * missing blocking-layer flag — pausing to a challenge is always safe, whereas scrolling through a
 * captcha is not, so a captcha-shaped container is honored as a standalone strong signal.
 *
 * SAFETY (OVLY-01): no OverlayAction variant can carry or enter a passcode. The passcode-only
 * screen-time step therefore resolves to pause_notify — the human decides whether to enter it.
 */
export function classifyOverlay(facts: OverlayFacts): OverlayVerdict {
  const { hasBlockingLayer, captchaContainerPresent, inputSwallowed } = facts;
  const text = (facts.overlayText ?? "").toLowerCase();
  const labels = facts.buttonLabels ?? [];
  const p = OVERLAY_PATTERNS;

  // 1. CAPTCHA — highest precedence; wins over everything (never auto-click through a captcha).
  //    A captcha-shaped container is a strong standalone signal, honored even absent a blocking flag.
  const captchaByText = hasBlockingLayer && (p.captcha.test(text) || labels.some((l) => p.captcha.test(l)));
  if (captchaContainerPresent || captchaByText) {
    return { overlay: "captcha", action: { kind: "challenge" } };
  }

  // Nothing below acts unless a layer is actually blocking the page.
  if (!hasBlockingLayer) {
    return { overlay: "none", action: { kind: "none" } };
  }

  // 2. SCREEN-TIME reminder / passcode step.
  const snoozeLabel = labels.find((l) => p.snooze.test(l));
  if (p.screenTime.test(text) || p.passcode.test(text)) {
    if (snoozeLabel) {
      // The benign, recurring reminder — snooze it (glue re-arms ~10-min; each snooze is counted + logged).
      return { overlay: "screen_time", action: { kind: "snooze", buttonLabel: snoozeLabel } };
    }
    // Recognized screen-time / passcode step with NO snooze control: the only way forward is the
    // passcode. We NEVER type it — hand the self-control decision back to the human.
    return { overlay: "screen_time", action: { kind: "pause_notify", reason: PAUSE_REASON.passcode } };
  }

  // 3. COOKIE / CONSENT — benign when an accept/allow control exists to click through.
  const acceptLabel = labels.find((l) => p.accept.test(l));
  const isCookie = p.cookie.test(text) || labels.some((l) => p.cookie.test(l));
  if (isCookie && acceptLabel) {
    return { overlay: "cookie_consent", action: { kind: "dismiss", buttonLabel: acceptLabel } };
  }

  // 4. LOGIN WALL — dismiss via a guest/close control if one exists; otherwise pause+notify.
  const isLogin = p.login.test(text) || labels.some((l) => p.login.test(l));
  if (isLogin) {
    const escapeLabel = labels.find((l) => p.loginDismiss.test(l));
    if (escapeLabel) {
      return { overlay: "login_wall", action: { kind: "dismiss", buttonLabel: escapeLabel } };
    }
    return { overlay: "login_wall", action: { kind: "pause_notify", reason: PAUSE_REASON.login } };
  }

  // 5. UNKNOWN BLOCKING — only when input is actually being swallowed (don't over-trigger on benign
  //    decorative overlays). This is the leg that catches the failure that killed the live runs.
  if (inputSwallowed) {
    return { overlay: "unknown_blocking", action: { kind: "pause_notify", reason: PAUSE_REASON.unknown } };
  }

  // 6. A blocking-but-not-input-swallowing, unrecognized layer → treat as benign; don't pause the run.
  return { overlay: "none", action: { kind: "none" } };
}
