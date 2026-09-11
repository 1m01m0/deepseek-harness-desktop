'use strict'

// Do not consume a partially received token. Only a complete readiness line
// is usable, and only its exact loopback URL may become the desktop origin.
function parseReadyUrl(output) {
  const end = output.lastIndexOf('\n')
  if (end < 0) return null
  const match = output.slice(0, end + 1).match(/^dsh web: (http:\/\/127\.0\.0\.1:\d+(?:\/[^\s]*)?)(?:\s|$)/m)
  if (!match) return null
  try {
    const url = new URL(match[1])
    return url.hostname === '127.0.0.1' && !url.username && !url.password ? url.href : null
  } catch { return null }
}

module.exports = { parseReadyUrl }
