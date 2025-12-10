const canvas = document.createElement('canvas');
canvas.id = 'snow-canvas';
document.body.prepend(canvas);

const ctx = canvas.getContext('2d');
let width = window.innerWidth;
let height = window.innerHeight;
canvas.width = width;
canvas.height = height;

const snowflakes = [];

function createSnowflake() {
    return {
        x: Math.random() * width,
        y: Math.random() * -50,
        vx: (Math.random() - 0.5) * 1,
        vy: Math.random() * 2 + 1,
        radius: Math.random() * 3 + 1,
        opacity: Math.random() * 0.5 + 0.3
    };
}

for (let i = 0; i < 100; i++) {
    snowflakes.push(createSnowflake());
}

function updateSnow() {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = 'white';

    for (let flake of snowflakes) {
        flake.x += flake.vx;
        flake.y += flake.vy;

        ctx.globalAlpha = flake.opacity;
        ctx.beginPath();
        ctx.arc(flake.x, flake.y, flake.radius, 0, Math.PI * 2);
        ctx.fill();

        if (flake.y > height) {
            flake.y = -10;
            flake.x = Math.random() * width;
        }
    }

    // Low performance check (simple wrapper)
    requestAnimationFrame(updateSnow);
}

window.addEventListener('resize', () => {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
});

// Start
updateSnow();
