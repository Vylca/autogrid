#!/usr/bin/env bash
# Installs or updates AutoGrid for the current user (Linux, x64).
# Usage: curl -fsSL https://raw.githubusercontent.com/Vylca/autogrid/main/install.sh | bash
set -euo pipefail

REPO="Vylca/autogrid"
ASSET="AutoGrid-linux-x64.tar.gz"
DEST="$HOME/.local/share/autogrid"
BIN="$HOME/.local/bin"
APPS="$HOME/.local/share/applications"

say() { printf '\033[1m%s\033[0m\n' "$*"; }
fail() { printf '\033[31m%s\033[0m\n' "$*" >&2; exit 1; }

command -v curl >/dev/null || fail "curl est nécessaire."
command -v tar >/dev/null || fail "tar est nécessaire."
[ "$(uname -m)" = "x86_64" ] || fail "Seuls les ordinateurs x86_64 sont pris en charge pour l'instant."

if pgrep -f "$DEST/app/autogrid" >/dev/null 2>&1; then
  fail "AutoGrid est ouvert. Fermez-le, puis relancez la commande."
fi

# Latest published version, read from the release page redirect.
latest_url=$(curl -fsSLI -o /dev/null -w '%{url_effective}' "https://github.com/$REPO/releases/latest") || fail "Impossible de joindre GitHub."
version="${latest_url##*/}"
case "$version" in v*) ;; *) fail "Aucune version publiée pour l'instant." ;; esac

current=""
[ -f "$DEST/version" ] && current=$(cat "$DEST/version")
if [ "$current" = "$version" ] && [ "${1:-}" != "--force" ]; then
  say "AutoGrid $version est déjà à jour."
  exit 0
fi

say "Téléchargement d'AutoGrid $version…"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
curl -fL --progress-bar "https://github.com/$REPO/releases/download/$version/$ASSET" -o "$tmp/$ASSET" || fail "Le téléchargement a échoué."
mkdir -p "$tmp/x"
tar -xzf "$tmp/$ASSET" -C "$tmp/x" --strip-components=1

mkdir -p "$DEST" "$BIN" "$APPS"
rm -rf "$DEST/app.old"
[ -d "$DEST/app" ] && mv "$DEST/app" "$DEST/app.old"
mv "$tmp/x" "$DEST/app"
rm -rf "$DEST/app.old"
cp "$DEST/app/resources/icon.png" "$DEST/icon.png"
echo "$version" > "$DEST/version"

# Launcher. Chromium's sandbox needs unprivileged user namespaces; turn it off only if they are missing.
sandbox_flag=""
if command -v unshare >/dev/null && ! unshare --user true 2>/dev/null; then
  sandbox_flag="--no-sandbox"
fi
cat > "$BIN/autogrid" <<EOF
#!/usr/bin/env bash
exec "$DEST/app/autogrid" $sandbox_flag "\$@"
EOF
chmod +x "$BIN/autogrid"

cat > "$BIN/autogrid-update" <<EOF
#!/usr/bin/env bash
curl -fsSL https://raw.githubusercontent.com/$REPO/main/install.sh | bash -s -- "\$@"
EOF
chmod +x "$BIN/autogrid-update"

cat > "$APPS/autogrid.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=AutoGrid
Comment=Grilles d'évaluation CECRL et correction rapide
Exec=$BIN/autogrid %U
Icon=$DEST/icon.png
Categories=Education;Office;
Terminal=false
StartupWMClass=AutoGrid
EOF
command -v update-desktop-database >/dev/null && update-desktop-database "$APPS" >/dev/null 2>&1 || true

if [ -n "$current" ]; then
  say "AutoGrid mis à jour : $current -> $version."
else
  say "AutoGrid $version est installé."
fi
echo "Lancez-le depuis le menu des applications, ou avec la commande : autogrid"
echo "Pour mettre à jour plus tard : autogrid-update"
case ":$PATH:" in
  *":$BIN:"*) ;;
  *) echo "Note : $BIN n'est pas dans votre PATH. Utilisez $BIN/autogrid et $BIN/autogrid-update." ;;
esac
