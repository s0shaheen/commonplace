# Privacy Policy — Commonplace

_Last updated: 2026-07-09_

Commonplace is a local-first browser extension for building a private, structured archive of the
short-form videos you save. This policy explains what the extension does and does not do with your
data. It is written to be read, not to be survived.

## The short version

**We can't read your library. That's the architecture, not a promise.** Your saved content, the
analysis of it, and everything you export live on your own device. Commonplace has no account
system and no server that stores your library.

## Local-first architecture

- Your library — captured videos' metadata, posters, structured analysis, and grounded entities —
  is stored **on your own machine** using the browser's local storage. It is not uploaded to us.
- Capturing your saved videos and exporting your library work entirely locally and never require an
  account or a key.
- **Export is yours.** Your library exports to an open, documented schema — plain files you keep,
  open in any tool, or take to any other app. There is no lock-in and no paywall on your own data.

## Bring your own key (optional)

Deeper analysis runs through an AI model you choose:

- You can run a **fully local model**, in which case nothing about your content leaves your machine.
- Or you can supply **your own provider key** (for a managed model such as Google's Gemini API).
  In that case: the key is **stored locally on your device**, is used **only to make your own
  analysis requests**, and is never transmitted to Commonplace. When you use a managed model, the
  content of the specific item being analyzed is sent to **that provider** under their terms — the
  same as if you called the provider yourself. Basic capture and export never use a key.

## Telemetry posture

Our telemetry posture is published and deliberately narrow. Verbatim from the product specification
(SPEC §25):

> telemetry = three planes that never touch extension content (cookieless doorway analytics + CWS
> stats + managed-tier server events) + an opt-in default-OFF content-free adapter-health ping + a
> visible "report broken capture" flow, posture published, unmeasured free-tier engagement accepted

In plain terms: the three telemetry planes are our public marketing site's cookieless analytics,
the aggregate install/usage stats Chrome Web Store reports to us, and server events that exist only
for paid managed-tier accounts — **none of these ever touch the content of your extension library.**
The adapter-health ping (does capture still work on a given site) is **opt-in and off by default**
and carries **no content**. The "report broken capture" flow is visible and user-initiated. We
accept not measuring free-tier engagement as the cost of this posture.

## No sale of data

We do **not** sell your data, and we do not share your library or personal content with third
parties for advertising or any other purpose. There is no library data for us to sell — it is on
your device.

## Data you can remove

Because your library is local, uninstalling the extension or clearing its storage removes it. Your
exported files are yours to keep or delete as you wish.

## Changes to this policy

If this policy changes, the updated version will be posted at the same URL with a revised date above.

## Contact

Questions about this policy or your data: **hello@commonplacehq.com**.

<!-- Contact address pending founder confirmation — see checklist.md. Derived from the project's
     commonplacehq.com domain (SPEC §22 / KB User-Agent); replace if a dedicated support address is set. -->
