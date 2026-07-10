// Pure overlay classifier (OVLY-01, capture-resilience §6.6). Facts in, verdict out — driven with
// fixed inputs only. The most load-bearing test here is the passcode-safety sweep: the classifier
// must be STRUCTURALLY incapable of emitting an action that types/submits a screen-time passcode.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  classifyOverlay,
  PAUSE_REASON,
  OVERLAY_PATTERNS,
  type OverlayFacts,
  type OverlayVerdict,
} from "./overlayClassifier.js";

// A neutral, non-blocking baseline; each test overrides only the fields it exercises.
const base: OverlayFacts = {
  hasBlockingLayer: false,
  overlayText: "",
  buttonLabels: [],
  captchaContainerPresent: false,
  inputSwallowed: false,
};
const facts = (over: Partial<OverlayFacts>): OverlayFacts => ({ ...base, ...over });

describe("classifyOverlay — one per kind", () => {
  it("no blocking layer ⇒ none", () => {
    const v = classifyOverlay(facts({ hasBlockingLayer: false, overlayText: "you've been on tiktok" }));
    expect(v).toEqual<OverlayVerdict>({ overlay: "none", action: { kind: "none" } });
  });

  it("screen-time reminder WITH a Snooze control ⇒ screen_time + snooze(matched label)", () => {
    const v = classifyOverlay(
      facts({
        hasBlockingLayer: true,
        overlayText: "You've been on TikTok for a while. Time for a screen time break?",
        buttonLabels: ["Okay", "Snooze"],
        inputSwallowed: true,
      }),
    );
    expect(v).toEqual<OverlayVerdict>({
      overlay: "screen_time",
      action: { kind: "snooze", buttonLabel: "Snooze" },
    });
  });

  it("captcha container ⇒ captcha + challenge (route to A4's pause/notify/auto-resume)", () => {
    const v = classifyOverlay(facts({ hasBlockingLayer: true, captchaContainerPresent: true, inputSwallowed: true }));
    expect(v).toEqual<OverlayVerdict>({ overlay: "captcha", action: { kind: "challenge" } });
  });

  it("captcha by text/buttons (no container flag) ⇒ captcha + challenge", () => {
    const v = classifyOverlay(
      facts({
        hasBlockingLayer: true,
        overlayText: "Verify to continue — drag the puzzle piece into place",
        buttonLabels: ["Slide to verify"],
        inputSwallowed: true,
      }),
    );
    expect(v).toEqual<OverlayVerdict>({ overlay: "captcha", action: { kind: "challenge" } });
  });

  it("login wall with NO escape control ⇒ login_wall + pause_notify(login reason)", () => {
    const v = classifyOverlay(
      facts({
        hasBlockingLayer: true,
        overlayText: "Log in to TikTok to continue",
        buttonLabels: ["Log in", "Sign up"],
        inputSwallowed: true,
      }),
    );
    expect(v).toEqual<OverlayVerdict>({
      overlay: "login_wall",
      action: { kind: "pause_notify", reason: PAUSE_REASON.login },
    });
  });

  it("login wall WITH a 'Continue as guest' control ⇒ login_wall + dismiss(that label)", () => {
    const v = classifyOverlay(
      facts({
        hasBlockingLayer: true,
        overlayText: "Sign up for TikTok",
        buttonLabels: ["Sign up", "Continue as guest"],
        inputSwallowed: true,
      }),
    );
    expect(v).toEqual<OverlayVerdict>({
      overlay: "login_wall",
      action: { kind: "dismiss", buttonLabel: "Continue as guest" },
    });
  });

  it("cookie consent with an accept control ⇒ cookie_consent + dismiss(accept label)", () => {
    const v = classifyOverlay(
      facts({
        hasBlockingLayer: true,
        overlayText: "We use cookies to improve your experience.",
        buttonLabels: ["Manage", "Accept all"],
      }),
    );
    expect(v).toEqual<OverlayVerdict>({
      overlay: "cookie_consent",
      action: { kind: "dismiss", buttonLabel: "Accept all" },
    });
  });

  it("unknown blocking layer that swallows input ⇒ unknown_blocking + pause_notify(unknown reason)", () => {
    const v = classifyOverlay(
      facts({
        hasBlockingLayer: true,
        overlayText: "Something entirely unrecognized is here",
        buttonLabels: ["???"],
        inputSwallowed: true,
      }),
    );
    expect(v).toEqual<OverlayVerdict>({
      overlay: "unknown_blocking",
      action: { kind: "pause_notify", reason: PAUSE_REASON.unknown },
    });
  });
});

describe("classifyOverlay — passcode safety (OVLY-01: the passcode choice stays human)", () => {
  it("screen-time reminder with ONLY a passcode step (no snooze/dismiss) ⇒ pause_notify, NEVER a passcode action", () => {
    const v = classifyOverlay(
      facts({
        hasBlockingLayer: true,
        overlayText: "Enter passcode to keep watching — screen time limit reached",
        buttonLabels: ["1", "2", "3", "4"],
        inputSwallowed: true,
      }),
    );
    expect(v).toEqual<OverlayVerdict>({
      overlay: "screen_time",
      action: { kind: "pause_notify", reason: PAUSE_REASON.passcode },
    });
  });

  it("a bare numeric passcode prompt (post-'Okay' step) with no snooze ⇒ pause_notify(passcode)", () => {
    const v = classifyOverlay(
      facts({
        hasBlockingLayer: true,
        overlayText: "Enter your passcode",
        buttonLabels: ["Enter passcode", "Submit"],
        inputSwallowed: true,
      }),
    );
    expect(v.action.kind).toBe("pause_notify");
    if (v.action.kind === "pause_notify") expect(v.action.reason).toBe(PAUSE_REASON.passcode);
  });

  // The heart of OVLY-01: exhaustively sweep an adversarial fact-space and assert the classifier can
  // never emit anything that types/submits a passcode. This holds STRUCTURALLY — the OverlayAction
  // union has no passcode-entry variant, and the only label-carrying actions (snooze/dismiss) draw
  // their label from the snooze/accept/loginDismiss sets, never from a passcode/submit control.
  it("NEVER emits a passcode-entering action across an adversarial fact sweep", () => {
    const ALLOWED_KINDS = new Set(["none", "snooze", "challenge", "dismiss", "pause_notify"]);
    // Labels a passcode-submitting control could plausibly carry — must never surface as a click target.
    const PASSCODE_CONTROL = /pass[\s-]?code|submit|confirm|^\s*\d[\s\d]*$|enter code|verify code|done/i;

    const texts = [
      "",
      "you've been on tiktok — enter passcode",
      "screen time limit reached, enter your 4-digit code",
      "numeric code required",
      "enter passcode",
      "log in to continue",
      "we use cookies",
      "verify you are a human",
      "totally unrecognized modal",
    ];
    const labelSets = [
      [],
      ["Enter passcode"],
      ["Submit"],
      ["Confirm"],
      ["1", "2", "3", "4"],
      ["Enter passcode", "Submit passcode"],
      ["Snooze", "Enter passcode"],
      ["Accept all", "Enter passcode"],
      ["Continue as guest", "Submit"],
      ["Okay"],
    ];

    let checked = 0;
    for (const hasBlockingLayer of [true, false]) {
      for (const captchaContainerPresent of [true, false]) {
        for (const inputSwallowed of [true, false]) {
          for (const overlayText of texts) {
            for (const buttonLabels of labelSets) {
              const v = classifyOverlay({
                hasBlockingLayer,
                overlayText,
                buttonLabels,
                captchaContainerPresent,
                inputSwallowed,
              });
              checked++;
              // 1. Only ever one of the five declared action kinds.
              expect(ALLOWED_KINDS.has(v.action.kind)).toBe(true);
              // 2. The only click-target actions (snooze/dismiss) must never point at a passcode control.
              if (v.action.kind === "snooze" || v.action.kind === "dismiss") {
                expect(PASSCODE_CONTROL.test(v.action.buttonLabel)).toBe(false);
                // and it must actually be one of the benign control sets we drew from.
                const benign =
                  OVERLAY_PATTERNS.snooze.test(v.action.buttonLabel) ||
                  OVERLAY_PATTERNS.accept.test(v.action.buttonLabel) ||
                  OVERLAY_PATTERNS.loginDismiss.test(v.action.buttonLabel);
                expect(benign).toBe(true);
              }
              // 3. Any passcode-shaped screen-time step must resolve to pause_notify, never an auto-action.
              if (v.overlay === "screen_time" && v.action.kind !== "snooze") {
                expect(v.action.kind).toBe("pause_notify");
              }
            }
          }
        }
      }
    }
    expect(checked).toBe(2 * 2 * 2 * texts.length * labelSets.length);
  });
});

describe("classifyOverlay — precedence when signals co-occur", () => {
  it("captcha container beats screen-time + snooze + cookie + login (captcha wins over everything)", () => {
    const v = classifyOverlay(
      facts({
        hasBlockingLayer: true,
        overlayText: "you've been on tiktok · we use cookies · log in — verify",
        buttonLabels: ["Snooze", "Accept all", "Log in"],
        captchaContainerPresent: true,
        inputSwallowed: true,
      }),
    );
    expect(v).toEqual<OverlayVerdict>({ overlay: "captcha", action: { kind: "challenge" } });
  });

  it("screen_time (text+snooze) beats cookie_consent when both present", () => {
    const v = classifyOverlay(
      facts({
        hasBlockingLayer: true,
        overlayText: "take a break — screen time. we use cookies too.",
        buttonLabels: ["Snooze", "Accept all"],
        inputSwallowed: true,
      }),
    );
    expect(v).toEqual<OverlayVerdict>({ overlay: "screen_time", action: { kind: "snooze", buttonLabel: "Snooze" } });
  });

  it("cookie_consent beats login_wall when both present", () => {
    const v = classifyOverlay(
      facts({
        hasBlockingLayer: true,
        overlayText: "we use cookies. log in to continue.",
        buttonLabels: ["Accept all", "Log in"],
        inputSwallowed: true,
      }),
    );
    expect(v).toEqual<OverlayVerdict>({ overlay: "cookie_consent", action: { kind: "dismiss", buttonLabel: "Accept all" } });
  });

  it("login_wall beats unknown_blocking even when input is swallowed", () => {
    const v = classifyOverlay(
      facts({
        hasBlockingLayer: true,
        overlayText: "log in to continue",
        buttonLabels: ["Log in"],
        inputSwallowed: true,
      }),
    );
    expect(v).toEqual<OverlayVerdict>({
      overlay: "login_wall",
      action: { kind: "pause_notify", reason: PAUSE_REASON.login },
    });
  });

  it("captcha container overrides even a missing blocking-layer flag (safety-first)", () => {
    const v = classifyOverlay(facts({ hasBlockingLayer: false, captchaContainerPresent: true }));
    expect(v).toEqual<OverlayVerdict>({ overlay: "captcha", action: { kind: "challenge" } });
  });
});

describe("classifyOverlay — don't over-trigger (benign, non-input-swallowing overlays)", () => {
  it("blocking layer present but input NOT swallowed and unrecognized ⇒ none (benign)", () => {
    const v = classifyOverlay(
      facts({
        hasBlockingLayer: true,
        overlayText: "a decorative promo banner sits over the grid",
        buttonLabels: ["Learn more"],
        inputSwallowed: false,
      }),
    );
    expect(v).toEqual<OverlayVerdict>({ overlay: "none", action: { kind: "none" } });
  });

  it("cookie text but no accept control and input NOT swallowed ⇒ none (nothing safe to click, not blocking capture)", () => {
    const v = classifyOverlay(
      facts({
        hasBlockingLayer: true,
        overlayText: "we use cookies — see our privacy preferences",
        buttonLabels: ["Manage preferences"],
        inputSwallowed: false,
      }),
    );
    expect(v).toEqual<OverlayVerdict>({ overlay: "none", action: { kind: "none" } });
  });
});

describe("overlayClassifier module purity (invariant §5.1: pure core, no glue)", () => {
  it("the source reads no DOM, clock, or RNG globals", () => {
    const src = readFileSync(fileURLToPath(new URL("./overlayClassifier.ts", import.meta.url)), "utf8");
    for (const forbidden of ["document", "window", "globalThis", "Date.now", "Math.random", "querySelector", "performance"]) {
      expect(src.includes(forbidden), `module must not reference ${forbidden}`).toBe(false);
    }
  });
});
