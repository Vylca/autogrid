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

// Latest version from the release page redirect (same as install.sh, no API
// rate limit), with the GitHub API as a fallback.
// The release page redirects to the latest tag. Electron's fetch hides the final
// address, so the redirect is read directly and the request stopped there.
function latestFromPage() {
  return new Promise((resolve, reject) => {
    const req = net.request({ url: `https://github.com/${REPO}/releases/latest`, method: 'HEAD', redirect: 'manual' });
    const timer = setTimeout(() => {
      req.abort();
      reject(new Error('timeout'));
    }, 15000);
    req.on('redirect', (_status, _method, redirectUrl) => {
      clearTimeout(timer);
      req.abort();
      const tag = String(redirectUrl).split('/').pop();
      if (/^v\d/.test(tag)) resolve(tag.slice(1));
      else reject(new Error('no release'));
    });
    req.on('response', (res) => {
      clearTimeout(timer);
      reject(new Error(`HTTP ${res.statusCode}`));
    });
    req.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    req.end();
  });
}

async function latestVersion() {
  try {
    return { version: await latestFromPage(), source: 'page' };
  } catch {
    // fall back to the API below
  }
  const res = await net.fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'AutoGrid' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return { version: String(data.tag_name || '').replace(/^v/, ''), source: 'api' };
}

async function checkUpdate() {
  const current = currentVersion();
  try {
    const { version: latest, source } = await latestVersion();
    return {
      current,
      latest,
      source,
      available: !!latest && compareVersions(latest, current) > 0,
      canInstall: !!installInfo(),
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
      'unset AUTOGRID_FAKE_VERSION AUTOGRID_UPDATE_SELFTEST AUTOGRID_UPDATE_FORCE',
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
