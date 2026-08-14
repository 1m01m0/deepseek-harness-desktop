// DeepSeek Harness desktop shell (Electron). Cross-platform equivalent of
// native/mac-app/main.swift: boot the bundled `dsh web --port 0` server, parse
// the readiness line from stdout, and load it in a BrowserWindow.
'use strict'

const { app, BrowserWindow, shell, Menu, dialog } = require('electron')
const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')

let win = null
let serverProc = null
let readyPort = null

const REPO = '1m01m0/deepseek-harness-desktop'
const RELEASES_URL = 'https://github.com/1m01m0/deepseek-harness-desktop/releases/latest'

function resourcesDir() {
  return process.resourcesPath
}

function nodeBinary() {
  return process.platform === 'win32'
    ? path.join(resourcesDir(), 'runtime', 'node', 'node.exe')
    : path.join(resourcesDir(), 'runtime', 'node', 'bin', 'node')
}

function dshEntry() {
  return path.join(
    resourcesDir(),
    'dsh', 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js',
  )
}

function dshHome() {
  // %APPDATA% on Windows, ~/Library/Application Support on macOS, ~/.config on Linux
  return path.join(app.getPath('appData'), 'DeepSeek Harness', 'dsh')
}

// The portable exe cannot replace itself while running; force the installer route.
function isPortable() {
  return !!process.env.PORTABLE_EXECUTABLE_DIR
}

function compareVersions(a, b) {
  // numeric dotted comparison; returns >0 when a is newer
  const pa = String(a).replace(/^v/, '').split('.').map(Number)
  const pb = String(b).replace(/^v/, '').split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const x = pa[i] || 0
    const y = pb[i] || 0
    if (x !== y) return x - y
  }
  return 0
}

// Linux AppImage: electron-updater does not support AppImage reliably, so we
// check the latest GitHub release and hand the user a download link instead.
async function checkLinuxUpdates() {
  try {
    const res = await fetch('https://api.github.com/repos/' + REPO + '/releases/latest')
    if (!res.ok) throw new Error('HTTP ' + res.status)
    const rel = await res.json()
    const latest = String(rel.tag_name || '').replace(/^v/, '')
    const current = app.getVersion()
    if (latest && compareVersions(latest, current) > 0) {
      const choice = dialog.showMessageBoxSync(win, {
        type: 'info',
        title: '发现新版本',
        message: '发现新版本 ' + latest + '（当前 ' + current + '）',
        detail: 'AppImage 版本暂不支持自动安装，请下载新版安装包。',
        buttons: ['去下载', '稍后'],
        defaultId: 0,
        cancelId: 1,
      })
      if (choice === 0) shell.openExternal(RELEASES_URL)
    } else {
      dialog.showMessageBoxSync(win, {
        type: 'info',
        title: '检查更新',
        message: '当前已是最新版本（' + current + '）。',
        buttons: ['好'],
      })
    }
  } catch (error) {
    console.error('update check failed:', error)
    dialog.showMessageBoxSync(win, {
      type: 'error',
      title: '检查更新失败',
      message: '无法获取最新版本信息：' + error.message,
      buttons: ['好'],
    })
  }
}

function setupAutoUpdater() {
  if (process.platform === 'linux' || isPortable()) return
  const { autoUpdater } = require('electron-updater')
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-downloaded', (info) => {
    dialog.showMessageBox(win, {
      type: 'info',
      title: '更新已就绪',
      message: '新版本 ' + (info && info.version ? info.version : '') + ' 已下载完成。',
      detail: '重启应用即可完成更新。',
      buttons: ['立即重启', '稍后'],
      defaultId: 0,
      cancelId: 1,
    }).then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall()
    }).catch(() => {})
  })

  autoUpdater.on('error', (err) => {
    console.error('autoUpdater error:', err)
  })

  autoUpdater.checkForUpdatesAndNotify().catch((err) => {
    console.error('update check failed:', err)
  })
}

function checkForUpdates() {
  if (process.platform === 'linux') {
    checkLinuxUpdates()
    return
  }
  if (isPortable()) {
    dialog.showMessageBoxSync(win, {
      type: 'info',
      title: '检查更新',
      message: '便携版不支持自动更新。',
      detail: '请下载安装版（Setup）或新版便携包。',
      buttons: ['去下载', '取消'],
      defaultId: 0,
      cancelId: 1,
    })
    return
  }
  const { autoUpdater } = require('electron-updater')
  autoUpdater.checkForUpdates().catch((err) => {
    console.error('update check failed:', err)
  })
}

function buildMenu() {
  const template = []

  if (process.platform === 'darwin') {
    template.push({
      label: 'DeepSeek Harness',
      submenu: [
        { role: 'about', label: '关于 DeepSeek Harness' },
        { type: 'separator' },
        { label: '检查更新…', click: () => checkForUpdates() },
        { type: 'separator' },
        { role: 'quit', label: '退出 DeepSeek Harness' },
      ],
    })
  }

  template.push({
    label: '编辑',
    submenu: [
      { role: 'undo', label: '撤销' },
      { role: 'redo', label: '重做' },
      { type: 'separator' },
      { role: 'cut', label: '剪切' },
      { role: 'copy', label: '复制' },
      { role: 'paste', label: '粘贴' },
      { role: 'selectAll', label: '全选' },
    ],
  })

  if (process.platform !== 'darwin') {
    template.push({
      label: '帮助',
      submenu: [
        { label: '检查更新…', click: () => checkForUpdates() },
      ],
    })
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function pageHtml(inner) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body { font-family: -apple-system, "Segoe UI", "PingFang SC", sans-serif;
           background: #fafafa; color: #222; display: flex; align-items: center;
           justify-content: center; height: 100vh; margin: 0; }
    .msg { font-size: 14px; color: #555; text-align: center; max-width: 520px;
           margin-bottom: 18px; word-break: break-all; }
    a { display: inline-block; padding: 8px 18px; border-radius: 6px;
        background: #1f6feb; color: #fff; text-decoration: none; font-size: 14px; }
  </style></head><body>${inner}</body></html>`
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function loadInline(html) {
  if (win && !win.isDestroyed()) {
    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  }
}

function loadSplash(message) {
  loadInline(pageHtml(`<div class="msg">${escapeHtml(message)}</div>`))
}

function loadError(message) {
  loadInline(pageHtml(
    `<div class="msg">${escapeHtml(message)}</div><a href="dsh://retry">重新启动</a>`,
  ))
}

function loadServer() {
  win.loadURL(`http://127.0.0.1:${readyPort}/`)
}

function startServer() {
  if (serverProc) return
  readyPort = null
  loadSplash('正在启动 DeepSeek Harness…')

  try {
    fs.mkdirSync(dshHome(), { recursive: true })
  } catch (error) {
    loadError(`无法创建数据目录 ${dshHome()}：${error.message}`)
    return
  }
  if (!fs.existsSync(nodeBinary())) {
    loadError(`缺少内置 Node 运行时：${nodeBinary()}`)
    return
  }
  if (!fs.existsSync(dshEntry())) {
    loadError(`缺少 dsh 运行时：${dshEntry()}`)
    return
  }

  const env = {
    ...process.env,
    DSH_HOME: dshHome(),
    DSH_TELEMETRY_DISABLED: '1',
  }

  const proc = spawn(nodeBinary(), [dshEntry(), 'web', '--port', '0'], {
    cwd: app.getPath('home'),
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let buffer = ''
  const onData = (chunk) => {
    buffer += chunk.toString()
    const match = buffer.match(/http:\/\/127\.0\.0\.1:(\d+)/)
    if (match && readyPort === null) {
      readyPort = parseInt(match[1], 10)
      loadServer()
    }
  }
  proc.stdout.on('data', onData)
  proc.stderr.on('data', onData)

  proc.on('exit', (code) => {
    if (serverProc !== proc) return
    serverProc = null
    const hadServed = readyPort !== null
    readyPort = null
    if (hadServed) loadError(`DeepSeek Harness 服务已停止（退出码 ${code}）。`)
    else loadError(`DeepSeek Harness 服务启动失败（退出码 ${code}）。`)
  })

  serverProc = proc

  setTimeout(() => {
    if (serverProc === proc && readyPort === null) {
      loadError('启动超时（60 秒内未就绪）。')
    }
  }, 60000)
}

function stopServer() {
  if (!serverProc) return
  // SIGTERM gives dsh a clean teardown on POSIX; on Windows this terminates the process.
  serverProc.kill('SIGTERM')
  serverProc = null
}

function isLocal(url) {
  return /^https?:\/\/(127\.0\.0\.1|localhost)\b/.test(url)
}

app.whenReady().then(() => {
  buildMenu()
  setupAutoUpdater()

  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 860,
    minHeight: 560,
    title: 'DeepSeek Harness',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!isLocal(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('dsh://retry')) {
      event.preventDefault()
      startServer()
      return
    }
    if (/^https?:/.test(url) && !isLocal(url)) {
      event.preventDefault()
      shell.openExternal(url)
    }
  })

  startServer()
})

app.on('window-all-closed', () => {
  app.quit()
})

app.on('will-quit', () => {
  stopServer()
})
