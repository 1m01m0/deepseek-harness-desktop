#!/usr/bin/env bash
set -euo pipefail

# Package the DeepSeek Harness web app as a self-contained macOS .app:
#   - bundles an official Node binary (v24 LTS, darwin)
#   - bundles the published @deepseek-ai/dsh npm runtime (node_modules)
#   - a small AppKit/WKWebView shell boots `dsh web --port 0` and loads it
# Output: <repo>/dist/DeepSeek Harness.app

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MAC_DIR="$ROOT/native/mac-app"
STAGING="$MAC_DIR/.staging"
DIST="$ROOT/dist"
APP_NAME="DeepSeek Harness"
APP_DIR="$DIST/$APP_NAME.app"

NODE_MAJOR="${NODE_MAJOR:-24}"
DSH_VERSION="${DSH_VERSION:-0.1.0-rc.6}"

case "$(uname -m)" in
  arm64)  NODE_ARCH="arm64" ;;
  x86_64) NODE_ARCH="x64" ;;
  *) echo "unsupported architecture: $(uname -m)"; exit 1 ;;
esac

echo "==> Clean"
rm -rf "$STAGING" "$APP_DIR"
mkdir -p "$STAGING" \
  "$APP_DIR/Contents/MacOS" \
  "$APP_DIR/Contents/Resources/runtime/node/bin" \
  "$APP_DIR/Contents/Resources/dsh"

echo "==> 1/7 Resolve Node v${NODE_MAJOR} (darwin-$NODE_ARCH)"
NODE_VERSION="$(curl -fsSL https://nodejs.org/dist/index.json \
  | python3 -c "import json,sys; vs=[v['version'] for v in json.load(sys.stdin) if v['version'].startswith('v$NODE_MAJOR.')]; print(vs[0])")"
echo "    $NODE_VERSION"
curl -fsSL -o "$STAGING/$NODE_VERSION-darwin-$NODE_ARCH.tar.gz" \
  "https://nodejs.org/dist/$NODE_VERSION/node-$NODE_VERSION-darwin-$NODE_ARCH.tar.gz"
mkdir -p "$STAGING/node-src"
tar -xzf "$STAGING/$NODE_VERSION-darwin-$NODE_ARCH.tar.gz" -C "$STAGING/node-src"
NODE_DIR="$STAGING/node-src/node-$NODE_VERSION-darwin-$NODE_ARCH"
cp "$NODE_DIR/bin/node" "$APP_DIR/Contents/Resources/runtime/node/bin/node"

echo "==> 2/7 Stage dsh runtime (v$DSH_VERSION)"
npm install --prefix "$STAGING/dsh" --no-audit --no-fund "@deepseek-ai/dsh@$DSH_VERSION"
DSH_BIN="$STAGING/dsh/node_modules/@deepseek-ai/dsh/lib/bin.js"
test -f "$DSH_BIN" || { echo "dsh bin missing after install"; exit 1; }

echo "==> 3/7 Validate the runtime boots the web profile"
VAL_HOME="$(mktemp -d)"
VAL_LOG="$STAGING/validate.log"
DSH_HOME="$VAL_HOME" DSH_TELEMETRY_DISABLED=1 \
  "$NODE_DIR/bin/node" "$DSH_BIN" web --port 0 >"$VAL_LOG" 2>&1 &
VAL_PID=$!
PORT=""
for _ in $(seq 1 150); do
  PORT="$(grep -oE 'http://127\.0\.0\.1:[0-9]+' "$VAL_LOG" 2>/dev/null | grep -oE '[0-9]+$' | head -1 || true)"
  [ -n "$PORT" ] && break
  kill -0 "$VAL_PID" 2>/dev/null || { echo "server exited during validation"; tail -50 "$VAL_LOG"; exit 1; }
  sleep 1
done
if [ -z "$PORT" ]; then
  echo "timed out waiting for readiness"; tail -80 "$VAL_LOG"; exit 1
fi
HTTP_CODE="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/")"
TITLE="$(curl -s "http://127.0.0.1:$PORT/" | grep -oE '<title>[^<]*</title>' | head -1 || true)"
echo "    ok: port=$PORT http=$HTTP_CODE $TITLE"
[ "$HTTP_CODE" = "200" ] || { echo "unexpected HTTP $HTTP_CODE"; exit 1; }
kill -TERM "$VAL_PID" 2>/dev/null || true
wait "$VAL_PID" 2>/dev/null || true
rm -rf "$VAL_HOME"

echo "==> 4/7 Compile the Swift shell"
swiftc -O "$MAC_DIR/main.swift" \
  -framework AppKit -framework WebKit \
  -o "$APP_DIR/Contents/MacOS/$APP_NAME"

echo "==> 5/7 Assemble bundle"
cp "$MAC_DIR/Info.plist" "$APP_DIR/Contents/Info.plist"
cp -R "$STAGING/dsh/node_modules" "$APP_DIR/Contents/Resources/dsh/node_modules"

echo "==> 6/7 Icon (best effort)"
# Prefer $ICON_SRC (env), then native/mac-app/app-icon.svg, then the favicon.
ICON_SRC="${ICON_SRC:-}"
if [ -z "$ICON_SRC" ] || [ ! -f "$ICON_SRC" ]; then
  if [ -f "$MAC_DIR/app-icon.svg" ]; then
    ICON_SRC="$MAC_DIR/app-icon.svg"
  else
    ICON_SRC="$ROOT/apps/web/public/favicon.svg"
  fi
fi
echo "    icon source: $ICON_SRC"
if [ -f "$ICON_SRC" ]; then
  ICONSET="$STAGING/AppIcon.iconset"
  mkdir -p "$ICONSET"
  qlmanage -t -s 1024 -o "$STAGING" "$ICON_SRC" >/dev/null 2>&1 || true
  PNG="$STAGING/$(basename "$ICON_SRC").png"
  if [ -f "$PNG" ]; then
    # macOS only applies its rounded-corner mask to icons that have transparent
    # margins; a full-bleed render shows the artwork's own corners (looks
    # square). Pad the logo to ~82% on a transparent 1024x1024 canvas. Best
    # effort: needs python3 + Pillow; falls back to the full-bleed render.
    if PADDED="$(python3 - "$PNG" <<'PY' 2>/dev/null
import sys
try:
    from PIL import Image
except Exception:
    sys.exit(1)
src = Image.open(sys.argv[1]).convert('RGBA')
size = 1024
art = int(size * 0.82)
dst = Image.new('RGBA', (size, size), (0, 0, 0, 0))
a = src.resize((art, art), Image.LANCZOS)
dst.paste(a, ((size - art) // 2, (size - art) // 2), a)
out = sys.argv[1] + '.padded.png'
dst.save(out)
print(out)
PY
)"; then
      PNG="$PADDED"
      echo "    padded to rounded-mask canvas"
    else
      echo "    Pillow unavailable; using full-bleed icon (square corners)"
    fi
    for s in 16 32 128 256 512; do
      sips -z "$s" "$s" "$PNG" --out "$ICONSET/icon_${s}x${s}.png" >/dev/null 2>&1
      sips -z "$((s * 2))" "$((s * 2))" "$PNG" --out "$ICONSET/icon_${s}x${s}@2x.png" >/dev/null 2>&1
    done
    iconutil -c icns "$ICONSET" -o "$APP_DIR/Contents/Resources/AppIcon.icns" \
      && echo "    icon built" || echo "    icon skipped"
  else
    echo "    qlmanage render unavailable; icon skipped"
  fi
fi

echo "==> 7/7 Sign (ad-hoc)"
codesign --force --sign - "$APP_DIR"

rm -rf "$STAGING"

echo ""
echo "Done: $APP_DIR"
echo "Launch with: open \"$APP_DIR\""
