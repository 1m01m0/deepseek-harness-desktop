// DeepSeek Harness desktop shell (Electron). Cross-platform equivalent of
// native/mac-app/main.swift: boot the bundled `dsh web --port 0` server, parse
// the readiness line from stdout, and load it in a BrowserWindow.
'use strict'

const { app, BrowserWindow, shell } = require('electron')
const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')

let win = null
let serverProc = null
let readyPort = null

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
