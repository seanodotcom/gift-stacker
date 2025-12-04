// Module aliases
const Engine = Matter.Engine,
    Render = Matter.Render,
    Runner = Matter.Runner,
    Bodies = Matter.Bodies,
    Composite = Matter.Composite,
    Events = Matter.Events,
    Body = Matter.Body;

// Game State
let engine;
let render;
let runner;
let lastTime = 0;
let animationFrameId;
let boxes = [];
let currentBox = null;
let platform = null;
let gameInterval = null;
let gameState = 'START';
let highScore = localStorage.getItem('giftStackerHighScore') || 0;
let isPaused = false;
let spawnerX = 0;
let spawnerDirection = 1;
const BASE_SPAWNER_SPEED = 6.25;
const BASE_GRAVITY = 1.4;
let slideSpeedMult = parseFloat(localStorage.getItem('giftStackerSlideSpeed')) || 1.0;
let dropSpeedMult = parseFloat(localStorage.getItem('giftStackerDropSpeed')) || 1.0;

let boxSize = 60;
let platformWidth = 500;
const PLATFORM_HEIGHT = 20;

// DOM Elements
const sceneElement = document.getElementById('scene');
const scoreElement = document.getElementById('score');
const highScoreElement = document.getElementById('high-score');
const startScreen = document.getElementById('start-screen');
const startHighScoreElement = document.getElementById('start-high-score');
const gameOverScreen = document.getElementById('game-over-screen');
const finalScoreElement = document.getElementById('final-score');
const gameOverHighScoreElement = document.getElementById('game-over-high-score');
const newRecordMsg = document.getElementById('new-record-msg');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const pauseBtn = document.getElementById('pause-btn');

// Settings Elements
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const slideSpeedInput = document.getElementById('slide-speed');
const dropSpeedInput = document.getElementById('drop-speed');
const slideSpeedVal = document.getElementById('slide-speed-val');
const dropSpeedVal = document.getElementById('drop-speed-val');

function init() {
    // Create engine
    engine = Engine.create();

    // Setup input
    document.addEventListener('mousedown', handleInput);
    document.addEventListener('touchstart', handleInput, { passive: false });

    startBtn.addEventListener('click', startGame);
    restartBtn.addEventListener('click', startGame);
    pauseBtn.addEventListener('click', togglePause);

    // Settings Listeners
    settingsBtn.addEventListener('click', openSettings);
    closeSettingsBtn.addEventListener('click', saveSettings);
    slideSpeedInput.addEventListener('input', updateSettingsUI);
    dropSpeedInput.addEventListener('input', updateSettingsUI);

    // Set gravity
    engine.world.gravity.y = BASE_GRAVITY * dropSpeedMult;

    // Collision Event for Scoring
    Events.on(engine, 'collisionStart', (event) => {
        const pairs = event.pairs;

        pairs.forEach((pair) => {
            const bodyA = pair.bodyA;
            const bodyB = pair.bodyB;

            // Check if one of the bodies is a box that hasn't scored yet
            // We check against 'platform' or 'box' labels
            checkScore(bodyA, bodyB);
            checkScore(bodyB, bodyA);
        });
    });

    // Show initial high score
    updateHighScoreDisplay();

    // Initial render loop (just for the background/UI, physics not running yet)
    // Actually, we'll start the loop but only update physics in PLAYING state
    requestAnimationFrame(update);
}

function startGame() {
    gameState = 'PLAYING';
    isPaused = false;
    score = 0;
    scoreElement.innerText = `${score}`; // Just number now
    pauseBtn.innerText = '❚❚';
    boxes = [];
    sceneElement.innerHTML = ''; // Clear existing boxes
    Composite.clear(engine.world);
    Engine.clear(engine);

    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    newRecordMsg.classList.add('hidden'); // Hide new record msg on start

    // Set gravity again in case Engine.clear reset it
    engine.world.gravity.y = BASE_GRAVITY * dropSpeedMult;

    // Create Platform
    // Calculate dynamic sizes
    const width = window.innerWidth;
    const height = window.innerHeight;
    platformWidth = Math.max(width * 0.5, 200); // Min width 200
    boxSize = Math.max(width * 0.2, 40); // Min width 40

    // Create Platform
    platform = Bodies.rectangle(width / 2, height - 50, platformWidth, PLATFORM_HEIGHT, {
        isStatic: true,
        label: 'platform'
    });
    Composite.add(engine.world, platform);
    createDomElement(platform, 'platform');

    // Create Ground (invisible, for catching falling boxes)
    const ground = Bodies.rectangle(width / 2, height + 100, width * 2, 50, {
        isStatic: true,
        label: 'ground',
        isSensor: true // Don't collide physically, just detect
    });
    Composite.add(engine.world, ground);

    // Spawn first box
    spawnBox();

    // Start physics runner logic manually in update loop or use Runner
    // We will use manual engine.update in our loop for better control with DOM sync
}

function spawnBox() {
    const width = window.innerWidth;
    spawnerX = width / 2;

    // Or just track position logically and create body when dropped?
    // Let's create the body but make it static initially.

    currentBox = Bodies.rectangle(spawnerX, 100, boxSize, boxSize, {
        isStatic: true,
        label: 'box',
        restitution: 0.1,
        friction: 0.5
    });

    // Custom property to track if this box has contributed to score
    currentBox.hasScored = false;

    Composite.add(engine.world, currentBox);
    createDomElement(currentBox, 'box');
}

function handleInput(e) {
    if (gameState !== 'PLAYING' || isPaused) return;
    if (e.target.tagName === 'BUTTON') return; // Ignore button clicks

    e.preventDefault(); // Prevent default touch actions

    if (currentBox && currentBox.isStatic) {
        dropBox();
    }
}

function dropBox() {
    if (!currentBox) return;

    Body.setStatic(currentBox, false);
    // Give it a tiny random rotation to make it interesting? No, straight drop is better for skill.

    // Check if we should spawn a new one? 
    // We need to wait for it to settle or just spawn the next one after a delay?
    // Let's spawn next one after a short delay.

    // Add to boxes array to track
    boxes.push(currentBox);
    currentBox = null;

    // Score is updated in collision or update loop based on "landed" count
    // But for immediate feedback, we can update it in checkScore

    setTimeout(() => {
        if (gameState === 'PLAYING') {
            spawnBox();
        }
    }, 1000);
}

function createDomElement(body, className) {
    const div = document.createElement('div');
    div.classList.add(className);
    div.id = `body-${body.id}`;

    // Set size
    // Matter.js bodies are defined by center, but DOM is top-left.
    // We will handle positioning in update loop.
    // But we need to set width/height.
    // Assuming rectangles for now.
    const bounds = body.bounds;
    const width = bounds.max.x - bounds.min.x;
    const height = bounds.max.y - bounds.min.y;

    div.style.width = `${width}px`;
    div.style.height = `${height}px`;

    // Random color for boxes
    if (className === 'box') {
        const colors = ['#d32f2f', '#1976d2', '#388e3c', '#fbc02d', '#7b1fa2'];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        div.style.backgroundColor = randomColor;
        div.style.borderColor = adjustColor(randomColor, -20);
    }

    sceneElement.appendChild(div);
    body.render = { element: div }; // Store reference
}

function update() {
    try {
        if (gameState === 'PLAYING' && !isPaused) {
            const width = window.innerWidth;

            // Move Spawner / Current Box
            if (currentBox && currentBox.isStatic) {
                spawnerX += spawnerDirection * (BASE_SPAWNER_SPEED * slideSpeedMult);

                // Boundary checks with direction check to prevent sticking
                if ((spawnerX > width - boxSize / 2 && spawnerDirection > 0) ||
                    (spawnerX < boxSize / 2 && spawnerDirection < 0)) {
                    spawnerDirection *= -1;
                }

                // Clamp position to be safe
                spawnerX = Math.max(boxSize / 2, Math.min(width - boxSize / 2, spawnerX));

                Body.setPosition(currentBox, { x: spawnerX, y: 100 });
                Body.setVelocity(currentBox, { x: 0, y: 0 }); // Reset velocity just in case
            }

            Engine.update(engine, 1000 / 60);

            // Check Game Over
            // If any box falls below the screen
            boxes.forEach(box => {
                if (box.position.y > window.innerHeight + 100) {
                    gameOver();
                }
            });
        }

        // Sync DOM
        Composite.allBodies(engine.world).forEach(body => {
            if (body.render && body.render.element) {
                const { x, y } = body.position;
                const angle = body.angle;
                const div = body.render.element;

                // Translate to center-based coordinates
                // Use style width/height to avoid layout thrashing and potential 0 values
                const w = parseFloat(div.style.width);
                const h = parseFloat(div.style.height);
                div.style.transform = `translate(${x - w / 2}px, ${y - h / 2}px) rotate(${angle}rad)`;
            }
        });

        requestAnimationFrame(update);
    } catch (e) {
        console.error("Game Loop Error:", e);
        // Try to recover
        requestAnimationFrame(update);
    }
}

function gameOver() {
    gameState = 'GAMEOVER';
    finalScoreElement.innerText = score;

    if (score > highScore) {
        highScore = score;
        localStorage.setItem('giftStackerHighScore', highScore);
        updateHighScoreDisplay();
        newRecordMsg.classList.remove('hidden'); // Show celebration

        // Confetti!
        confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#d32f2f', '#ffd700', '#ffffff', '#388e3c']
        });

    } else {
        newRecordMsg.classList.add('hidden');
    }

    gameOverScreen.classList.remove('hidden');
}

function togglePause() {
    if (gameState !== 'PLAYING') return;
    isPaused = !isPaused;
    pauseBtn.innerText = isPaused ? '▶' : '❚❚';
}

function updateHighScoreDisplay() {
    highScoreElement.innerText = `Best: ${highScore}`;
    startHighScoreElement.innerText = `${highScore}`; // Just number
    gameOverHighScoreElement.innerText = `High Score: ${highScore}`;
}

// Settings Functions
function openSettings() {
    settingsModal.classList.remove('hidden');
    startScreen.classList.add('hidden');
    slideSpeedInput.value = slideSpeedMult;
    dropSpeedInput.value = dropSpeedMult;
    updateSettingsUI();
}

function saveSettings() {
    slideSpeedMult = parseFloat(slideSpeedInput.value);
    dropSpeedMult = parseFloat(dropSpeedInput.value);

    localStorage.setItem('giftStackerSlideSpeed', slideSpeedMult);
    localStorage.setItem('giftStackerDropSpeed', dropSpeedMult);

    settingsModal.classList.add('hidden');
    startScreen.classList.remove('hidden');
}

function updateSettingsUI() {
    slideSpeedVal.innerText = slideSpeedInput.value + 'x';
    dropSpeedVal.innerText = dropSpeedInput.value + 'x';
}

// Helper to darken colors
function adjustColor(color, amount) {
    return '#' + color.replace(/^#/, '').replace(/../g, color => ('0' + Math.min(255, Math.max(0, parseInt(color, 16) + amount)).toString(16)).substr(-2));
}

// Helper to check and update score on collision
function checkScore(body, otherBody) {
    if (body.label === 'box' && !body.hasScored && !body.isStatic) {
        // If it hits the platform or another box (that isn't itself, though collision pairs usually distinct)
        if (otherBody.label === 'platform' || otherBody.label === 'box') {
            body.hasScored = true;
            // Recalculate score based on all landed boxes
            score = boxes.filter(b => b.hasScored).length;
            scoreElement.innerText = `${score}`;
        }
    }
}

init();
