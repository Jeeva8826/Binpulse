const { spawn } = require('child_process');
const config = require('../config');
const binService = require('./binService');
const { broadcast } = require('../websocket');

let child = null;
let connected = false;
let lastReadingAt = null;
let lastError = null;
let buffer = '';
let retryTimer = null;
let stopping = false;

function getStatus() {
  const accessDenied = lastError && /access to the port ['"]?([^'"]+)['"]? is denied/i.exec(lastError);
  const error = accessDenied
    ? `Access to ${accessDenied[1]} is denied. Close Arduino IDE Serial Monitor so BinPulse can use the port; it will retry automatically.`
    : lastError;
  return {
    port: config.ARDUINO_SERIAL_PORT,
    baudRate: config.ARDUINO_BAUD_RATE,
    status: connected ? 'online' : 'offline',
    lastReadingAt,
    error
  };
}

function handleLine(rawLine) {
  const line = rawLine.trim();
  if (!line) return;
  if (line === '__SERIAL_READY__') {
    connected = true;
    lastError = null;
    console.log(`[Arduino] Connected on ${config.ARDUINO_SERIAL_PORT} at ${config.ARDUINO_BAUD_RATE} baud`);
    return;
  }

  let payload;
  try {
    payload = JSON.parse(line);
  } catch {
    return; // Ignore human-readable startup and diagnostic lines.
  }
  if (!payload || typeof payload.bin_id !== 'string' || !Number.isFinite(Number(payload.fill))) return;

  const reading = binService.recordReading({
    binId: payload.bin_id,
    fill: payload.fill,
    distanceCm: payload.distance_cm,
    volumeL: payload.volume_l,
    capacityL: payload.capacity_l,
    timestamp: payload.timestamp || new Date().toISOString()
  });
  lastReadingAt = reading.timestamp;
  lastError = null;
  broadcast({ type: 'BIN_TELEMETRY', data: reading });
}

function start() {
  if (process.platform !== 'win32' || !config.ARDUINO_SERIAL_PORT) return;
  stopping = false;
  if (!/^COM\d+$/.test(config.ARDUINO_SERIAL_PORT)) {
    lastError = `Invalid Arduino COM port: ${config.ARDUINO_SERIAL_PORT}`;
    console.error(`[Arduino] ${lastError}`);
    return;
  }
  if (child) return;

  const psScript = [
    '$ErrorActionPreference = "Stop"',
    `$port = New-Object System.IO.Ports.SerialPort('${config.ARDUINO_SERIAL_PORT}', ${config.ARDUINO_BAUD_RATE}, [System.IO.Ports.Parity]::None, 8, [System.IO.Ports.StopBits]::One)`,
    '$port.NewLine = [string][char]10',
    '$port.ReadTimeout = 1500',
    '$port.DtrEnable = $true',
    'try {',
    '  $port.Open()',
    '  [Console]::Out.WriteLine("__SERIAL_READY__")',
    '  while ($true) {',
    '    try { [Console]::Out.WriteLine($port.ReadLine().Trim()) } catch [System.TimeoutException] {}',
    '  }',
    '} catch {',
    '  [Console]::Error.WriteLine($_.Exception.GetType().Name + ": " + $_.Exception.Message)',
    '  exit 2',
    '} finally { if ($port.IsOpen) { $port.Close() }; $port.Dispose() }'
  ].join('\n');

  child = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', psScript], {
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  buffer = '';
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || '';
    lines.forEach(handleLine);
  });
  child.stderr.setEncoding('utf8');
  let stderrBuffer = '';
  child.stderr.on('data', (chunk) => {
    stderrBuffer += chunk;
  });
  child.on('error', (error) => {
    connected = false;
    lastError = error.message;
    child = null;
    console.error(`[Arduino] Could not start serial reader: ${error.message}`);
  });
  child.on('close', (code) => {
    connected = false;
    if (code !== 0) lastError = stderrBuffer.trim().slice(-500) || `Serial reader exited with code ${code}`;
    child = null;
    if (code !== 0) console.error(`[Arduino] ${lastError}`);
    if (config.ARDUINO_SERIAL_PORT && !stopping) {
      retryTimer = setTimeout(start, 5000);
      retryTimer.unref();
    }
  });
}

function stop() {
  stopping = true;
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
  if (child) child.kill();
  child = null;
  connected = false;
}

process.once('exit', () => {
  stopping = true;
  if (child) child.kill();
});

module.exports = { start, stop, getStatus };
