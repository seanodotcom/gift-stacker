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
let score = 0;
let highScore = localStorage.getItem('giftStackerHighScore') || 0;
// Phase 2: Persistence
let totalScoreBank = parseInt(localStorage.getItem('giftStackerTotalBank')) || 0;
let unlockedThemes = JSON.parse(localStorage.getItem('giftStackerUnlockedThemes')) || {
    'christmas': true,
    'standard': true, // Default unlocked
    'neon': false,
    '8bit': false,
    'underwater': false
};
let isPaused = false;
let spawnerX = 0;
let spawnerDirection = 1;
const BASE_SPAWNER_SPEED = 6.25;
const BASE_GRAVITY = 1.4;
let slideSpeedMult = parseFloat(localStorage.getItem('giftStackerSlideSpeed')) || 1.0;
let dropSpeedMult = parseFloat(localStorage.getItem('giftStackerDropSpeed')) || 1.0;
let randomSizes = localStorage.getItem('giftStackerRandomSizes') === 'true'; // Default false unless 'true' string present
let soundEnabled = localStorage.getItem('giftStackerSound') !== 'false'; // Default true
let currentTheme = localStorage.getItem('giftStackerTheme') || 'christmas';

// v0.4 Difficulty & Lives
let currentDifficulty = localStorage.getItem('giftStackerDifficulty') || 'standard';
let lives = 3;
let maxLives = 3;
let platformWidthPct = 0.48;
const DIFFICULTIES = {
    easy: { slide: 0.5, drop: 0.8, bounce: 0, lives: 5, widthPct: 0.58, dropTime: null },
    standard: { slide: 1.0, drop: 1.0, bounce: 0.05, lives: 3, widthPct: 0.48, dropTime: 11 },
    hard: { slide: 1.5, drop: 1.4, bounce: 0.12, lives: 1, widthPct: 0.42, dropTime: 7 }
};

const Sound = {
    ctx: null,
    init: function () {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
    },
    playTone: function (freq, type, duration, vol = 0.1) {
        if (!soundEnabled || !this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    },
    playWhoosh: function () {
        // Filtered white noise for whoosh
        if (!soundEnabled || !this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle'; // Softer than noise, simplified whoosh
        osc.frequency.setValueAtTime(200, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.2);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.2);
    },
    playLand: function () {
        // "Ba-dump" - Low thud
        if (!soundEnabled || !this.ctx) return;

        // Thud 1
        this.playTone(80, 'sine', 0.1, 0.2);

        // Thud 2 slightly later
        setTimeout(() => {
            this.playTone(60, 'sine', 0.1, 0.2);
        }, 80);
    },
    playDrop: function () {
        this.playWhoosh();
    },
    playScore: function () {
        if (!soundEnabled || !this.ctx) return;
        // Happy chime (Two-tone perfect 5th)
        this.playTone(523.25, 'sine', 0.15, 0.1); // C5
        setTimeout(() => this.playTone(783.99, 'sine', 0.2, 0.1), 100); // G5
    },
    playGameOver: function (isHighScore) {
        if (!soundEnabled || !this.ctx) return;

        if (isHighScore) {
            // Ta-daa! Major Arpeggio
            this.playTone(523.25, 'triangle', 0.2, 0.2); // C5
            setTimeout(() => this.playTone(659.25, 'triangle', 0.2, 0.2), 150); // E5
            setTimeout(() => this.playTone(783.99, 'triangle', 0.2, 0.2), 300); // G5
            setTimeout(() => this.playTone(1046.50, 'triangle', 0.6, 0.3), 450); // C6
        } else {
            // Pleasant Conclusion (Descending)
            this.playTone(392.00, 'sine', 0.4, 0.1); // G4
            setTimeout(() => this.playTone(329.63, 'sine', 0.5, 0.1), 200); // E4
            setTimeout(() => this.playTone(261.63, 'sine', 0.8, 0.1), 400); // C4
        }
    }
};

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
const homeBtn = document.getElementById('home-btn');

const quitConfirmModal = document.getElementById('quit-confirm-modal');
const confirmQuitBtn = document.getElementById('confirm-quit-btn');
const cancelQuitBtn = document.getElementById('cancel-quit-btn');

const resetScoreModal = document.getElementById('reset-score-modal');
const confirmResetBtn = document.getElementById('confirm-reset-btn');
const cancelResetBtn = document.getElementById('cancel-reset-btn');

// Shop Elements
const shopBtn = document.getElementById('shop-btn');
const shopModal = document.getElementById('shop-modal');
const closeShopBtn = document.getElementById('close-shop-btn');
const shopBankDisplay = document.getElementById('shop-bank-display');
const shopItemsContainer = document.getElementById('shop-items-container');

// Settings Elements
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const slideSpeedInput = document.getElementById('slide-speed');
const dropSpeedInput = document.getElementById('drop-speed');
const slideSpeedVal = document.getElementById('slide-speed-val');
const dropSpeedVal = document.getElementById('drop-speed-val');
const randomSizesInput = document.getElementById('random-sizes');
const soundEnabledInput = document.getElementById('sound-enabled');
// const themeSelect = document.getElementById('theme-select'); // Removed
// Theme Buttons in Settings (Only show unlocked?)
// For now, settings just toggles between Christmas/Standard as legacy, 
// OR we remove theme toggles from Settings and force use of Shop?
// Let's keep specific toggles for now but update them to be generic or just link to shop.
const themeBtnChristmas = document.getElementById('theme-christmas');
const themeBtnStandard = document.getElementById('theme-standard');
const bounceInput = document.getElementById('bounce');
const livesContainer = document.getElementById('lives-container');
const livesIcons = document.getElementById('lives-icons');
const diffBtns = {
    easy: document.getElementById('diff-easy'),
    standard: document.getElementById('diff-standard'),
    hard: document.getElementById('diff-hard')
};
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
const toastElement = document.getElementById('toast');
const debugStatsElement = document.getElementById('debug-stats');
const fpsElement = document.getElementById('fps-counter');
const timerContainer = document.getElementById('timer-container');
const timerBar = document.getElementById('timer-bar');

// Leaderboard Elements
const leaderboardModal = document.getElementById('leaderboard-modal');
const closeLeaderboardBtn = document.getElementById('close-leaderboard-btn');
const submitScoreModal = document.getElementById('submit-score-modal');
const scoreSubmitVal = document.getElementById('submit-score-val');
const playerNameInput = document.getElementById('player-name-input');
const submitScoreBtn = document.getElementById('submit-score-btn');
const skipSubmitBtn = document.getElementById('skip-submit-btn');
const openLeaderboardBtn = document.getElementById('leaderboard-btn');
// Leaderboard button is now in HTML
if (openLeaderboardBtn) {
    // Ensuring it's visible or managed via CSS
}

// Performance Vars
let frameCount = 0;
let lastFpsTime = 0;
let lowFpsStreak = 0;
let perfCheckActive = true;

// Visual Score State for Odometer
let displayScore = 0;
let scoreUpdateTimer = 0;

// Additional State
let restitutionVal = parseFloat(localStorage.getItem('giftStackerBounce')) || 0.5;
let currentDropTimer = 0;


let maxDropTime = null; // Seconds, null if disabled
let timerDelay = 0; // Delay before timer starts dropping (for visual fill)

const Shop = {
    themes: {
        'standard': { name: 'Standard', price: 0, desc: 'Classic Blue' },
        'christmas': { name: 'Christmas', price: 0, desc: 'Festive Holiday' },
        'neon': { name: 'Neon City', price: 500, desc: 'Cyberpunk Vibes' },
        '8bit': { name: '8-Bit', price: 1000, desc: 'Retro Pixel Art' },
        'underwater': { name: 'Underwater', price: 2000, desc: 'Deep Sea' }
    },

    open: function () {
        if (!shopModal) return;
        shopModal.classList.remove('hidden');
        startScreen.classList.add('hidden');
        this.updateUI();
        updateVisualState();
    },

    updateUI: function () {
        if (!shopItemsContainer) return;
        shopItemsContainer.innerHTML = '';
        shopBankDisplay.innerText = totalScoreBank;

        Object.keys(this.themes).forEach(key => {
            const theme = this.themes[key];
            const isUnlocked = unlockedThemes[key];
            const isEquipped = currentTheme === key;

            const el = document.createElement('div');
            el.className = `shop-card ${isEquipped ? 'equipped' : ''}`;

            let btnHtml = '';
            let priceHtml = '';

            if (isEquipped) {
                btnHtml = `<button class="shop-btn disabled">Equipped</button>`;
            } else if (isUnlocked) {
                btnHtml = `<button class="shop-btn equip-btn" onclick="Shop.equip('${key}')">Equip</button>`;
            } else {
                const canBuy = totalScoreBank >= theme.price;
                const btnClass = canBuy ? 'buy-btn' : 'disabled';
                // Remove price from button, list separately
                priceHtml = `<div class="shop-price">🍪 ${theme.price}</div>`;
                btnHtml = `<button class="shop-btn ${btnClass}" onclick="Shop.buy('${key}')">Buy</button>`;
            }

            el.innerHTML = `
                <div class="shop-icon theme-${key}-preview"></div>
                <div class="shop-info">
                    <h3>${theme.name}</h3>
                    <p>${theme.desc}</p>
                    ${priceHtml}
                    ${btnHtml}
                </div>
            `;
            shopItemsContainer.appendChild(el);
        });
    },

    buy: function (key) {
        const theme = this.themes[key];
        if (totalScoreBank >= theme.price && !unlockedThemes[key]) {
            totalScoreBank -= theme.price;
            unlockedThemes[key] = true;
            localStorage.setItem('giftStackerTotalBank', totalScoreBank);
            localStorage.setItem('giftStackerUnlockedThemes', JSON.stringify(unlockedThemes));
            this.updateUI();
        }
    },

    equip: function (key) {
        if (unlockedThemes[key]) {
            applyTheme(key);
            this.updateUI();
        }
    }
};
window.Shop = Shop; // Expose for HTML onclick handlers




function init() {
    // Create engine
    // Create engine with higher stability settings
    engine = Engine.create({
        positionIterations: 8,
        velocityIterations: 6
    });

    // Setup input
    document.addEventListener('mousedown', handleInput);
    document.addEventListener('touchstart', handleInput, { passive: false });

    // Keyboard Controls
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space') {
            e.preventDefault(); // Prevent scroll
            if (gameState === 'PLAYING' && !isPaused) {
                dropBox();
            }
        } else if (e.code === 'Enter') {
            if (gameState === 'START' || gameState === 'GAMEOVER') {
                startGame();
            }
        } else if (e.code === 'Escape') {
            if (gameState === 'PLAYING') {
                isPaused = !isPaused;
                if (isPaused) {
                    pauseMenuModal.classList.remove('hidden');
                } else {
                    pauseMenuModal.classList.add('hidden');
                }
                updateVisualState();
            } else if (gameState === 'GAMEOVER') {
                quitGame();
            }
        }
    });

    startBtn.addEventListener('click', startGame);
    restartBtn.addEventListener('click', startGame);



    submitScoreBtn.addEventListener('click', () => {
        const name = playerNameInput.value.trim();
        if (name) {
            localStorage.setItem('giftStackerPlayerName', name); // Remember name
            Leaderboard.submitScore(name, score);
            submitScoreModal.classList.add('hidden');
            leaderboardModal.classList.remove('hidden'); // Show leaderboard after submit
            // Leaderboard.submitScore will handle fetch and highlight
        }
    });

    // Enter key support for submission
    playerNameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            submitScoreBtn.click();
        }
    });

    skipSubmitBtn.addEventListener('click', () => {
        submitScoreModal.classList.add('hidden');
        gameOverScreen.classList.remove('hidden'); // Go back to Game Over or just close?
        // Usually "Submit Score" is an overlay on Game Over or replaces it. 
        // Let's say it was an overlay, so closing it reveals game over.
        updateVisualState();
    });

    // Menu & Modals
    menuBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent game input from firing
        if (gameState === 'PLAYING') {
            isPaused = true;
            pauseMenuModal.classList.remove('hidden');
            updateVisualState();
        }
    });

    resumeBtn.addEventListener('click', () => {
        isPaused = false;
        pauseMenuModal.classList.add('hidden');
        updateVisualState();
    });

    quitGameBtn.addEventListener('click', () => {
        pauseMenuModal.classList.add('hidden');
        quitConfirmModal.classList.remove('hidden');
        updateVisualState();
    });

    confirmQuitBtn.addEventListener('click', () => {
        quitConfirmModal.classList.add('hidden');
        quitGame();
    });

    cancelQuitBtn.addEventListener('click', () => {
        quitConfirmModal.classList.add('hidden');
        pauseMenuModal.classList.remove('hidden');
        updateVisualState();
    });

    homeBtn.addEventListener('click', quitGame);

    releaseNotesBtn.addEventListener('click', () => {
        pauseMenuModal.classList.add('hidden');
        releaseNotesModal.classList.remove('hidden');
        updateVisualState();
    });

    closeNotesBtn.addEventListener('click', () => {
        releaseNotesModal.classList.add('hidden');
        // If game is in progress, go back to pause menu
        if (gameState === 'PLAYING') {
            pauseMenuModal.classList.remove('hidden');
        }
        updateVisualState();
    });

    // Shop Listeners
    if (shopBtn) {
        shopBtn.addEventListener('click', () => {
            Shop.open();
        });
    }

    if (closeShopBtn) {
        closeShopBtn.addEventListener('click', () => {
            shopModal.classList.add('hidden');
            startScreen.classList.remove('hidden');
            updateVisualState();
        });
    }

    // Leaderboard Listeners
    if (openLeaderboardBtn) {
        openLeaderboardBtn.addEventListener('click', () => {
            leaderboardModal.classList.remove('hidden');
            startScreen.classList.add('hidden');
            updateVisualState();
            Leaderboard.fetchLeaderboard();
        });
    }

    if (closeLeaderboardBtn) {
        closeLeaderboardBtn.addEventListener('click', () => {
            leaderboardModal.classList.add('hidden');

            // Only return to Start Screen if we aren't in Game Over mode
            const isGameOver = !gameOverScreen.classList.contains('hidden');
            if (!isGameOver) {
                startScreen.classList.remove('hidden');
            }

            updateVisualState();
        });
    }

    // Settings Listeners
    settingsBtn.addEventListener('click', openSettings);
    closeSettingsBtn.addEventListener('click', saveSettings);
    slideSpeedInput.addEventListener('input', updateSettingsUI);
    dropSpeedInput.addEventListener('input', updateSettingsUI);
    bounceInput.addEventListener('input', updateSettingsUI);

    themeBtnChristmas.addEventListener('click', () => {
        applyTheme('christmas');
    });

    themeBtnStandard.addEventListener('click', () => {
        applyTheme('standard');
    });

    // Difficulty Listeners
    Object.keys(diffBtns).forEach(key => {
        diffBtns[key].addEventListener('click', () => {
            applyDifficulty(key);
            // Also save other settings as side effect?
            // The standard/easy/hard buttons act as presets, so they update the sliders immediately.
            updateSettingsUI(); // Updates the visual values of sliders text
        });
    });

    // Reset Score Logic (Now from Game Over screen)
    resetScoreBtn.addEventListener('click', () => {
        resetScoreModal.classList.remove('hidden');
        updateVisualState();
    });

    confirmResetBtn.addEventListener('click', () => {
        highScore = 0;
        localStorage.setItem('giftStackerHighScore', 0);
        updateHighScoreDisplay();
        resetScoreModal.classList.add('hidden');
        updateVisualState();
    });

    cancelResetBtn.addEventListener('click', () => {
        resetScoreModal.classList.add('hidden');
        updateVisualState();
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
            // Collision Sound (Platform or Box)
            // Play sound if relative velocity is high enough? 
            // For simplicity, just play land sound if it's the current falling box hitting something
            // But currentBox is null'ed on drop. So we check if bodyA/B is a box.
            // Limiting to start of collision prevents spam.
            // We can add a cooldown or check if velocity.y was significant.

            // Just play land sound for any box collision with non-sensor
            if (!bodyA.isSensor && !bodyB.isSensor) {
                // Simple debounce or check could go here, but for now just play
                // Actually, duplicate events are common. Let's just play if it's a 'box' hitting something.
                if (bodyA.label === 'box' || bodyB.label === 'box') {
                    // Optional: check speed
                    Sound.playLand();
                }
            }

            checkScore(bodyA, bodyB);
            checkScore(bodyB, bodyA);
        });
    });

    // Show initial high score
    updateHighScoreDisplay();

    // Apply saved theme
    applyTheme(currentTheme);
    applyDifficulty(currentDifficulty);

    // Init sound context on first click
    document.addEventListener('click', () => {
        Sound.init();
    }, { once: true });

    // Start Snow System
    // Start Particle System (was SnowSystem)
    snowSystem = new ParticleSystem(christmasBg);
    // don't start immediately, applyTheme will handle it
    snowSystem.start();

    // Verify theme logic for snow
    if (currentTheme !== 'christmas') {
        snowSystem.active = false;
        christmasBg.style.display = 'none';
    }

    // Sync Pause Sound Toggle with Settings
    if (pauseSoundEnabledInput) {
        pauseSoundEnabledInput.checked = soundEnabled;
        pauseSoundEnabledInput.addEventListener('change', () => {
            soundEnabled = pauseSoundEnabledInput.checked;
            soundEnabledInput.checked = soundEnabled; // Sync settings one
            localStorage.setItem('giftStackerSound', soundEnabled);
            if (soundEnabled) Sound.init();
        });

        // Also update pause toggle if settings one changes
        if (soundEnabledInput) {
            soundEnabledInput.addEventListener('change', () => {
                pauseSoundEnabledInput.checked = soundEnabledInput.checked;
            });
        }
    }

    // Initial render loop (just for the background/UI, physics not running yet)
    // Actually, we'll start the loop but only update physics in PLAYING state

    // FETCH TOP 10 SO MIN HIGH SCORE IS READY
    if (window.Leaderboard) window.Leaderboard.fetchLeaderboard();

    updateVisualState();
    requestAnimationFrame(update);
}


function applyDifficulty(level) {
    currentDifficulty = level;
    const settings = DIFFICULTIES[level];

    // Apply presets
    slideSpeedMult = settings.slide;
    dropSpeedMult = settings.drop;
    restitutionVal = settings.bounce;
    maxLives = settings.lives;
    platformWidthPct = settings.widthPct;

    // Update UI Sliders
    if (typeof slideSpeedInput !== 'undefined') {
        slideSpeedInput.value = slideSpeedMult;
        dropSpeedInput.value = dropSpeedMult;
        bounceInput.value = restitutionVal;
    }

    // Update Toggle UI
    if (typeof diffBtns !== 'undefined') {
        Object.keys(diffBtns).forEach(key => {
            if (key === level) diffBtns[key].classList.add('active');
            else diffBtns[key].classList.remove('active');
        });
    }

    localStorage.setItem('giftStackerDifficulty', level);

    // Set timer
    maxDropTime = settings.dropTime;
    currentDropTimer = maxDropTime;

    // UI
    if (timerContainer) {
        if (maxDropTime === null) {
            timerContainer.classList.add('hidden');
        } else {
            // Only show if playing, otherwise init will handle visibility
            // Actually let updateUIVisibility handle this primarily, 
            // but we need to ensure the element isn't hidden if we just switched diff in settings
            // If game logic is running, it will update frame by frame.
        }
    }
}

function loseLife() {
    lives--;
    updateLivesUI();

    if (lives > 0) {
        Sound.playTone(150, 'sawtooth', 0.3, 0.1);
    }

    if (lives <= 0) {
        // gameOver();
        // Delay slightly for dramatic effect?
        gameOver();
    }
}

function updateLivesUI() {
    if (!livesIcons) return;
    livesIcons.innerHTML = '';
    for (let i = 0; i < maxLives; i++) {
        const icon = document.createElement('div');
        icon.className = 'life-icon';
        if (i >= lives) {
            icon.classList.add('lost');
        }
        livesIcons.appendChild(icon);
    }
}

function updateVisualState() {
    // check visual state logic
    const isPausedModal = !pauseMenuModal.classList.contains('hidden');
    const isGameOver = !gameOverScreen.classList.contains('hidden');
    const isQuitConfirm = !quitConfirmModal.classList.contains('hidden');
    const isResetConfirm = !resetScoreModal.classList.contains('hidden');
    const isReleaseNotes = !releaseNotesModal.classList.contains('hidden');

    const isLeaderboard = !leaderboardModal.classList.contains('hidden');
    const isSubmitScore = !submitScoreModal.classList.contains('hidden');
    const isShop = shopModal && !shopModal.classList.contains('hidden');

    // Blur Background: Paused, Game Over, or Sub-Modals
    const shouldBlur = isPausedModal || isGameOver || isQuitConfirm || isResetConfirm || isReleaseNotes || isLeaderboard || isSubmitScore || isShop;
    if (shouldBlur) {
        document.body.classList.add('bg-blurred');
    } else {
        document.body.classList.remove('bg-blurred');
    }

    // Hide UI: Start Screen (Splash) or Settings
    const isStartScreen = !startScreen.classList.contains('hidden');
    const isSettings = settingsModal && !settingsModal.classList.contains('hidden');

    // We hide the gameplay UI if any of these "Main Menu" type overlays are open
    const shouldHideUI = isStartScreen || isSettings || isShop || isLeaderboard;

    if (shouldHideUI) {
        document.body.classList.add('ui-hidden');
    } else {
        document.body.classList.remove('ui-hidden');
    }
}

function startGame() {
    gameState = 'PLAYING';
    isPaused = false;
    score = 0;
    displayScore = 0;
    scoreElement.innerText = `${score}`;

    // Reset Lives
    lives = maxLives;
    updateLivesUI();
    if (livesContainer) livesContainer.classList.remove('hidden');

    boxes = [];
    sceneElement.innerHTML = ''; // Clear existing boxes
    Composite.clear(engine.world);
    Engine.clear(engine);

    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    newRecordMsg.classList.add('hidden'); // Hide new record msg on start
    updateVisualState();

    // Tutorial Toast (Once per session)
    if (!sessionStorage.getItem('giftStackerTutorialShown')) {
        const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const msg = isTouch ? "Tap the screen to drop a gift" : "Click the screen or press [Space] to drop a gift";
        // Small delay to ensure UI is ready and transition is nice
        setTimeout(() => showToast(msg), 500);
        sessionStorage.setItem('giftStackerTutorialShown', 'true');
    }

    // Set gravity again in case Engine.clear reset it
    engine.world.gravity.y = BASE_GRAVITY * dropSpeedMult;

    // Create Platform
    // Calculate dynamic sizes
    const width = window.innerWidth;
    const height = window.innerHeight;
    platformWidth = Math.max(width * platformWidthPct, 200); // Dynamic based on difficulty

    // SCALING LOGIC
    // Use Math.min(Math.max(width * 0.15, 60), 120) to ensure boxes aren't too small on mobile or too huge on desktop.
    boxSize = Math.min(Math.max(width * 0.15, 60), 120);

    // Create Platform
    platform = Bodies.rectangle(width / 2, height - 50, platformWidth, PLATFORM_HEIGHT, {
        isStatic: true,
        label: 'platform',
        restitution: 0,     // Zero bounce surface
        friction: 1.0       // Maximum grip
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

    updateVisualState();

    // Reset background physics
    // platform, ground etc will be recreated on startGame

    if (timerContainer) timerContainer.classList.add('hidden');
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

    // Restitution (Bounciness) Logic
    let boxRestitution = restitutionVal;
    if (randomSizes) {
        // Randomize bounciness between 0 and set value
        boxRestitution = Math.random() * restitutionVal;
    }

    currentBox = Bodies.rectangle(spawnerX, 100, currentWidth, currentHeight, {
        isStatic: true,
        label: 'box',
        restitution: boxRestitution,
        friction: 0.8,      // High friction to prevent sliding
        frictionStatic: 1.0, // Sticky start
        density: 0.005      // 5x heavier than default
    });

    // Play drop sound
    Sound.playDrop();

    // Custom property to track if this box has contributed to score
    currentBox.hasScored = false;

    Composite.add(engine.world, currentBox);
    createDomElement(currentBox, 'box');

    // Reset Timer on Spawn
    if (maxDropTime !== null) {
        currentDropTimer = maxDropTime;
        timerDelay = 0.25; // 250ms delay to allow bar to visually "fill" completely
        if (timerContainer) {
            timerContainer.classList.remove('hidden');
            timerBar.style.width = '100%';
            timerBar.className = ''; // Reset colors
        }
    } else {
        if (timerContainer) timerContainer.classList.add('hidden');
    }
}

function handleInput(e) {
    if (gameState !== 'PLAYING' || isPaused) return;
    if (e.target.closest('button')) return; // Ignore clicks on any button or its children

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

        // FPS Calculation
        frameCount++;
        if (now - lastFpsTime >= 1000) {
            const fps = Math.round((frameCount * 1000) / (now - lastFpsTime));
            if (fpsElement) fpsElement.innerText = fps;

            checkPerformance(fps);

            frameCount = 0;
            lastFpsTime = now;
        }

        // SCORING ODOMETER ANIMATION REMOVED - Handled by CSS Transitions in animateScoreUI


        updateDebugDisplay();

        if (gameState === 'PLAYING' && !isPaused) {
            const width = window.innerWidth;

            // Move Spawner / Current Box using Delta Time
            // BASE_SPAWNER_SPEED (6.25) was good at 60fps (16.6ms).
            // Factor = dt / 16.67
            const timeScale = dt / 16.67;

            // Update Drop Timer
            if (currentBox && currentBox.isStatic && maxDropTime !== null) {
                if (timerDelay > 0) {
                    timerDelay -= dt / 1000;
                    // Force UI to stay full during delay (fighting any interpolate issues)
                    if (timerBar) timerBar.style.width = '100%';
                } else {
                    currentDropTimer -= dt / 1000;
                }

                // Update UI
                if (timerBar) {
                    const pct = (currentDropTimer / maxDropTime) * 100;
                    timerBar.style.width = `${pct}%`;

                    // Colors
                    if (pct < 20) {
                        timerBar.className = 'danger';
                    } else if (pct < 50) {
                        timerBar.className = 'warning';
                    } else {
                        timerBar.className = '';
                    }
                }

                if (currentDropTimer <= 0) {
                    dropBox();
                    // Force timer reset visually or hide to prevent flicker? 
                    // dropBox will enable next after delay.
                    // For safety, clear timer so we don't drop twice in this frame or next
                    currentDropTimer = 0;
                }
            }

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

            // Check Game Over (Loss of Life)
            // If any box falls below the screen
            boxes.forEach((box, index) => {
                if (!box.lostLife && box.position.y > window.innerHeight + 100) {
                    box.lostLife = true; // Mark as processed

                    // SCORING FIX: If this box had added to the score, remove it!
                    if (box.hasScored) {
                        box.hasScored = false; // Fix: Mark as un-scored so it isn't recounted

                        const oldScore = score;
                        score--;
                        displayScore = score; // Sync logic

                        // Trigger Decrement Animation
                        animateScoreUI(oldScore, score);
                    }

                    loseLife();
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

    // Use savedTop for comparison, NOT the internal 'highScore' var which might be stale or equal

    // Check Global Leaderboard qualification
    const minToBeat = Number(Leaderboard.minHighScore) || 0;
    const isGlobalHighScore = Leaderboard.minHighScore === undefined || score > minToBeat;

    if (score > savedTop || isGlobalHighScore) {
        if (score > savedTop) {
            highScore = score;
            localStorage.setItem('giftStackerHighScore', highScore);
            updateHighScoreDisplay();
            newRecordMsg.classList.remove('hidden'); // Show celebration
        }

        // Confetti!
        confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#d32f2f', '#ffd700', '#ffffff', '#388e3c']
        });

        Sound.playGameOver(true);
    } else {
        // If we didn't beat the real high score, revert the optimistic display if needed
        highScore = savedTop;
        updateHighScoreDisplay();
        newRecordMsg.classList.add('hidden');

        Sound.playGameOver(false);
    }


    // Accumulate Total Score (Money)
    if (score > 0) {
        totalScoreBank += score;
        localStorage.setItem('giftStackerTotalBank', totalScoreBank);
    }

    // Logic for Submit Score:
    if (score > 0) {
        // Pre-fill name
        const savedName = localStorage.getItem('giftStackerPlayerName') || "";
        playerNameInput.value = savedName;

        // Show score and earned cookies
        scoreSubmitVal.innerText = score;
        const submitMsg = document.getElementById('submit-score-msg');
        if (submitMsg) {
            const currencyName = score === 1 ? 'Cookie' : 'Cookies'; // Singular/Plural
            // Tighter spacing (margin-top negative or small line-height) and smaller text (0.9em instead of 1.3em)
            submitMsg.innerHTML = `
                Your Score: <span id="submit-score-val" style="font-weight:900;">${score}</span>
                <div style="margin-top:2px; font-size: 0.7em; color:#4caf50; font-weight:bold;">
                    +${score} ${currencyName} earned
                </div>`;
        }

        // Dynamic Header: Only show "New High Score" if we beat the leaderboard bottom
        // OR if we beat local high score? User said "below lowest (of 10)". So comparing to global.
        // Dynamic Header & Controls
        const modalHeader = submitScoreModal.querySelector('h2');
        const modalControls = submitScoreModal.querySelector('.modal-buttons');

        // Check global high score qualification (already calculated as isGlobalHighScore)
        console.log(`Checking High Score: Score ${score} vs MinToBeat ${minToBeat} (Qualifying: ${isGlobalHighScore})`);

        if (modalHeader) {
            if (isGlobalHighScore) {
                modalHeader.innerText = "🏆 New High Score!";
                playerNameInput.classList.remove('hidden'); // Use class
                if (submitScoreBtn) submitScoreBtn.classList.remove('hidden');
                if (skipSubmitBtn) skipSubmitBtn.innerText = 'Skip';
            } else {
                modalHeader.innerText = "Round Complete";
                playerNameInput.classList.add('hidden'); // Use class to override CSS !important
                if (submitScoreBtn) submitScoreBtn.classList.add('hidden');
                if (skipSubmitBtn) skipSubmitBtn.innerText = 'Continue';
            }
        }

        submitScoreModal.classList.remove('hidden');
        // We show Game Over screen BEHIND it.
        gameOverScreen.classList.remove('hidden');
    } else {
        gameOverScreen.classList.remove('hidden');
    }

    // gameOverScreen.classList.remove('hidden'); // Already handled above
    if (startScreen) startScreen.classList.add('hidden'); // Defensive: ensure splash is gone
    updateVisualState();
}

// function togglePause() { ... } // Removed old togglePause, logic handled by menu listeners

const pauseSoundEnabledInput = document.getElementById('pause-sound-enabled');

// ... (existing code)

function updateHighScoreDisplay() {
    if (highScoreElement) highScoreElement.innerText = `High: ${highScore}`;
    if (startHighScoreElement) startHighScoreElement.innerText = `${highScore}`;
    if (gameOverHighScoreElement) gameOverHighScoreElement.innerText = `High Score: ${highScore}`;
    localStorage.setItem('giftStackerHighScore', highScore);
}

function updateDebugDisplay() {
    if (!debugStatsElement) return;

    // Show only in game
    if (gameState !== 'PLAYING') {
        debugStatsElement.classList.add('hidden');
        return;
    }
    debugStatsElement.classList.remove('hidden');

    // Target Box: Current Spawning or Last Dropped
    let targetBox = currentBox;
    let state = "SPAWNING";

    if (!targetBox && boxes.length > 0) {
        targetBox = boxes[boxes.length - 1];
        state = "DROPPED";
    }

    if (!targetBox) {
        debugStatsElement.innerText = "No Box";
        return;
    }

    const restitution = targetBox.restitution.toFixed(2);
    const friction = targetBox.friction.toFixed(2);
    const density = targetBox.density.toFixed(4);
    const velocityY = targetBox.velocity ? targetBox.velocity.y.toFixed(2) : '0.00';
    const isStatic = targetBox.isStatic ? "YES" : "NO";

    debugStatsElement.innerText =
        `State: ${state}
Bounce: ${restitution}
Friction: ${friction}
Density: ${density}
Vel Y: ${velocityY}
Static: ${isStatic}`;
}

// ... inside init ...

// Sync Pause Sound Toggle with Settings
// We need to update this whenever soundEnabled changes or modal opens
// Actually, easier to just bind it.

pauseSoundEnabledInput.checked = soundEnabled;
pauseSoundEnabledInput.addEventListener('change', () => {
    soundEnabled = pauseSoundEnabledInput.checked;
    soundEnabledInput.checked = soundEnabled; // Sync settings one
    localStorage.setItem('giftStackerSound', soundEnabled);
    if (soundEnabled) Sound.init();
});

// Also update pause toggle if settings one changes (though that's in modal, so less likely to conflict in real-time)
soundEnabledInput.addEventListener('change', () => {
    // Existing listener updates storage, we just add sync
    pauseSoundEnabledInput.checked = soundEnabledInput.checked;
});

// ... existing code ...

// Settings Functions
// Snow System
// Particle System (formerly SnowSystem)
class ParticleSystem {
    constructor(container) {
        this.container = container;
        this.particles = [];
        this.active = false;
        this.spawnInterval = null;
        this.maxParticles = 50;
        this.config = {
            type: 'snow', // snow, bubbles, rain
            symbol: '❄', // default
            speedMin: 1,
            speedMax: 3,
            sizeMin: 10,
            sizeMax: 25,
            directionY: 1, // 1 = down, -1 = up
            wiggle: true
        };
    }

    configure(cfg) {
        this.config = { ...this.config, ...cfg };
        // Clear existing when config changes? Yes
        this.clear();
    }

    start() {
        if (this.active) return;
        this.active = true;
        this.spawnInterval = setInterval(() => this.spawn(), 200);
        this.updateLoop();
    }

    stop() {
        this.active = false;
        clearInterval(this.spawnInterval);
    }

    clear() {
        this.particles.forEach(p => p.element.remove());
        this.particles = [];
        this.container.innerHTML = ''; // Ensure clean
    }

    spawn() {
        if (!this.active || this.particles.length >= this.maxParticles) return;

        const p = document.createElement('div');

        // Symbol determination
        let content = this.config.symbol;
        if (this.config.type === 'snow') {
            content = Math.random() > 0.5 ? '❅' : '❆';
        } else if (this.config.type === 'bubbles') {
            content = ''; // CSS circle
        }

        p.innerHTML = content;
        p.className = 'snowflake-js'; // Keep class for basic absolute positioning styles
        if (this.config.type === 'bubbles') p.classList.add('bubble');

        // Random properties
        const size = this.config.sizeMin + Math.random() * (this.config.sizeMax - this.config.sizeMin);
        const x = Math.random() * window.innerWidth;
        const speed = this.config.speedMin + Math.random() * (this.config.speedMax - this.config.speedMin);

        // Start Y depend on direction
        let startY = -20;
        if (this.config.directionY === -1) startY = window.innerHeight + 20;

        p.style.cssText = `
            left: ${x}px;
            font-size: ${size}px;
            position: absolute;
            top: ${startY}px;
            opacity: 0.8;
            pointer-events: none;
            color: ${this.config.type === 'neon' ? '#00e5ff' : 'white'};
        `;

        if (this.config.type === 'bubbles') {
            p.style.width = `${size}px`;
            p.style.height = `${size}px`;
        }

        this.container.appendChild(p);

        this.particles.push({
            element: p,
            x: x,
            y: startY,
            speed: speed,
            config: this.config
        });
    }

    updateLoop() {
        if (!this.active) return;

        const height = window.innerHeight;

        this.particles.forEach((p, index) => {
            p.y += p.speed * p.config.directionY;
            p.element.style.top = `${p.y}px`;

            // Wiggle
            if (p.config.wiggle) {
                const xOffset = Math.sin(Date.now() / 1000 + p.x) * (p.config.type === 'bubbles' ? 2 : 0.5);
                p.element.style.transform = `translateX(${xOffset}px)`;
            }

            // Remove if off screen
            if (p.config.directionY === 1 && p.y > height) {
                p.element.remove();
                this.particles.splice(index, 1);
            } else if (p.config.directionY === -1 && p.y < -50) {
                p.element.remove();
                this.particles.splice(index, 1);
            }
        });

        requestAnimationFrame(() => this.updateLoop());
    }
}

let snowSystem;

function openSettings() {
    settingsModal.classList.remove('hidden');
    startScreen.classList.add('hidden');
    updateVisualState();
    slideSpeedInput.value = slideSpeedMult;
    dropSpeedInput.value = dropSpeedMult;
    randomSizesInput.checked = randomSizes;
    soundEnabledInput.checked = soundEnabled;
    // themeSelect.value = currentTheme;
    updateThemeButtonsUI();

    bounceInput.value = restitutionVal;
    updateSettingsUI();
}


function applyTheme(theme) {
    document.body.className = `theme-${theme}`;

    if (!snowSystem) return; // safety

    snowSystem.stop();
    christmasBg.innerHTML = ''; // Clear old particles

    if (theme === 'christmas') {
        christmasBg.style.display = 'block';
        snowSystem.configure({ type: 'snow', directionY: 1, speedMin: 1, speedMax: 3, symbol: null });
        snowSystem.start();
    } else if (theme === 'underwater') {
        christmasBg.style.display = 'block';
        snowSystem.configure({ type: 'bubbles', directionY: -1, speedMin: 1, speedMax: 2, symbol: '' });
        snowSystem.start();
    } else if (theme === 'neon') {
        christmasBg.style.display = 'block';
        snowSystem.configure({ type: 'neon', symbol: '|', directionY: 1, speedMin: 5, speedMax: 10 });
        snowSystem.start();
    } else {
        christmasBg.style.display = 'none';
    }

    currentTheme = theme;
    localStorage.setItem('giftStackerTheme', theme);

    updateThemeButtonsUI();
}

function updateThemeButtonsUI() {
    if (!themeBtnChristmas || !themeBtnStandard) return;

    themeBtnChristmas.classList.remove('active');
    themeBtnStandard.classList.remove('active');

    if (currentTheme === 'christmas') themeBtnChristmas.classList.add('active');
    else if (currentTheme === 'standard') themeBtnStandard.classList.add('active');
}

function saveSettings() {
    slideSpeedMult = parseFloat(slideSpeedInput.value);
    dropSpeedMult = parseFloat(dropSpeedInput.value);
    randomSizes = randomSizesInput.checked;
    soundEnabled = soundEnabledInput.checked;
    // currentTheme = themeSelect.value; 
    // currentTheme is updated by button clicks immediately, but we only save to LS here if desired?
    // User expects "Save" to commit.
    // The buttons update 'currentTheme' locally.

    restitutionVal = parseFloat(bounceInput.value);

    localStorage.setItem('giftStackerSlideSpeed', slideSpeedMult);
    localStorage.setItem('giftStackerDropSpeed', dropSpeedMult);
    localStorage.setItem('giftStackerRandomSizes', randomSizes);
    localStorage.setItem('giftStackerSound', soundEnabled);
    localStorage.setItem('giftStackerTheme', currentTheme);
    localStorage.setItem('giftStackerBounce', restitutionVal);

    applyTheme(currentTheme);

    // Initialize Audio Context on user interaction (save settings)
    if (soundEnabled) Sound.init();

    settingsModal.classList.add('hidden');
    startScreen.classList.remove('hidden');
    updateVisualState();
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
    if (!color) return '#000000'; // Safety check
    return '#' + color.replace(/^#/, '').replace(/../g, color => ('0' + Math.min(255, Math.max(0, parseInt(color, 16) + amount)).toString(16)).substr(-2));
}

// Helper to check and update score on collision
// Helper to check and update score on collision
function checkScore(body, otherBody) {
    if (body.label === 'box' && !body.hasScored && !body.isStatic) {
        // If it hits the platform or another box (that isn't itself, though collision pairs usually distinct)
        if (otherBody.label === 'platform' || otherBody.label === 'box') {
            body.hasScored = true;
            // Recalculate score based on all landed boxes
            const newScore = boxes.filter(b => b.hasScored).length;

            // Update score state
            if (newScore > score) {
                // Update score state
                const oldScore = score;
                score = newScore;
                displayScore = score; // Sync display score immediately logic-wise

                // Trigger Animation
                animateScoreUI(oldScore, score);

                if (score > 0) {
                    // Sound
                    Sound.playScore();

                    // High Score is now only updated at Game Over to avoid "last block fall" bug.
                }
            }
        }
    }
}

function animateScoreUI(oldVal, newVal) {
    if (!scoreElement) return;

    // Determine direction
    const isUp = newVal > oldVal;

    // Clear content to construct animation structure
    scoreElement.innerHTML = '';

    const oldSpan = document.createElement('span');
    oldSpan.textContent = oldVal;
    oldSpan.className = isUp ? 'score-digit slide-out' : 'score-digit slide-out-down';

    const newSpan = document.createElement('span');
    newSpan.textContent = newVal;
    newSpan.className = isUp ? 'score-digit slide-in' : 'score-digit slide-in-down';

    scoreElement.appendChild(oldSpan);
    scoreElement.appendChild(newSpan);

    // Cleanup after animation completes
    setTimeout(() => {
        if (scoreElement) scoreElement.innerText = newVal;
    }, 500);
}

function checkPerformance(fps) {
    if (!perfCheckActive) return;
    if (!snowSystem || !snowSystem.active) return; // Already off

    if (fps < 30) {
        lowFpsStreak++;
    } else {
        lowFpsStreak = 0;
    }

    if (lowFpsStreak >= 3) {
        // 3 consecutive seconds of low FPS
        snowSystem.stop();
        if (christmasBg) christmasBg.style.display = 'none';
        showToast("Low performance detected. Snow disabled.");
        perfCheckActive = false; // Stop checking
    }
}

function showToast(msg) {
    if (!toastElement) return;
    toastElement.innerText = msg;
    toastElement.classList.remove('hidden');
    toastElement.classList.add('show');

    setTimeout(() => {
        toastElement.classList.remove('show');
        setTimeout(() => toastElement.classList.add('hidden'), 500);
    }, 3000);
}

init();

function updateUIVisibility(visible) {
    const elements = [scoreContainer, menuBtn, fpsElement, timerContainer];
    elements.forEach(el => {
        if (el) {
            if (visible) {
                // Slight exception for timer: only show if maxDropTime is set
                if (el === timerContainer && maxDropTime === null) return;
                el.classList.remove('hidden');
            }
            else el.classList.add('hidden');
        }
    });
}
