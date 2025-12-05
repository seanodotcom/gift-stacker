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
let randomSizes = localStorage.getItem('giftStackerRandomSizes') === 'true'; // Default false unless 'true' string present

let boxSize = 60;
let platformWidth = 500;
const PLATFORM_HEIGHT = 20;

// DOM Elements
const menuBtn = document.getElementById('menu-btn');
const pauseMenuModal = document.getElementById('pause-menu-modal');
const resumeBtn = document.getElementById('resume-btn');
const quitGameBtn = document.getElementById('quit-game-btn');
const releaseNotesBtn = document.getElementById('release-notes-btn');
const releaseNotesModal = document.getElementById('release-notes-modal');
const closeNotesBtn = document.getElementById('close-notes-btn');

const quitConfirmModal = document.getElementById('quit-confirm-modal');
const confirmQuitBtn = document.getElementById('confirm-quit-btn');
const cancelQuitBtn = document.getElementById('cancel-quit-btn');

const resetScoreModal = document.getElementById('reset-score-modal');
const confirmResetBtn = document.getElementById('confirm-reset-btn');
const cancelResetBtn = document.getElementById('cancel-reset-btn');

// Settings Elements
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const slideSpeedInput = document.getElementById('slide-speed');
const dropSpeedInput = document.getElementById('drop-speed');
const slideSpeedVal = document.getElementById('slide-speed-val');
const dropSpeedVal = document.getElementById('drop-speed-val');
const randomSizesInput = document.getElementById('random-sizes');
const bounceInput = document.getElementById('bounce');
const bounceVal = document.getElementById('bounce-val');
const resetScoreBtn = document.getElementById('reset-score-btn');
const christmasBg = document.getElementById('christmas-bg');

// Missing DOM Elements
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const sceneElement = document.getElementById('scene');
const scoreElement = document.getElementById('score');
const highScoreElement = document.getElementById('high-score');
const startHighScoreElement = document.getElementById('start-high-score');
const gameOverHighScoreElement = document.getElementById('game-over-high-score');
const finalScoreElement = document.getElementById('final-score');
const newRecordMsg = document.getElementById('new-record-msg');

// Additional State
let restitutionVal = parseFloat(localStorage.getItem('giftStackerBounce')) || 0.5;

function init() {
    // Create engine
    engine = Engine.create();

    // Setup input
    document.addEventListener('mousedown', handleInput);
    document.addEventListener('touchstart', handleInput, { passive: false });

    startBtn.addEventListener('click', startGame);
    restartBtn.addEventListener('click', startGame);

    // Menu & Modals
    menuBtn.addEventListener('click', () => {
        if (gameState === 'PLAYING') {
            isPaused = true;
            pauseMenuModal.classList.remove('hidden');
        }
    });

    resumeBtn.addEventListener('click', () => {
        isPaused = false;
        pauseMenuModal.classList.add('hidden');
    });

    quitGameBtn.addEventListener('click', () => {
        pauseMenuModal.classList.add('hidden');
        quitConfirmModal.classList.remove('hidden');
    });

    confirmQuitBtn.addEventListener('click', () => {
        quitConfirmModal.classList.add('hidden');
        quitGame();
    });

    cancelQuitBtn.addEventListener('click', () => {
        quitConfirmModal.classList.add('hidden');
        pauseMenuModal.classList.remove('hidden');
    });

    releaseNotesBtn.addEventListener('click', () => {
        pauseMenuModal.classList.add('hidden');
        releaseNotesModal.classList.remove('hidden');
    });

    closeNotesBtn.addEventListener('click', () => {
        releaseNotesModal.classList.add('hidden');
        // If game is in progress, go back to pause menu
        if (gameState === 'PLAYING') {
            pauseMenuModal.classList.remove('hidden');
        }
    });

    // Settings Listeners
    settingsBtn.addEventListener('click', openSettings);
    closeSettingsBtn.addEventListener('click', saveSettings);
    slideSpeedInput.addEventListener('input', updateSettingsUI);
    dropSpeedInput.addEventListener('input', updateSettingsUI);
    bounceInput.addEventListener('input', updateSettingsUI);

    // Reset Score Logic (Now from Game Over screen)
    resetScoreBtn.addEventListener('click', () => {
        resetScoreModal.classList.remove('hidden');
    });

    confirmResetBtn.addEventListener('click', () => {
        highScore = 0;
        localStorage.setItem('giftStackerHighScore', 0);
        updateHighScoreDisplay();
        resetScoreModal.classList.add('hidden');
    });

    cancelResetBtn.addEventListener('click', () => {
        resetScoreModal.classList.add('hidden');
    });

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

    // Start Snow System
    snowSystem = new SnowSystem(christmasBg);
    snowSystem.start();

    // Initial render loop (just for the background/UI, physics not running yet)
    // Actually, we'll start the loop but only update physics in PLAYING state
    requestAnimationFrame(update);
}

function startGame() {
    gameState = 'PLAYING';
    isPaused = false;
    score = 0;
    scoreElement.innerText = `${score}`;
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

    // SCALING LOGIC
    // Use Math.min(Math.max(width * 0.15, 60), 120) to ensure boxes aren't too small on mobile or too huge on desktop.
    boxSize = Math.min(Math.max(width * 0.15, 60), 120);

    // Create Platform
    platform = Bodies.rectangle(width / 2, height - 50, platformWidth, PLATFORM_HEIGHT, {
        isStatic: true,
        label: 'platform'
    });
    Composite.add(engine.world, platform);
    createDomElement(platform, 'platform');

    lastTime = performance.now(); // Reset time for DeltaTime calculation

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

function quitGame() {
    gameState = 'START';
    isPaused = false;
    boxes = [];
    sceneElement.innerHTML = '';
    Composite.clear(engine.world);
    Engine.clear(engine);

    startScreen.classList.remove('hidden');
    gameOverScreen.classList.add('hidden');
    pauseMenuModal.classList.add('hidden');

    // Reset background physics
    // platform, ground etc will be recreated on startGame
}

function spawnBox() {
    const width = window.innerWidth;
    spawnerX = width / 2;

    // Or just track position logically and create body when dropped?
    // Let's create the body but make it static initially.

    // Random Size Logic
    let currentWidth = boxSize;
    let currentHeight = boxSize;

    if (randomSizes) {
        const variance = 0.15; // 15%
        const widthFactor = 1 + (Math.random() * variance * 2 - variance);
        const heightFactor = 1 + (Math.random() * variance * 2 - variance);
        currentWidth = boxSize * widthFactor;
        currentHeight = boxSize * heightFactor;
    }

    currentBox = Bodies.rectangle(spawnerX, 100, currentWidth, currentHeight, {
        isStatic: true,
        label: 'box',
        restitution: restitutionVal,
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

        // Random Ribbon Color
        const ribbonColors = ['ribbon-yellow', 'ribbon-white', 'ribbon-gray', 'ribbon-blue', 'ribbon-green', 'ribbon-purple'];
        const randomRibbon = ribbonColors[Math.floor(Math.random() * ribbonColors.length)];
        div.classList.add(randomRibbon);
    }

    sceneElement.appendChild(div);
    body.render = { element: div }; // Store reference
}

function update() {
    try {
        const now = performance.now();
        const dt = now - lastTime;
        lastTime = now;

        if (gameState === 'PLAYING' && !isPaused) {
            const width = window.innerWidth;

            // Move Spawner / Current Box using Delta Time
            // BASE_SPAWNER_SPEED (6.25) was good at 60fps (16.6ms).
            // Factor = dt / 16.67
            const timeScale = dt / 16.67;

            if (currentBox && currentBox.isStatic) {
                spawnerX += spawnerDirection * (BASE_SPAWNER_SPEED * slideSpeedMult * timeScale);

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

            Engine.update(engine, Math.min(dt, 50)); // Clamp max dt to prevent explosion on lag

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

    // Recalculate score to exclude any boxes that fell off screen
    // Score = number of boxes that have scored AND are still visible (y < window height)
    const validBoxes = boxes.filter(b => b.hasScored && b.position.y < window.innerHeight);
    score = validBoxes.length;

    // Sync the main scorebug to reflect the "stable" score
    scoreElement.innerText = `${score}`;

    finalScoreElement.innerText = score;

    // Handle High Score
    // Get the previously saved high score (guaranteed stable)
    const savedTop = parseFloat(localStorage.getItem('giftStackerHighScore')) || 0;

    if (score > savedTop) {
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
        // If we didn't beat the real high score, revert the optimistic display if needed
        highScore = savedTop;
        updateHighScoreDisplay();
        newRecordMsg.classList.add('hidden');
    }

    gameOverScreen.classList.remove('hidden');
}

// function togglePause() { ... } // Removed old togglePause, logic handled by menu listeners

function updateHighScoreDisplay() {
    highScoreElement.innerText = `Best: ${highScore}`;
    startHighScoreElement.innerText = `${highScore}`; // Just number
    gameOverHighScoreElement.innerText = `High Score: ${highScore}`;
}

// Settings Functions
// Snow System
class SnowSystem {
    constructor(container) {
        this.container = container;
        this.flakes = [];
        this.active = true;
        this.spawnInterval = null;
        this.maxFlakes = 50;
    }

    start() {
        if (!this.active) return;
        this.spawnInterval = setInterval(() => this.spawnFlake(), 200);
        this.updateLoop();
    }

    stop() {
        this.active = false;
        clearInterval(this.spawnInterval);
    }

    spawnFlake() {
        if (this.flakes.length >= this.maxFlakes) return;

        const flake = document.createElement('div');
        flake.innerHTML = Math.random() > 0.5 ? '❅' : '❆';
        flake.className = 'snowflake-js';

        // Random properties
        const size = 10 + Math.random() * 15;
        const x = Math.random() * window.innerWidth;
        const duration = 5000 + Math.random() * 5000;
        const delay = Math.random() * 2000;
        const blur = Math.random() * 2;

        flake.style.cssText = `
            left: ${x}px;
            font-size: ${size}px;
            animation-duration: ${duration}ms;
            filter: blur(${blur}px);
            opacity: 0.8;
            top: -20px;
        `;

        this.container.appendChild(flake);

        const flakeObj = {
            element: flake,
            x: x,
            y: -20,
            speed: (window.innerHeight + 20) / (duration / 16),
            landed: false,
            meltTimer: 0,
            flutter: Math.random() < 0.3, // 30% chance to flutter
            flutterSpeed: 1.5 + Math.random() * 2.0, // Radians per second
            flutterOffset: Math.random() * 100
        };

        this.flakes.push(flakeObj);
    }

    updateLoop() {
        if (!this.active) return;

        // Platform Y is around window.innerHeight - 50
        const platformY = window.innerHeight - 50;
        const platformX = window.innerWidth / 2;
        // platformWidth is global

        this.flakes.forEach((f, index) => {
            if (f.landed) {
                f.meltTimer++;
                if (f.meltTimer > 100) { // Melt away
                    f.element.style.opacity = Math.max(0, 0.8 - (f.meltTimer - 100) * 0.02);
                    if (f.meltTimer > 150) {
                        f.element.remove();
                        this.flakes.splice(index, 1);
                    }
                }
                return;
            }

            f.y += f.speed;
            f.element.style.top = `${f.y}px`;

            // Horizontal Movement
            let currentX = f.x;

            // Wiggle (standard)
            let xOffset = Math.sin(Date.now() / 1000 + f.x) * 0.5;

            // Flutter effect (stronger side-to-side)
            if (f.flutter) {
                // Use Date.now() / 1000 for seconds-based smooth animation
                // f.flutterSpeed was ~0.05. 
                // Math.sin(time * speed) -> speed need to be around 1-3 for gentle wave
                // Date.now()/1000 * (1 + random)

                // Let's redefine flutterSpeed usage:
                // Pre-calculated speed factor: 2.0 to 4.0
                const t = Date.now() / 1000;
                xOffset += Math.sin(t * f.flutterSpeed + f.flutterOffset) * 20.0; // Wide subtle swing
            }

            f.element.style.left = `${currentX + xOffset}px`; // Apply directly to left to avoid transform overwrites
            // We kept transform translateX previously but modifying left is cleaner for flutter
            // Actually, let's stick to transform for performance, but combine them.
            f.element.style.transform = `translateX(${xOffset}px)`;

            // Check landing on platform
            if (f.y >= platformY && f.y <= platformY + 10) {
                if (Math.abs(f.x - platformX) < platformWidth / 2) {
                    f.landed = true;
                    // f.element.style.color = '#e0f7fa'; // Icy look?
                }
            }

            // Remove if fallen off screen
            if (f.y > window.innerHeight) {
                f.element.remove();
                this.flakes.splice(index, 1);
            }
        });

        requestAnimationFrame(() => this.updateLoop());
    }
}

let snowSystem;

function openSettings() {
    settingsModal.classList.remove('hidden');
    startScreen.classList.add('hidden');
    slideSpeedInput.value = slideSpeedMult;
    dropSpeedInput.value = dropSpeedMult;
    randomSizesInput.checked = randomSizes;
    bounceInput.value = restitutionVal;
    updateSettingsUI();
}

function saveSettings() {
    slideSpeedMult = parseFloat(slideSpeedInput.value);
    dropSpeedMult = parseFloat(dropSpeedInput.value);
    randomSizes = randomSizesInput.checked;
    restitutionVal = parseFloat(bounceInput.value);

    localStorage.setItem('giftStackerSlideSpeed', slideSpeedMult);
    localStorage.setItem('giftStackerDropSpeed', dropSpeedMult);
    localStorage.setItem('giftStackerRandomSizes', randomSizes);
    localStorage.setItem('giftStackerBounce', restitutionVal);

    settingsModal.classList.add('hidden');
    startScreen.classList.remove('hidden');
}

function updateSettingsUI() {
    slideSpeedVal.innerText = slideSpeedInput.value + 'x';
    dropSpeedVal.innerText = dropSpeedInput.value + 'x';

    // BOUNCE VAL TEXT
    const b = parseFloat(bounceInput.value);
    let text = 'Normal';
    if (b < 0.3) text = 'Low';
    if (b > 0.7) text = 'Super';
    bounceVal.innerText = text + ` (${b})`;
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
            const newScore = boxes.filter(b => b.hasScored).length;
            if (newScore > score) {
                score = newScore;
                scoreElement.innerText = `${score}`;

                // Add pop animation
                scoreElement.classList.remove('score-pop');
                void scoreElement.offsetWidth; // trigger reflow
                scoreElement.classList.add('score-pop');

                // Optimistically update High Score Display (but don't save to LS yet)
                if (score > highScore) {
                    highScore = score;
                    updateHighScoreDisplay();
                }
            }
        }
    }
}

init();
