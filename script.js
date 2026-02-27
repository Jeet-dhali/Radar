  const canvas = document.getElementById('radar');
  const ctx = canvas.getContext('2d');

  let W, H, R, ox, oy;

  function resize() {
    const container = canvas.parentElement;
    const availW = container.clientWidth;
    const availH = container.clientHeight;
    // Semicircle: height = radius, width = 2*radius
    R = Math.min(availW / 2, availH) * 3.4 - 10;
    W = R * 2;
    H = R + 30; // a bit of room below origin
    canvas.width = W;
    canvas.height = H;
    ox = W / 2;
    oy = H - 20; // origin at bottom center
  }

  window.addEventListener('resize', resize);
  resize();

  const MAX_DIST = 150;
  let espIP = 'http://192.168.1.45';
  let realAngle = 0;
  let realDistance = -1;
  let objCount = 0;
  const blips = [];
  const history = Array(30).fill(0);

  // Bar chart
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

  // ── Convert servo angle (0–180) to canvas coords
  // 0° = left, 90° = straight up, 180° = right
  function angleToXY(servoDeg, dist) {
    const distRatio = Math.min(dist / MAX_DIST, 1);
    // Map: 0° → leftward (π), 90° → upward (π/2), 180° → rightward (0)
    const rad = Math.PI - (servoDeg * Math.PI / 180);
    const x = ox + Math.cos(rad) * R * distRatio;
    const y = oy - Math.sin(rad) * R * distRatio; // subtract because canvas y is inverted
    return { x, y };
  }

  function sweepXY(servoDeg) {
    const rad = Math.PI - (servoDeg * Math.PI / 180);
    return {
      x: ox + Math.cos(rad) * R,
      y: oy - Math.sin(rad) * R
    };
  }

  // ── Fetch ESP data
  async function fetchData() {
    try {
      const res = await fetch(`${espIP}/data`, { signal: AbortSignal.timeout(900) });
      const data = await res.json();
      realAngle = data.angle;
      realDistance = data.distance;

      document.getElementById('conn-status').textContent = 'CONNECTED';
      document.getElementById('conn-status').style.color = 'var(--green)';
      document.getElementById('status-val').textContent = 'ON';
      document.getElementById('status-val').style.color = 'var(--green)';
      document.getElementById('angle-val').textContent = realAngle;

      const distEl = document.getElementById('dist-val');
      if (realDistance > 0) {
        distEl.textContent = realDistance.toFixed(1);
        distEl.className = 'data-value';
        // blip
        const { x, y } = angleToXY(realAngle, realDistance);
        blips.push({ x, y, age: 0 });
        objCount++;
        document.getElementById('obj-val').textContent = objCount;
      } else {
        distEl.textContent = '??';
        distEl.className = 'data-value warning';
      }

      addLog(realAngle, realDistance);
      history.push(realDistance > 0 ? realDistance : 0);
      history.shift();
      updateBars();

    } catch {
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
  }

  // ── Draw
  function draw() {
    requestAnimationFrame(draw);
    if (!R) return;
    ctx.clearRect(0, 0, W, H);

    // Dark fill for semicircle
    ctx.fillStyle = '#030a03';
    ctx.beginPath();
    ctx.arc(ox, oy, R, Math.PI, 0, false);
    ctx.closePath();
    ctx.fill();

    // Range rings (semicircles)
    [0.25, 0.5, 0.75, 1].forEach(f => {
      ctx.beginPath();
      ctx.arc(ox, oy, R * f, Math.PI, 0, false);
      ctx.strokeStyle = '#00ff4122';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Distance label at top of each ring
      ctx.fillStyle = '#00ff4166';
      ctx.font = `${Math.max(9, R * 0.025)}px Share Tech Mono`;
      ctx.textAlign = 'center';
      ctx.fillText(Math.round(MAX_DIST * f) + 'cm', ox, oy - R * f + 14);
    });

    // Radial grid lines at every 30°
    for (let deg = 0; deg <= 180; deg += 30) {
      const rad = Math.PI - (deg * Math.PI / 180);
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(ox + Math.cos(rad) * R, oy - Math.sin(rad) * R);
      ctx.strokeStyle = '#00ff4118';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Angle labels along the base
      if (deg > 0 && deg < 180) {
        const lx = ox + Math.cos(rad) * (R + 16);
        const ly = oy - Math.sin(rad) * (R + 16);
        ctx.fillStyle = '#00ff4155';
        ctx.font = '9px Share Tech Mono';
        ctx.textAlign = 'center';
        ctx.fillText(deg + '°', lx, ly + 4);
      }
    }

    // Sweep line from real servo angle
    const sweep = sweepXY(realAngle);

    // Trail
    const trailSpan = 25; // degrees of trail
    for (let i = 0; i < 40; i++) {
      const trailDeg = realAngle - (i / 40) * trailSpan;
      const trad = Math.PI - (trailDeg * Math.PI / 180);
      const alpha = (1 - i / 40) * 0.35;
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(ox + Math.cos(trad) * R, oy - Math.sin(trad) * R);
      ctx.strokeStyle = `rgba(0,255,65,${alpha})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Main sweep line
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(sweep.x, sweep.y);
    ctx.strokeStyle = '#00ff41';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#00ff41';
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Blips
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

    // Outer arc
    ctx.beginPath();
    ctx.arc(ox, oy, R, Math.PI, 0, false);
    ctx.strokeStyle = '#00ff4166';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#00ff41';
    ctx.shadowBlur = 6;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Baseline
    ctx.beginPath();
    ctx.moveTo(ox - R, oy);
    ctx.lineTo(ox + R, oy);
    ctx.strokeStyle = '#00ff4166';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 0° / 180° labels
    ctx.fillStyle = '#00ff4199';
    ctx.font = '10px Share Tech Mono';
    ctx.textAlign = 'right';
    ctx.fillText('0°', ox - R - 4, oy + 4);
    ctx.textAlign = 'left';
    ctx.fillText('180°', ox + R + 4, oy + 4);

    // Origin dot
    ctx.beginPath();
    ctx.arc(ox, oy, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#00ff41';
    ctx.shadowColor = '#00ff41';
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.shadowBlur = 0;

    // "YOU" label at origin
    ctx.fillStyle = '#00ff4188';
    ctx.font = '9px Share Tech Mono';
    ctx.textAlign = 'center';
    ctx.fillText('[ SENSOR ]', ox, oy + 16);
  }

  draw();