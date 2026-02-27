const canvas = document.getElementById('radar');
const ctx = canvas.getContext('2d');

let W, H, R, ox, oy;

function resize() {
  const container = canvas.parentElement;
  const availW = container.clientWidth;
  const availH = container.clientHeight;
  R = Math.min(availW / 2, availH) * 3.2 - 10;
  W = R * 2;
  H = R + 30;
  canvas.width = W;
  canvas.height = H;
  ox = W / 2;
  oy = H - 20;
}

window.addEventListener('resize', resize);
resize();

const MAX_DIST = 150;
let espIP = 'http://192.168.1.45';
let realAngle = 0;
let realDistance = -1;
let objCount = 0;
let lastDistance = -1;
let lastAngle = -1;
const blips = [];
const history = Array(30).fill(0);

const barChart = document.getElementById('bar-chart');
const bars = [];
for (let i = 0; i < 30; i++) {
  const b = document.createElement('div');
  b.className = 'bar';
  barChart.appendChild(b);
  bars.push(b);
}

function updateBars() {
  bars.forEach((b, i) => {
    const h = history[i] > 0 ? Math.min((history[i] / MAX_DIST) * 46, 46) : 2;
    b.style.height = h + 'px';
  });
}

function addLog(angle, dist) {
  const el = document.getElementById('log-entries');
  const t = new Date().toLocaleTimeString('en', { hour12: false });
  const d = document.createElement('div');
  d.className = 'log-line';
  d.innerHTML = `[${t}] ${angle}° <span>${dist > 0 ? dist.toFixed(1) + 'cm' : '---'}</span>`;
  el.prepend(d);
  while (el.children.length > 20) el.removeChild(el.lastChild);
}

setInterval(() => {
  document.getElementById('time').textContent =
    new Date().toLocaleTimeString('en', { hour12: false });
}, 1000);

function angleToXY(servoDeg, dist) {
  const distRatio = Math.min(dist / MAX_DIST, 1);
  const rad = Math.PI - (servoDeg * Math.PI / 180);
  const x = ox + Math.cos(rad) * R * distRatio;
  const y = oy - Math.sin(rad) * R * distRatio;
  return { x, y };
}

function sweepXY(servoDeg) {
  const rad = Math.PI - (servoDeg * Math.PI / 180);
  return {
    x: ox + Math.cos(rad) * R,
    y: oy - Math.sin(rad) * R
  };
}

async function fetchData() {
  try {
    const res = await fetch(`${espIP}/data`, { signal: AbortSignal.timeout(900) });
    const data = await res.json();
    realAngle = data.angle;
    realDistance = data.distance;

    // Connection status — always ON when fetch succeeds
    document.getElementById('conn-status').textContent = 'CONNECTED';
    document.getElementById('conn-status').style.color = 'var(--green)';

    // Status ON whenever connected — regardless of detection
    document.getElementById('status-val').textContent = 'ON';
    document.getElementById('status-val').style.color = 'var(--green)';

    document.getElementById('angle-val').textContent = realAngle;

    const distEl = document.getElementById('dist-val');
    if (realDistance > 0) {
      distEl.textContent = realDistance.toFixed(1);
      distEl.className = 'data-value';

      const { x, y } = angleToXY(realAngle, realDistance);
      blips.push({ x, y, age: 0 });

      const angleDiff = Math.abs(realAngle - lastAngle);
      const distDiff = Math.abs(realDistance - lastDistance);

      if (lastDistance < 0 || (angleDiff > 10 && distDiff > 5)) {
        objCount++;
        document.getElementById('obj-val').textContent = objCount;
      }

      lastDistance = realDistance;
      lastAngle = realAngle;

    } else {
      // No object detected — show ?? but keep status ON
      distEl.textContent = '??';
      distEl.className = 'data-value warning';
      lastDistance = -1;
    }

    addLog(realAngle, realDistance);
    history.push(realDistance > 0 ? realDistance : 0);
    history.shift();
    updateBars();

  } catch {
    // Only turn OFF when fetch itself fails (ESP disconnected)
    document.getElementById('conn-status').textContent = 'DISCONNECTED';
    document.getElementById('conn-status').style.color = '#ff4444';
    document.getElementById('status-val').textContent = 'OFF';
    document.getElementById('status-val').style.color = '#ff4444';
  }
}

setInterval(fetchData, 50);

function applyIP() {
  espIP = 'http://' + document.getElementById('esp-ip').value.replace('http://', '');
  objCount = 0;
  lastDistance = -1;
  lastAngle = -1;
}

function draw() {
  requestAnimationFrame(draw);
  if (!R) return;
  ctx.clearRect(0, 0, W, H);

  ctx.fillStyle = '#030a03';
  ctx.beginPath();
  ctx.arc(ox, oy, R, Math.PI, 0, false);
  ctx.closePath();
  ctx.fill();

  [0.25, 0.5, 0.75, 1].forEach(f => {
    ctx.beginPath();
    ctx.arc(ox, oy, R * f, Math.PI, 0, false);
    ctx.strokeStyle = '#00ff4122';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#00ff4166';
    ctx.font = `${Math.max(9, R * 0.025)}px Share Tech Mono`;
    ctx.textAlign = 'center';
    ctx.fillText(Math.round(MAX_DIST * f) + 'cm', ox, oy - R * f + 14);
  });

  for (let deg = 0; deg <= 180; deg += 30) {
    const rad = Math.PI - (deg * Math.PI / 180);
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(ox + Math.cos(rad) * R, oy - Math.sin(rad) * R);
    ctx.strokeStyle = '#00ff4118';
    ctx.lineWidth = 1;
    ctx.stroke();

    if (deg > 0 && deg < 180) {
      const lx = ox + Math.cos(rad) * (R + 16);
      const ly = oy - Math.sin(rad) * (R + 16);
      ctx.fillStyle = '#00ff4155';
      ctx.font = '9px Share Tech Mono';
      ctx.textAlign = 'center';
      ctx.fillText(deg + '°', lx, ly + 4);
    }
  }

  const sweep = sweepXY(realAngle);

  for (let i = 0; i < 40; i++) {
    const trailDeg = realAngle - (i / 40) * 25;
    const trad = Math.PI - (trailDeg * Math.PI / 180);
    const alpha = (1 - i / 40) * 0.35;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(ox + Math.cos(trad) * R, oy - Math.sin(trad) * R);
    ctx.strokeStyle = `rgba(0,255,65,${alpha})`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.moveTo(ox, oy);
  ctx.lineTo(sweep.x, sweep.y);
  ctx.strokeStyle = '#00ff41';
  ctx.lineWidth = 2;
  ctx.shadowColor = '#00ff41';
  ctx.shadowBlur = 10;
  ctx.stroke();
  ctx.shadowBlur = 0;

  blips.forEach(b => {
    const alpha = Math.max(0, 1 - b.age / 180);
    const size = 4 * alpha + 2;
    ctx.beginPath();
    ctx.arc(b.x, b.y, size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0,255,65,${alpha})`;
    ctx.shadowColor = '#00ff41';
    ctx.shadowBlur = 14 * alpha;
    ctx.fill();
    ctx.shadowBlur = 0;
    b.age++;
  });
  for (let i = blips.length - 1; i >= 0; i--) {
    if (blips[i].age > 180) blips.splice(i, 1);
  }

  ctx.beginPath();
  ctx.arc(ox, oy, R, Math.PI, 0, false);
  ctx.strokeStyle = '#00ff4166';
  ctx.lineWidth = 2;
  ctx.shadowColor = '#00ff41';
  ctx.shadowBlur = 6;
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.beginPath();
  ctx.moveTo(ox - R, oy);
  ctx.lineTo(ox + R, oy);
  ctx.strokeStyle = '#00ff4166';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#00ff4199';
  ctx.font = '10px Share Tech Mono';
  ctx.textAlign = 'right';
  ctx.fillText('0°', ox - R - 4, oy + 4);
  ctx.textAlign = 'left';
  ctx.fillText('180°', ox + R + 4, oy + 4);

  ctx.beginPath();
  ctx.arc(ox, oy, 5, 0, Math.PI * 2);
  ctx.fillStyle = '#00ff41';
  ctx.shadowColor = '#00ff41';
  ctx.shadowBlur = 12;
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#00ff4188';
  ctx.font = '9px Share Tech Mono';
  ctx.textAlign = 'center';
  ctx.fillText('[ SENSOR ]', ox, oy + 16);
}

draw();