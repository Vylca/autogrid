// In-app updates. The app asks GitHub for the latest release. To install, it
// starts a small detached script that waits for the app to close, runs the same
// install command as the terminal (install.sh), then reopens the app.
const { app, net } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');

const REPO = 'Vylca/autogrid';

function currentVersion() {
  return process.env.AUTOGRID_FAKE_VERSION || app.getVersion();
}

function compareVersions(a, b) {
  const pa = String(a).split('.').map((x) => parseInt(x, 10) || 0);
  const pb = String(b).split('.').map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}

// Where the app was installed by install.sh, or null (development, other install).
function installInfo() {
  if (!app.isPackaged) return null;
  if (process.platform === 'linux') {
    const dir = path.join(os.homedir(), '.local', 'share', 'autogrid', 'app');
    if (path.dirname(process.execPath) === dir) {
      return { platform: 'linux', appDir: dir, launcher: path.join(os.homedir(), '.local', 'bin', 'autogrid') };
    }
  }
  if (process.platform === 'darwin') {
    const appPath = path.resolve(process.execPath, '..', '..', '..');
    if (appPath.endsWith('.app')) {
      const appsDir = path.dirname(appPath);
      try {
        fs.accessSync(appsDir, fs.constants.W_OK);
        return { platform: 'darwin', appPath, appsDir };
      } catch {
        return null;
      }
    }
  }
  return null;
}

async function checkUpdate() {
  const current = currentVersion();
  try {
    const res = await net.fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'AutoGrid' },
    });
    if (!res.ok) return { current, error: `HTTP ${res.status}` };
    const data = await res.json();
    const latest = String(data.tag_name || '').replace(/^v/, '');
    return {
      current,
      latest,
      available: !!latest && compareVersions(latest, current) > 0,
      canInstall: !!installInfo(),
      notes: String(data.body || '').slice(0, 2000),
    };
  } catch (err) {
    return { current, error: String(err && err.message ? err.message : err) };
  }
}

function q(s) {
  return `'${String(s).replace(/'/g, `'\\''`)}'`;
}

function installUpdate() {
  const info = installInfo();
  if (!info) return { ok: false, error: 'not-installed' };
  const log = path.join(app.getPath('userData'), 'update.log');
  const script = path.join(os.tmpdir(), `autogrid-updater-${process.pid}-${Date.now()}.sh`);
  const force = process.env.AUTOGRID_UPDATE_FORCE ? '--force' : '';
  const lines = [
    '#!/bin/bash',
    `exec >>${q(log)} 2>&1`,
    'echo "== $(date) mise à jour"',
    `for i in $(seq 1 120); do kill -0 ${process.pid} 2>/dev/null || break; sleep 0.5; done`,
  ];
  if (info.platform === 'linux') {
    lines.push(
      `for i in $(seq 1 40); do pgrep -f ${q(path.join(info.appDir, 'autogrid'))} >/dev/null || break; sleep 0.5; done`,
      `curl -fsSL https://raw.githubusercontent.com/${REPO}/main/install.sh | bash -s -- ${force}`,
      'echo "install exit $?"',
      'unset AUTOGRID_FAKE_VERSION AUTOGRID_UPDATE_SELFTEST AUTOGRID_UPDATE_FORCE',
      `setsid ${q(info.launcher)} >/dev/null 2>&1 < /dev/null &`,
    );
  } else {
    lines.push(
      'for i in $(seq 1 40); do pgrep -x AutoGrid >/dev/null || break; sleep 0.5; done',
      `export AUTOGRID_APPS_DIR=${q(info.appsDir)}`,
      `curl -fsSL https://raw.githubusercontent.com/${REPO}/main/install.sh | bash -s -- ${force}`,
      'echo "install exit $?"',
      `open ${q(path.join(info.appsDir, 'AutoGrid.app'))}`,
    );
  }
  lines.push('rm -f "$0"');
  fs.writeFileSync(script, `${lines.join('\n')}\n`, { mode: 0o755 });
  const child = spawn('/bin/bash', [script], { detached: true, stdio: 'ignore', env: process.env });
  child.unref();
  setTimeout(() => app.quit(), 400);
  return { ok: true };
}

module.exports = { checkUpdate, installUpdate, compareVersions };
