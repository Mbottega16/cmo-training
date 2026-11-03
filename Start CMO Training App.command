#!/usr/bin/env bash
# Mac: double-click to start the CMO Training demo. Close this window to stop it.
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  export PATH="$HOME/.local/node/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
fi
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Get it from https://nodejs.org and try again."
  read -r -p "Press Enter to close..."
  exit 1
fi
if [ ! -d node_modules ]; then
  echo "First run: installing packages (one time only)..."
  npm install || { read -r -p "Install failed. Press Enter to close..."; exit 1; }
fi
echo "Starting CMO Training. A browser tab opens when it is ready."
npm run dev -- --open
