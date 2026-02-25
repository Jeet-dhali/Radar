const canvas = document.getElementById("radar");
const ctx = canvas.getContext("2d");

const center = 250;
const maxRadius = 220;

let sweepAngle = 0;
let objects = [];

function drawRadarBase() {
    ctx.clearRect(0, 0, 500, 500);

    // Rings
    for (let i = 1; i <= 4; i++) {
        ctx.beginPath();
        ctx.arc(center, center, (maxRadius / 4) * i, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(0,255,100,0.3)";
        ctx.stroke();
    }

    // Cross lines
    ctx.beginPath();
    ctx.moveTo(center, center - maxRadius);
    ctx.lineTo(center, center + maxRadius);
    ctx.moveTo(center - maxRadius, center);
    ctx.lineTo(center + maxRadius, center);
    ctx.strokeStyle = "rgba(0,255,100,0.2)";
    ctx.stroke();
}

function drawSweep() {
    const rad = sweepAngle * Math.PI / 180;

    const x = center + maxRadius * Math.cos(rad);
    const y = center + maxRadius * Math.sin(rad);

    ctx.beginPath();
    ctx.moveTo(center, center);
    ctx.lineTo(x, y);
    ctx.strokeStyle = "#00ff88";
    ctx.lineWidth = 3;
    ctx.stroke();
}

function drawObjects() {
    objects.forEach(obj => {
        ctx.beginPath();
        ctx.arc(obj.x, obj.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = "#00ff88";
        ctx.shadowBlur = 20;
        ctx.shadowColor = "#00ff88";
        ctx.fill();
        ctx.shadowBlur = 0;
    });
}

function updateRadar() {
    drawRadarBase();
    drawSweep();
    drawObjects();

    sweepAngle += 1;
    if (sweepAngle >= 360) sweepAngle = 0;

    // Demo random object
    if (Math.random() < 0.02) {
        const angle = Math.random() * 360;
        const radius = Math.random() * maxRadius;
        const rad = angle * Math.PI / 180;
        const x = center + radius * Math.cos(rad);
        const y = center + radius * Math.sin(rad);
        objects.push({ x, y });
        if (objects.length > 15) objects.shift();
    }

    requestAnimationFrame(updateRadar);
}

updateRadar();