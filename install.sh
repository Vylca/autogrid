#!/usr/bin/env bash
# Installs or updates AutoGrid for the current user, on Linux (x64) or macOS.
# Usage: curl -fsSL https://raw.githubusercontent.com/Vylca/autogrid/main/install.sh | bash
set -euo pipefail

REPO="Vylca/autogrid"

# Temporary download folder, removed when the script ends.
TMP_DIR=""
cleanup() { [ -n "$TMP_DIR" ] && rm -rf "$TMP_DIR"; return 0; }
trap cleanup EXIT

say() { printf '\033[1m%s\033[0m\n' "$*"; }
fail() { printf '\033[31m%s\033[0m\n' "$*" >&2; exit 1; }

command -v curl >/dev/null || fail "curl est nécessaire."

latest_version() {
  # Latest published version, read from the release page redirect.
  local url
  url=$(curl -fsSLI -o /dev/null -w '%{url_effective}' "https://github.com/$REPO/releases/latest") || fail "Impossible de joindre GitHub."
  local v="${url##*/}"
  case "$v" in v*) echo "$v" ;; *) fail "Aucune version publiée pour l'instant." ;; esac
}

download() {
  curl -fL --progress-bar "https://github.com/$REPO/releases/download/$1/$2" -o "$3" || fail "Le téléchargement a échoué."
}

install_mac() {
  local arch asset apps app version current
  case "$(uname -m)" in
    arm64) arch="arm64" ;;
    x86_64) arch="x64" ;;
    *) fail "Processeur non pris en charge : $(uname -m)." ;;
  esac
  asset="AutoGrid-mac-$arch.zip"
  apps="${AUTOGRID_APPS_DIR:-/Applications}"
  if [ ! -w "$apps" ]; then
    apps="$HOME/Applications"
    mkdir -p "$apps"
  fi
  app="$apps/AutoGrid.app"

  if pgrep -x AutoGrid >/dev/null 2>&1; then
    fail "AutoGrid est ouvert. Fermez-le (Cmd+Q), puis relancez la commande."
  fi

  version=$(latest_version)
  current=""
  if [ -f "$app/Contents/Info.plist" ]; then
    current="v$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$app/Contents/Info.plist" 2>/dev/null || true)"
  fi
  if [ "$current" = "$version" ] && [ "${1:-}" != "--force" ]; then
    say "AutoGrid $version est déjà à jour."
    exit 0
  fi

  say "Téléchargement d'AutoGrid $version ($arch)…"
  TMP_DIR=$(mktemp -d)
  local tmp="$TMP_DIR"
  download "$version" "$asset" "$tmp/$asset"
  ditto -x -k "$tmp/$asset" "$tmp/x"
  [ -d "$tmp/x/AutoGrid.app" ] || fail "Archive inattendue."
  # Files fetched with curl are not quarantined, this only clears leftovers.
  xattr -dr com.apple.quarantine "$tmp/x/AutoGrid.app" 2>/dev/null || true

  rm -rf "$app"
  mv "$tmp/x/AutoGrid.app" "$app"

  if [ "$current" != "v" ] && [ -n "$current" ]; then
    say "AutoGrid mis à jour : $current -> $version."
  else
    say "AutoGrid $version est installé dans $apps."
  fi
  echo "Lancez-le depuis le Launchpad ou le dossier Applications."
  echo "Pour mettre à jour plus tard, relancez la même commande."
}

install_linux() {
  local dest="$HOME/.local/share/autogrid" bin="$HOME/.local/bin" apps="$HOME/.local/share/applications"
  local asset="AutoGrid-linux-x64.tar.gz" version current sandbox_flag=""
  command -v tar >/dev/null || fail "tar est nécessaire."
  [ "$(uname -m)" = "x86_64" ] || fail "Seuls les ordinateurs x86_64 sont pris en charge pour l'instant."

  if pgrep -f "$dest/app/autogrid" >/dev/null 2>&1; then
    fail "AutoGrid est ouvert. Fermez-le, puis relancez la commande."
  fi

  version=$(latest_version)
  current=""
  [ -f "$dest/version" ] && current=$(cat "$dest/version")
  if [ "$current" = "$version" ] && [ "${1:-}" != "--force" ]; then
    say "AutoGrid $version est déjà à jour."
    exit 0
  fi

  say "Téléchargement d'AutoGrid $version…"
  TMP_DIR=$(mktemp -d)
  local tmp="$TMP_DIR"
  download "$version" "$asset" "$tmp/$asset"
  mkdir -p "$tmp/x"
  tar -xzf "$tmp/$asset" -C "$tmp/x" --strip-components=1

  mkdir -p "$dest" "$bin" "$apps"
  rm -rf "$dest/app.old"
  [ -d "$dest/app" ] && mv "$dest/app" "$dest/app.old"
  mv "$tmp/x" "$dest/app"
  rm -rf "$dest/app.old"
  cp "$dest/app/resources/icon.png" "$dest/icon.png"
  echo "$version" > "$dest/version"

  # Chromium's sandbox needs unprivileged user namespaces. Turn it off only if they are missing.
  if command -v unshare >/dev/null && ! unshare --user true 2>/dev/null; then
    sandbox_flag="--no-sandbox"
  fi
  cat > "$bin/autogrid" <<EOF
#!/usr/bin/env bash
exec "$dest/app/autogrid" $sandbox_flag "\$@"
EOF
  chmod +x "$bin/autogrid"

  cat > "$bin/autogrid-update" <<EOF
#!/usr/bin/env bash
curl -fsSL https://raw.githubusercontent.com/$REPO/main/install.sh | bash -s -- "\$@"
EOF
  chmod +x "$bin/autogrid-update"

  cat > "$apps/autogrid.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=AutoGrid
Comment=Grilles d'évaluation CECRL et correction rapide
Exec=$bin/autogrid %U
Icon=$dest/icon.png
Categories=Education;Office;
Terminal=false
StartupWMClass=AutoGrid
EOF
  command -v update-desktop-database >/dev/null && update-desktop-database "$apps" >/dev/null 2>&1 || true

  if [ -n "$current" ]; then
    say "AutoGrid mis à jour : $current -> $version."
  else
    say "AutoGrid $version est installé."
  fi
  echo "Lancez-le depuis le menu des applications, ou avec la commande : autogrid"
  echo "Pour mettre à jour plus tard : autogrid-update"
  case ":$PATH:" in
    *":$bin:"*) ;;
    *) echo "Note : $bin n'est pas dans votre PATH. Utilisez $bin/autogrid et $bin/autogrid-update." ;;
  esac
}

case "$(uname -s)" in
  Darwin) install_mac "$@" ;;
  Linux) install_linux "$@" ;;
  *) fail "Système non pris en charge : $(uname -s)." ;;
esac
