/* ============================================================
   SecureHome — Smart Security Monitor
   app.js — Full Application Logic
   ============================================================ */

'use strict';

// ===================================================
// CONFIGURATION
// ===================================================
const CONFIG = {
  CORRECT_PIN: '2580',
  MAX_PIN_ATTEMPTS: 3,
  AUTO_LOCK_MS: 5000,
  FACE_SCAN_MS: 2500,
  FP_SCAN_MS: 2000,
  AUTO_EVENT_INTERVAL_MS: 15000,
};

// ===================================================
// STATE
// ===================================================
const STATE = {
  armMode: 'armed',
  gateOpen: false,
  pinInput: '',
  pinAttempts: 0,
  pinLocked: false,
  alertCount: 3,
  anomalyCount: 1,
  gateEvents: 7,
  notifCount: 2,
  feedItems: [],
  activeTab: 'dashboard',
};

// ===================================================
// SENSOR DATA
// ===================================================
const SENSORS = [
  { id:'s0', name:'Motion Sensor',   loc:'Living Room', icon:'👁', type:'motion', val:'Clear',     state:'normal' },
  { id:'s1', name:'Front Door',      loc:'Entrance',    icon:'🚪', type:'door',   val:'Closed',    state:'normal' },
  { id:'s2', name:'Back Door',       loc:'Rear Exit',   icon:'🚪', type:'door',   val:'Closed',    state:'anomaly' },
  { id:'s3', name:'Kitchen Window',  loc:'Kitchen',     icon:'🪟', type:'window', val:'Closed',    state:'normal' },
  { id:'s4', name:'Bedroom Motion',  loc:'Bedroom',     icon:'👁', type:'motion', val:'Clear',     state:'normal' },
  { id:'s5', name:'Garage Door',     loc:'Garage',      icon:'🏠', type:'door',   val:'Open',      state:'triggered' },
  { id:'s6', name:'Side Window',     loc:'Hallway',     icon:'🪟', type:'window', val:'Closed',    state:'normal' },
  { id:'s7', name:'Smoke Detector',  loc:'Kitchen',     icon:'🔥', type:'smoke',  val:'Normal',    state:'normal' },
  { id:'s8', name:'CO Detector',     loc:'Bedroom',     icon:'💨', type:'co',     val:'18 ppm',    state:'normal' },
  { id:'s9', name:'Thermostat',      loc:'Living Room', icon:'🌡', type:'env',    val:'23°C',      state:'normal' },
  { id:'s10',name:'Doorbell Camera', loc:'Entrance',    icon:'📷', type:'camera', val:'Recording', state:'normal' },
  { id:'s11',name:'Garden Motion',   loc:'Outdoor',     icon:'👁', type:'motion', val:'Active',    state:'triggered' },
];

const ANOMALIES = [
  { title:'Back door: unusual schedule',      desc:'Opened 3× between 2–4 AM. Baseline is 0 events.',         level:'warn' },
  { title:'Garage door: extended open time',  desc:'Open for 47 min continuously. Average open time is 4 min.', level:'alert' },
];

const GATE_LOG = [
  { name:'Riya Sharma',   time:'2 min ago', method:'face', ok:true },
  { name:'Unknown',       time:'18 min ago',method:'pin',  ok:false },
  { name:'Amar Kulkarni', time:'1h ago',    method:'fp',   ok:true },
  { name:'Priya M.',      time:'3h ago',    method:'face', ok:true },
];

// Chart data
const HOURS   = ['00','02','04','06','08','10','12','14','16','18','20','22'];
const MOTION_DATA = [0,0,1,0,2,5,8,6,9,7,4,3];
const DOOR_DATA   = [0,0,0,0,1,3,4,2,5,4,2,1];
const HEAT_COLORS = ['#0F2E1E','#0F6E56','#1D9E75','#5DCAA5','#9FE1CB'];
const FEED_ICONS = {
  motion:'🏃', door:'🚪', window:'🪟',
  smoke:'🔥',  co:'💨',   anomaly:'⚠',
  gate:'🔐',   auth:'✅',  fail:'❌',
};

// ===================================================
// CLOCK
// ===================================================
function updateClock() {
  const now = new Date();
  const clockEl = document.getElementById('clock');
  const dateEl  = document.getElementById('date-display');
  if (clockEl) clockEl.textContent = now.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
  if (dateEl)  dateEl.textContent  = now.toLocaleDateString('en-IN', { weekday:'short', day:'2-digit', month:'short', year:'numeric' });
}
setInterval(updateClock, 1000);
updateClock();

// ===================================================
// TABS
// ===================================================
function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  document.querySelectorAll('.tab-content').forEach(sec => {
    sec.classList.toggle('hidden', sec.id !== 'tab-' + tab);
    sec.classList.toggle('active', sec.id === 'tab-' + tab);
  });
  STATE.activeTab = tab;
  if (tab === 'activity')  { STATE.notifCount = 0; updateNotifBadge(); }
  if (tab === 'analytics') renderCharts();
}

// ===================================================
// NOTIFICATIONS
// ===================================================
function updateNotifBadge() {
  const badge = document.getElementById('notif-badge');
  if (!badge) return;
  badge.style.display = STATE.notifCount > 0 ? 'block' : 'none';
}

// ===================================================
// FEED / ACTIVITY LOG
// ===================================================
function addFeedItem(msg, type='normal', category='motion') {
  const now  = new Date();
  const time = now.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
  STATE.feedItems.unshift({ msg, type, category, time });
  if (STATE.feedItems.length > 100) STATE.feedItems.pop();
  renderFeed();
  if (STATE.activeTab !== 'activity') { STATE.notifCount++; updateNotifBadge(); }
}

function renderFeed() {
  ['main-feed','all-feed'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const max = (id === 'main-feed') ? 8 : 100;
    const items = STATE.feedItems.slice(0, max);
    if (items.length === 0) {
      el.innerHTML = '<div class="feed-empty">No events yet</div>';
      return;
    }
    el.innerHTML = items.map(item => `
      <div class="feed-item event-${item.type}">
        <span class="feed-icon">${FEED_ICONS[item.category] || '📡'}</span>
        <div class="feed-body">
          <div class="feed-msg">${escHtml(item.msg)}</div>
          <div class="feed-time">${item.time}</div>
        </div>
      </div>
    `).join('');
  });
}

function clearFeed() {
  STATE.feedItems = [];
  renderFeed();
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ===================================================
// SENSORS
// ===================================================
function renderSensors() {
  const grid = document.getElementById('sensor-grid');
  if (!grid) return;
  grid.innerHTML = SENSORS.map(s => {
    const cls = s.state === 'triggered' ? 'triggered' : s.state === 'anomaly' ? 'anomaly' : '';
    const dotCls = s.state === 'triggered' ? 'red' : s.state === 'anomaly' ? 'amber' : 'green';
    return `
      <div class="sensor-item ${cls}" onclick="sensorClick('${s.id}')">
        <div class="sensor-top">
          <span class="sensor-emoji">${s.icon}</span>
          <span class="sensor-status ${dotCls}"></span>
        </div>
        <div class="sensor-name">${escHtml(s.name)}</div>
        <div class="sensor-loc">${escHtml(s.loc)}</div>
        <div class="sensor-val">${escHtml(s.val)}</div>
      </div>
    `;
  }).join('');
  const badge = document.getElementById('sensor-count-badge');
  if (badge) badge.textContent = SENSORS.length + ' active';
}

function sensorClick(id) {
  const s = SENSORS.find(x => x.id === id);
  if (s) addFeedItem(`Sensor tapped: ${s.name} (${s.loc})`, 'normal', s.type);
}

function renderAnomalies() {
  const el = document.getElementById('anomaly-list');
  if (!el) return;
  el.innerHTML = ANOMALIES.map(a => `
    <div class="anomaly-item level-${a.level}">
      <span class="anomaly-item-icon">⚠</span>
      <div class="anomaly-item-body">
        <div class="anomaly-item-title">${escHtml(a.title)}</div>
        <div class="anomaly-item-desc">${escHtml(a.desc)}</div>
      </div>
      <span class="badge ${a.level === 'alert' ? 'badge-red' : 'badge-amber'}">${a.level}</span>
    </div>
  `).join('');
}

// ===================================================
// ANOMALY BANNER
// ===================================================
function showAnomalyBanner(desc) {
  const banner = document.getElementById('anomaly-banner');
  const descEl = document.getElementById('anomaly-desc');
  if (!banner) return;
  if (descEl) descEl.textContent = desc;
  banner.classList.remove('hidden');
  STATE.anomalyCount++;
  const mEl = document.getElementById('m-anomaly');
  if (mEl) mEl.textContent = STATE.anomalyCount;
}
window.dismissAnomaly = function() {
  const banner = document.getElementById('anomaly-banner');
  if (banner) banner.classList.add('hidden');
};

// ===================================================
// ARM MODE
// ===================================================
window.setArm = function(mode) {
  STATE.armMode = mode;
  ['armed','home','disarmed'].forEach(m => {
    const btn = document.getElementById('btn-' + m);
    if (btn) btn.classList.toggle('active', m === mode);
  });
  const statusEl = document.getElementById('system-status');
  const badgeEl  = document.getElementById('arm-badge');
  if (statusEl) {
    statusEl.className = 'status-pill ' + (mode === 'armed' ? 'armed' : mode === 'home' ? 'home' : 'disarmed');
    statusEl.innerHTML = `<span class="dot"></span> ${mode === 'armed' ? 'Armed' : mode === 'home' ? 'Home Mode' : 'Disarmed'}`;
  }
  if (badgeEl) {
    badgeEl.className = 'badge ' + (mode === 'armed' ? 'badge-green' : mode === 'home' ? 'badge-amber' : '');
    badgeEl.textContent = mode === 'armed' ? 'Armed' : mode === 'home' ? 'Home Mode' : 'Disarmed';
  }
  addFeedItem('System mode changed to: ' + mode, 'normal', 'gate');
};

// ===================================================
// TRIGGER EVENTS
// ===================================================
const EVENT_MESSAGES = {
  motion: ['Motion detected — Living Room', 'Motion detected — Garden', 'Movement sensor triggered — Hallway', 'Activity detected in Bedroom zone'],
  door:   ['Front door opened', 'Back door opened — unusual hour', 'Side entrance door triggered', 'Garage door opened'],
  window: ['Kitchen window opened', 'Bedroom window sensor triggered', 'Side window alert triggered'],
  anomaly:['Anomaly: repeated back door access at odd hours', 'Anomaly: motion spike detected at 2 AM', 'Anomaly: garage door open >45 minutes'],
};

window.triggerEvent = function(type) {
  const msgs = EVENT_MESSAGES[type] || ['Sensor event triggered'];
  const msg  = msgs[Math.floor(Math.random() * msgs.length)];
  const isAlert = type === 'anomaly';
  addFeedItem(msg, isAlert ? 'alert' : (type === 'motion' ? 'warn' : 'normal'), type === 'anomaly' ? 'anomaly' : type);
  if (isAlert) showAnomalyBanner(msg);

  // Flash random map dot
  const mapDots = ['map-s0','map-s1','map-s2','map-s3','map-s4','map-s5'];
  const dot = document.getElementById(mapDots[Math.floor(Math.random() * mapDots.length)]);
  if (dot) {
    dot.setAttribute('fill', '#E24B4A');
    setTimeout(() => dot.setAttribute('fill', '#1D9E75'), 2500);
  }

  STATE.alertCount++;
  const el = document.getElementById('m-alerts');
  if (el) el.textContent = STATE.alertCount;
};

// ===================================================
// GATE LOG
// ===================================================
function renderGateLog() {
  const el = document.getElementById('gate-log');
  if (!el) return;
  const methodLabel = { face:'Face ID', fp:'Fingerprint', pin:'PIN Code', failed:'Failed' };
  const methodCls   = { face:'face', fp:'fp', pin:'pin', failed:'failed' };
  el.innerHTML = GATE_LOG.map(e => `
    <div class="log-item">
      <span class="log-result">${e.ok ? '✅' : '❌'}</span>
      <span class="log-name">${escHtml(e.name)}</span>
      <span class="log-method ${e.ok ? methodCls[e.method] : 'failed'}">${e.ok ? methodLabel[e.method] : 'Failed'}</span>
      <span class="log-time">${e.time}</span>
    </div>
  `).join('');
  const cnt = document.getElementById('access-log-count');
  if (cnt) cnt.textContent = GATE_LOG.length + ' entries';
}

function grantAccess(method, name) {
  name = name || 'Authorized user';
  STATE.gateEvents++;
  const gEl = document.getElementById('m-gate');
  if (gEl) gEl.textContent = STATE.gateEvents;

  GATE_LOG.unshift({ name, time:'Just now', method, ok:true });
  renderGateLog();
  addFeedItem(`Gate unlocked — ${name} (${method === 'face' ? 'Face ID' : method === 'fp' ? 'Fingerprint' : 'PIN'})`, 'normal', 'auth');

  const bar = document.getElementById('gate-status-bar');
  const txt = document.getElementById('gate-status-txt');
  if (bar) bar.className = 'gate-status-bar unlocked';
  if (txt) txt.textContent = 'Gate is UNLOCKED';
  setTimeout(() => {
    if (bar) bar.className = 'gate-status-bar locked';
    if (txt) txt.textContent = 'Gate is LOCKED';
  }, CONFIG.AUTO_LOCK_MS);
}

function denyAccess(method, reason) {
  GATE_LOG.unshift({ name:'Unknown', time:'Just now', method:'failed', ok:false });
  renderGateLog();
  addFeedItem(`Access denied — ${reason} (${method})`, 'alert', 'fail');
}

// ===================================================
// PIN PAD
// ===================================================
(function buildPinPad() {
  const grid = document.getElementById('pin-grid');
  if (!grid) return;
  const keys = ['1','2','3','4','5','6','7','8','9','del','0','enter'];
  grid.innerHTML = keys.map(k => {
    const cls   = k === 'del' ? 'pin-key del' : k === 'enter' ? 'pin-key enter' : 'pin-key';
    const label = k === 'del' ? '⌫' : k === 'enter' ? 'Unlock' : k;
    return `<div class="${cls}" onclick="pinPress('${k}')" role="button" tabindex="0">${label}</div>`;
  }).join('');
})();

function updatePinDisplay(state) {
  for (let i = 0; i < 4; i++) {
    const dot = document.getElementById('pd' + i);
    if (!dot) continue;
    dot.className = 'pin-dot';
    if (i < STATE.pinInput.length) dot.classList.add('filled');
    if (state) dot.classList.add(state);
  }
}

window.pinPress = function(k) {
  if (STATE.pinLocked) return;
  if (k === 'del') {
    STATE.pinInput = STATE.pinInput.slice(0, -1);
    updatePinDisplay();
    return;
  }
  if (k === 'enter') { checkPin(); return; }
  if (STATE.pinInput.length >= 4) return;
  STATE.pinInput += k;
  updatePinDisplay();
  if (STATE.pinInput.length === 4) setTimeout(checkPin, 180);
};

function checkPin() {
  const msgEl = document.getElementById('pin-msg');
  if (STATE.pinInput === CONFIG.CORRECT_PIN) {
    updatePinDisplay('success');
    if (msgEl) { msgEl.textContent = '✓ Access granted'; msgEl.style.color = 'var(--green-light)'; }
    grantAccess('pin', 'Verified User');
    setTimeout(() => {
      STATE.pinInput = '';
      updatePinDisplay();
      if (msgEl) { msgEl.textContent = ''; msgEl.style.color = ''; }
    }, 2500);
  } else {
    STATE.pinAttempts++;
    updatePinDisplay('error');
    const remaining = CONFIG.MAX_PIN_ATTEMPTS - STATE.pinAttempts;
    if (STATE.pinAttempts >= CONFIG.MAX_PIN_ATTEMPTS) {
      STATE.pinLocked = true;
      if (msgEl) { msgEl.textContent = '⛔ Locked — too many attempts'; msgEl.style.color = 'var(--red)'; }
      denyAccess('PIN', 'Too many failed attempts');
      setTimeout(() => {
        STATE.pinLocked = false; STATE.pinAttempts = 0;
        STATE.pinInput = ''; updatePinDisplay();
        if (msgEl) { msgEl.textContent = ''; msgEl.style.color = ''; }
      }, 10000);
    } else {
      if (msgEl) { msgEl.textContent = `✗ Incorrect PIN (${remaining} left)`; msgEl.style.color = 'var(--red)'; }
      denyAccess('PIN', 'Incorrect PIN');
      setTimeout(() => {
        STATE.pinInput = ''; updatePinDisplay();
        if (msgEl) { msgEl.textContent = ''; msgEl.style.color = ''; }
      }, 1800);
    }
  }
}

// ===================================================
// FINGERPRINT
// ===================================================
window.startFingerprint = function() {
  const scanner = document.getElementById('fp-scanner');
  const subEl   = document.getElementById('fp-sub');
  const statusEl = document.getElementById('fp-status');
  if (!scanner || scanner.classList.contains('scanning')) return;

  scanner.className = 'fp-scanner scanning';
  if (subEl)    subEl.textContent    = 'Scanning fingerprint…';
  if (statusEl) { statusEl.textContent = 'Reading biometric data'; statusEl.style.color = 'var(--green-light)'; }

  const success = Math.random() > 0.25;
  setTimeout(() => {
    if (success) {
      scanner.className = 'fp-scanner success';
      if (subEl)    subEl.textContent    = 'Match confirmed';
      if (statusEl) { statusEl.textContent = 'Riya Sharma — authenticated'; statusEl.style.color = 'var(--green-light)'; }
      grantAccess('fp', 'Riya Sharma');
    } else {
      scanner.className = 'fp-scanner fail';
      if (subEl)    subEl.textContent    = 'No match found';
      if (statusEl) { statusEl.textContent = 'Fingerprint not recognized'; statusEl.style.color = 'var(--red)'; }
      denyAccess('Fingerprint', 'Unknown fingerprint');
    }
    setTimeout(() => {
      scanner.className = 'fp-scanner';
      if (subEl)    subEl.textContent    = 'Place finger on sensor';
      if (statusEl) { statusEl.textContent = ''; }
    }, 2500);
  }, CONFIG.FP_SCAN_MS);
};

// ===================================================
// FACE DETECTION
// ===================================================
let faceCtx = null;

function initFaceCanvas() {
  const canvas = document.getElementById('face-canvas');
  if (!canvas) return;
  faceCtx = canvas.getContext('2d');
  drawFaceIdle();
}

function drawFaceIdle() {
  if (!faceCtx) return;
  const ctx = faceCtx;
  const W = 240, H = 180;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0a0e12'; ctx.fillRect(0, 0, W, H);
  // Grid lines (subtle)
  ctx.strokeStyle = 'rgba(29,158,117,0.05)'; ctx.lineWidth = 0.5;
  for (let x = 0; x < W; x += 24) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
  for (let y = 0; y < H; y += 24) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
  // Silhouette
  ctx.strokeStyle = '#2a3a2a'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(120, 70, 34, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(120, 70, 34, Math.PI, Math.PI * 2);
  ctx.lineTo(160, 140); ctx.quadraticCurveTo(120, 160, 80, 140); ctx.closePath(); ctx.stroke();
}

function drawFaceScanning(progress) {
  if (!faceCtx) return;
  const ctx = faceCtx;
  const W = 240, H = 180;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0a0e12'; ctx.fillRect(0, 0, W, H);
  // Face outline in green
  ctx.strokeStyle = `rgba(29,158,117,${0.3 + progress * 0.5})`; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(120, 70, 34, 0, Math.PI * 2); ctx.stroke();
  // Eyes
  ctx.fillStyle = 'rgba(93,202,165,' + progress + ')';
  ctx.beginPath(); ctx.arc(107, 64, 4, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(133, 64, 4, 0, Math.PI*2); ctx.fill();
  // Landmark dots
  const pts = [[107,58],[133,58],[120,75],[110,83],[130,83],[120,68]];
  pts.forEach(([x,y]) => {
    ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI*2);
    ctx.fillStyle = `rgba(93,202,165,${progress * 0.7})`; ctx.fill();
  });
  // Scan line
  const lineY = progress * H;
  const grad = ctx.createLinearGradient(0, lineY - 10, 0, lineY + 10);
  grad.addColorStop(0, 'transparent');
  grad.addColorStop(0.5, 'rgba(29,158,117,0.6)');
  grad.addColorStop(1, 'transparent');
  ctx.fillStyle = grad; ctx.fillRect(0, lineY - 10, W, 20);
}

function drawFaceResult(matched) {
  if (!faceCtx) return;
  const ctx = faceCtx;
  const W = 240, H = 180;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0a0e12'; ctx.fillRect(0, 0, W, H);
  const color = matched ? '#1D9E75' : '#E24B4A';
  // Face circle
  ctx.strokeStyle = color; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(120, 70, 34, 0, Math.PI * 2); ctx.stroke();
  // Detection box
  ctx.strokeStyle = color; ctx.lineWidth = 1.5;
  ctx.strokeRect(80, 32, 80, 82);
  // Label
  ctx.font = '10px Space Mono, monospace';
  ctx.fillStyle = color;
  ctx.fillText(matched ? 'MATCH ✓' : 'NO MATCH ✗', 83, 27);
  // Eyes
  ctx.fillStyle = matched ? '#5DCAA5' : '#E24B4A';
  ctx.beginPath(); ctx.arc(107, 64, 4, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(133, 64, 4, 0, Math.PI*2); ctx.fill();
  // Name tag if matched
  if (matched) {
    ctx.fillStyle = 'rgba(29,158,117,0.2)';
    ctx.fillRect(70, 115, 100, 22);
    ctx.fillStyle = '#5DCAA5'; ctx.font = '9px Space Mono, monospace';
    ctx.fillText('Amar Kulkarni', 78, 130);
  }
}

window.startFaceScan = function() {
  const statusEl = document.getElementById('face-status');
  const subEl    = document.getElementById('face-sub');
  if (!faceCtx) return;

  if (statusEl) statusEl.textContent = 'Scanning…';
  if (subEl)    subEl.textContent    = 'Hold still';

  let progress = 0;
  const interval = setInterval(() => {
    progress = Math.min(progress + 0.04, 1);
    drawFaceScanning(progress);
    if (progress >= 1) clearInterval(interval);
  }, 60);

  const success = Math.random() > 0.2;
  setTimeout(() => {
    clearInterval(interval);
    drawFaceResult(success);
    if (success) {
      if (statusEl) statusEl.textContent = 'Face matched';
      if (subEl)    subEl.textContent    = 'Identity confirmed';
      grantAccess('face', 'Amar Kulkarni');
    } else {
      if (statusEl) statusEl.textContent = 'Not recognized';
      if (subEl)    subEl.textContent    = 'Please try again';
      denyAccess('Face ID', 'Unknown person');
      setTimeout(() => { drawFaceIdle(); if(statusEl) statusEl.textContent='Position face in frame'; if(subEl) subEl.textContent='Align face within the corners'; }, 2000);
    }
  }, CONFIG.FACE_SCAN_MS);
};

// ===================================================
// CHARTS (Analytics)
// ===================================================
function renderCharts() {
  renderBarChart('chart-motion', MOTION_DATA, '#1D9E75');
  renderBarChart('chart-door',   DOOR_DATA,   '#378ADD');
  renderHeatmap();
}

function renderBarChart(id, data, color) {
  const el = document.getElementById(id);
  if (!el) return;
  const max = Math.max(...data, 1);
  el.innerHTML = data.map((v, i) => {
    const h = Math.max(4, Math.round((v / max) * 80));
    return `
      <div class="chart-col">
        <div class="chart-bar" style="height:${h}px; background:${color}; --target-h:${h}px; --delay:${i * 0.04}s;"></div>
        <span class="chart-lbl">${HOURS[i]}</span>
      </div>
    `;
  }).join('');
}

function renderHeatmap() {
  const el = document.getElementById('heatmap');
  if (!el) return;
  const sensorNames = SENSORS.slice(0, 6).map(s => s.name);
  // 6 sensors × 12 time slots = 72 cells, drawn column-first
  let html = '';
  HOURS.forEach((h, hi) => {
    sensorNames.forEach((sName, si) => {
      const v = Math.floor(Math.random() * 5);
      html += `<div class="heatmap-cell" style="background:${HEAT_COLORS[v]}" title="${sName} at ${h}:00 — activity level ${v+1}/5"></div>`;
    });
  });
  el.innerHTML = html;
}

// ===================================================
// AUTO SIMULATION
// ===================================================
function autoSimulate() {
  if (Math.random() < 0.35) {
    const types = ['motion','door','window'];
    triggerEvent(types[Math.floor(Math.random() * types.length)]);
  }
}

// ===================================================
// INIT
// ===================================================
function init() {
  // Render sensor tab
  renderSensors();
  renderAnomalies();

  // Render gate log
  renderGateLog();

  // Init face canvas
  initFaceCanvas();

  // Seed initial activity feed
  const seedEvents = [
    ['Garden motion sensor triggered — outdoor perimeter active', 'warn', 'motion'],
    ['Front door opened and closed normally', 'normal', 'door'],
    ['Anomaly: back door opened 3× between 2–4 AM', 'alert', 'anomaly'],
    ['PIN authentication failed — unknown attempt', 'alert', 'fail'],
    ['Riya Sharma authenticated via fingerprint', 'normal', 'auth'],
    ['System armed — full perimeter active', 'normal', 'gate'],
  ];
  seedEvents.reverse().forEach(([msg, type, cat]) => addFeedItem(msg, type, cat));

  // Show initial anomaly banner
  showAnomalyBanner('Back door opened 3× between 2–4 AM — unusual pattern detected');

  // Notification badge
  STATE.notifCount = 2;
  updateNotifBadge();

  // Auto simulate events
  setInterval(autoSimulate, CONFIG.AUTO_EVENT_INTERVAL_MS);
}

// Run when DOM is ready
document.addEventListener('DOMContentLoaded', init);
