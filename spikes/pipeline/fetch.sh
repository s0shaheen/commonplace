#!/usr/bin/env bash
# Spike #3 media harvest — fetch still-live TikTok saves (video + subs + metadata) for the
# native-video-vs-[VTT+keyframes+OCR] pipeline experiment. Stops at TARGET successes.
set -u
cd "$(dirname "$0")"
CAND="candidates.json"; OUT="media"; MANIFEST="manifest.jsonl"; TARGET=60
: > "$MANIFEST"
n=$(jq 'length' "$CAND"); ok=0; dead=0; i=0
echo "[fetch] $n candidates, target $TARGET live"
while [ "$i" -lt "$n" ] && [ "$ok" -lt "$TARGET" ]; do
  url=$(jq -r ".[$i].url" "$CAND"); id=$(jq -r ".[$i].id" "$CAND"); subs=$(jq -r ".[$i].hasSubtitles" "$CAND")
  i=$((i+1))
  [ -f "$OUT/$id.mp4" ] && { ok=$((ok+1)); continue; }
  if timeout 90 yt-dlp -q --no-warnings --no-playlist \
        --write-info-json --write-subs --write-auto-subs --sub-langs 'eng-US,eng,en-US,en,en-orig' --convert-subs vtt \
        -f 'mp4/best[ext=mp4]/best' --max-filesize 60M \
        -o "$OUT/%(id)s.%(ext)s" "$url" >/dev/null 2>&1 && [ -f "$OUT/$id.mp4" ]; then
    ok=$((ok+1))
    hasvtt=$([ -n "$(ls "$OUT/$id"*.vtt 2>/dev/null)" ] && echo true || echo false)
    printf '{"id":"%s","status":"live","claimedSubs":%s,"gotVtt":%s}\n' "$id" "$subs" "$hasvtt" >> "$MANIFEST"
    echo "[fetch] $ok/$TARGET live (id=$id vtt=$hasvtt)"
  else
    dead=$((dead+1)); printf '{"id":"%s","status":"dead"}\n' "$id" >> "$MANIFEST"
  fi
  sleep 1
done
echo "[fetch] DONE: $ok live, $dead dead, $i tried"
