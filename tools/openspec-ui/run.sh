#!/usr/bin/env bash
# Launch the OpenSpec dashboard (ToruAI/openspec-ui) for this repo.
# Self-downloads the right binary if missing. Kanban of the 10 roadmap changes,
# specs browser, real-time refresh as agents work. Read-only.
#   ./run.sh          → start on the configured port (default 4599)
#   ./run.sh stop     → stop a running instance on that port
set -euo pipefail
cd "$(dirname "$0")"

VERSION="v0.2.0"
PORT="$(python3 -c "import json;print(json.load(open('openspec-ui.json'))['port'])" 2>/dev/null || echo 4599)"

if [[ "${1:-}" == "stop" ]]; then
  pid="$(lsof -ti tcp:"$PORT" 2>/dev/null || true)"
  [[ -n "$pid" ]] && { kill "$pid" && echo "stopped openspec-ui (pid $pid) on :$PORT"; } || echo "nothing running on :$PORT"
  exit 0
fi

# Resolve the release asset for this platform.
os="$(uname -s)"; arch="$(uname -m)"
case "$os-$arch" in
  Darwin-arm64)  asset="openspec-ui-$VERSION-darwin-aarch64.zip" ;;
  Darwin-x86_64) asset="openspec-ui-$VERSION-darwin-x86_64.zip" ;;
  Linux-x86_64)  asset="openspec-ui-$VERSION-linux-x86_64.zip" ;;
  *) echo "no prebuilt openspec-ui for $os-$arch — build from source: https://github.com/ToruAI/openspec-ui"; exit 1 ;;
esac

if [[ ! -x ./openspec-ui ]]; then
  echo "downloading openspec-ui $VERSION ($asset)…"
  curl -sL -o _osui.zip "https://github.com/ToruAI/openspec-ui/releases/download/$VERSION/$asset"
  unzip -o -q _osui.zip -d _osui && rm _osui.zip
  bin="$(find _osui -name openspec-ui -type f | head -1)"
  mv "$bin" ./openspec-ui; rm -rf _osui
  xattr -d com.apple.quarantine ./openspec-ui 2>/dev/null || true
  chmod +x ./openspec-ui
fi

# Free the port if something is already there.
pid="$(lsof -ti tcp:"$PORT" 2>/dev/null || true)"; [[ -n "$pid" ]] && kill "$pid" 2>/dev/null || true

echo "openspec-ui → http://localhost:$PORT   (Ctrl-C to stop; './run.sh stop' from elsewhere)"
exec ./openspec-ui --config openspec-ui.json
