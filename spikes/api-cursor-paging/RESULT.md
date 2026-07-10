# Spike: API-cursor paging (no-scroll capture) — VERDICT: POSSIBLE, BUT A BAD TRADE (not the primary path)

**Question (2026-07-10):** can we capture a saved list by paging TikTok's `item_list` JSON API by `cursor` directly — no DOM scrolling — for a near-instant, stutter-free 10x?

## What a real request actually requires
A live `post/item_list` request (captured, own profile) carries **38 params**, of which the load-bearing anti-bot signature surface is:

| param | role |
|---|---|
| `X-Bogus` | classic TikTok web signature (double-MD5 + RC4 + shifted base64) over the param string |
| `X-Gnarly` | **newer** (webmssdk/secsdk, ~2023+) signature — ChaCha20-based, VM-obfuscated, version-pinned |
| `msToken` | rotating session token |
| `verifyFp` | browser fingerprint token |

All are computed over the full query string **including `cursor`** — so swapping the cursor invalidates the signature. Page N+1 needs `X-Bogus` **and** `X-Gnarly` **and** a valid `msToken` recomputed. (Corroboration from prior art below: a garbage/absent signature returns **HTTP 200 with an empty body** — the exact shape of our SESS-01 "flagged-session empty-200." So some empty-200s are a signature/token-freshness symptom, not only a soft-flag.)

## Prior art (grounded)
X-Gnarly HAS been fully reverse-engineered in public (pure-JS encoders exist), so it's not impossible. But the cost is telling: these projects describe **"months of reverse-engineering TikTok's JavaScript VM"** (77 opcodes mapped, bytecode disassembly), and each signer is **pinned to a specific webmssdk version** (e.g. `5.1.3-ZTCA`) — i.e. it **breaks whenever TikTok bumps the bundle**. This is the "rotation tax" our IG-live spike already hit ("constructing requests → 400s → passive-observe only"), and the project's standing stance (network-is-truth via *passive interception*, not request *construction*).

## Two ways to sign, both bad for us
1. **Import/maintain a full X-Bogus + X-Gnarly signer** → a continuous cat-and-mouse pinned to TikTok's current VM; breaks on their update cadence. For a solo-maintained (~10–20 hr/wk) open-core product, this is a recurring time sink that would leave capture broken between patches — unacceptable as the PRIMARY path.
2. **Call TikTok's own in-page signer** (let their JS sign for us) → avoids the RE, but the signer is closure/VM-hidden (not reliably window-exposed), fragile, and still version-fragile. (Read-only signer-reachability probe not run — the founder's TikTok tab was closed and we won't reopen his browser; run it opportunistically during the Track-1 live smoke when a tab is already open. Even a "yes it's callable" only upgrades this to "fragile", not "robust".)

## Verdict
**Do NOT make API-cursor paging the primary capture path.** It trades a robust, zero-maintenance approach — let TikTok's own page sign + fetch as we scroll, and just scroll *fast* (Track 1: continuous smooth scroll) — for a brittle signature cat-and-mouse. The reason we wanted the API path was SPEED; Track 1 recovers most of that speed (scroll as fast as content loads, no artificial dwells). **Ship Track 1, measure its real wall-clock on a ~10k list, and revisit API paging only if Track 1's measured speed is still unacceptable AND we accept owning the signer maintenance.**

## Sources
- carcabot/tiktok-xgnarly-decoded — full X-Gnarly RE (webmssdk 5.1.3-ZTCA), pure-JS encoder/decoder
- justbeluga/tiktok-web-reverse-engineering — X-Bogus & X-Gnarly, strData/eData encrypt/decrypt
- notemrovsky/tiktok-reverse-engineering — TikTok JS VM (77 opcodes, bytecode disassembly)
- autodev.blog "Reverse Engineering TikTok's Web Protection"
