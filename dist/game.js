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
    'christmas': false,
    'standard': true, // Default unlocked
    'neon': false,
    'underwater': false
};
let isPaused = false;
let spawnerX = 0;
let spawnerDirection = 1;
const BASE_SPAWNER_SPEED = 6.25;
const BASE_GRAVITY = 1.4;
let slideSpeedMult = parseFloat(localStorage.getItem('giftStackerSlideSpeed')) || 1.0;
let dropSpeedMult = parseFloat(localStorage.getItem('giftStackerDropSpeed')) || 1.0;
let randomSizes = localStorage.getItem('giftStackerRandomSizes') !== 'false'; // Default true
let soundEnabled = localStorage.getItem('giftStackerSound') !== 'false'; // Default true
let currentTheme = localStorage.getItem('giftStackerTheme') || 'standard'; // Default standard

// v0.4 Difficulty & Lives
let currentDifficulty = localStorage.getItem('giftStackerDifficulty') || 'standard';
let lives = 3;
let maxLives = 3;
let platformWidthPct = 0.48;
const DIFFICULTIES = {
    easy: { slide: 0.5, drop: 0.8, bounce: 0, lives: 5, widthPct: 0.58, dropTime: null },
    standard: { slide: 1.0, drop: 1.0, bounce: 0.0, lives: 3, widthPct: 0.48, dropTime: 11 },
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
// Welcome Modal Elements
const welcomeModal = document.getElementById('welcome-modal');
const welcomeShopBtn = document.getElementById('welcome-shop-btn');
const welcomeCloseBtn = document.getElementById('welcome-close-btn');
const playerNameInput = document.getElementById('player-name-input');
const submitScoreBtn = document.getElementById('submit-score-btn');
const skipSubmitBtn = document.getElementById('skip-submit-btn');
const openLeaderboardBtn = document.getElementById('leaderboard-btn');
// Leaderboard button is now in HTML
if (openLeaderboardBtn) {
    // Ensuring it's visible or managed via CSS
}

// Share Elements
const shareModal = document.getElementById('share-modal');
const shareText = document.getElementById('share-text');
const copyShareBtn = document.getElementById('copy-share-btn');
const closeShareBtn = document.getElementById('close-share-btn');
const startShareBtn = document.getElementById('start-share-btn');
const leaderboardShareBtn = document.getElementById('leaderboard-share-btn');

let lastSubmittedScore = 0; // Track for sharing

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

// Zoom / Camera State
let spawnerY = 100; // Dynamic spawner height (starts at 100)
let cameraZoom = 1.0;
let cameraOffsetY = 0;
const MIN_SPAWN_GAP = 300; // Minimum gap between highest box and spawner (approx 5 boxes height)

const Shop = {
    themes: {
        'standard': { name: 'Standard', price: 0, desc: 'Classic Blue' },
        'christmas': { name: 'Christmas', price: 25, desc: 'Festive Holiday' },
        'neon': { name: 'Neon City', price: 100, desc: 'Cyberpunk Vibes' },
        'underwater': { name: 'Underwater', price: 100, desc: 'Deep Sea' }
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

            let actionHtml = '';

            if (isEquipped) {
                actionHtml = `<div class="shop-action-row center"><button class="shop-btn disabled">Equipped</button></div>`;
            } else if (isUnlocked) {
                actionHtml = `<div class="shop-action-row center"><button class="shop-btn equip-btn" onclick="Shop.equip('${key}')">Equip</button></div>`;
            } else {
                const canBuy = totalScoreBank >= theme.price;
                const btnClass = canBuy ? 'buy-btn' : 'disabled';
                actionHtml = `
                    <div class="shop-action-row">
                        <div class="shop-price">🍪 ${theme.price}</div>
                        <button class="shop-btn ${btnClass}" onclick="Shop.buy('${key}')">Buy</button>
                    </div>
                `;
            }

            el.innerHTML = `
                <div class="shop-icon theme-${key}-preview"></div>
                <div class="shop-info">
                    <h3>${theme.name}</h3>
                    <p>${theme.desc}</p>
                    ${actionHtml}
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
            showToast(`Purchased ${theme.name}! 🛍️`);

            // Celebrate!
            if (typeof confetti === 'function') {
                let colors = ['#ffffff', '#ff0000']; // default
                if (key === 'neon') colors = ['#0f0c29', '#3b0066', '#00fff2', '#ff00de'];
                else if (key === 'underwater') colors = ['#0288d1', '#01579b', '#4fc3f7'];
                else if (key === 'christmas') colors = ['#c62828', '#2e7d32', '#ffd700', '#ffffff'];

                confetti({
                    particleCount: 150,
                    spread: 70,
                    origin: { y: 0.6 },
                    colors: colors,
                    zIndex: 2000 // Above Shop Modal
                });
            }
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


    // GLOBAL ENTER KEY KILL SWITCH
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Enter' || e.key === 'Enter' || e.keyCode === 13) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
    }, true); // Use Capture phase to intercept before anything else

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
            lastSubmittedScore = score; // Store for sharing
            // Show share button on leaderboard
            leaderboardShareBtn.classList.remove('hidden');

            submitScoreModal.classList.add('hidden');
            leaderboardModal.classList.remove('hidden'); // Show leaderboard after submit
            // Leaderboard.submitScore will handle fetch and highlight
        }
    });



    skipSubmitBtn.addEventListener('click', () => {
        submitScoreModal.classList.add('hidden');
        gameOverScreen.classList.remove('hidden'); // Go back to Game Over
        gameOverScreen.style.display = ''; // Restore default display
        if (restartBtn) restartBtn.disabled = false; // Re-enable button
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
        pauseMenuModal.classList.remove('hidden');
        updateVisualState();
    });

    // Welcome Modal Acknowledgement
    const welcomeAckBtn = document.getElementById('welcome-ack-btn');
    if (welcomeAckBtn) {
        welcomeAckBtn.addEventListener('click', () => {
            welcomeModal.classList.add('hidden');

            // Show Toast (Delayed slightly for effect)
            setTimeout(() => {
                showToast("Check out the Christmas Theme in the Shop! 🎄");
            }, 300);

            // Restore Correct Screen Logic
            if (gameState === 'GAMEOVER') {
                // Check if this was a high score run
                const minToBeat = (window.Leaderboard && window.Leaderboard.minHighScore) ? Number(window.Leaderboard.minHighScore) : 0;
                const isGlobalHighScore = (window.Leaderboard && window.Leaderboard.minHighScore === undefined) || score > minToBeat;

                if (score > 0 && isGlobalHighScore) {
                    submitScoreModal.classList.remove('hidden');
                    const input = document.getElementById('player-name-input');
                    if (input) setTimeout(() => input.focus(), 100);
                } else {
                    gameOverScreen.classList.remove('hidden');
                }
                updateVisualState();
            }
        });
    }

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
            leaderboardShareBtn.classList.add('hidden'); // Hide share button when opening normally
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

    // Share Listeners
    if (startShareBtn) {
        startShareBtn.addEventListener('click', () => {
            openShareModal();
        });
    }

    if (leaderboardShareBtn) {
        leaderboardShareBtn.addEventListener('click', () => {
            openShareModal(lastSubmittedScore);
        });
    }

    if (closeShareBtn) {
        closeShareBtn.addEventListener('click', () => {
            shareModal.classList.add('hidden');
            updateVisualState();
        });
    }

    if (copyShareBtn) {
        copyShareBtn.addEventListener('click', () => {
            if (shareText) {
                shareText.select();
                shareText.setSelectionRange(0, 99999); // Mobile
                navigator.clipboard.writeText(shareText.value).then(() => {
                    showToast("Copied to clipboard! 📋");
                }).catch(err => {
                    console.error('Failed to copy text: ', err);
                    document.execCommand('copy'); // Fallback
                    showToast("Copied!");
                });
            }
        });
    }


    // INPUT HANDLER
    function handleInput(e) {
        // IMPORTANT: Allow UI interactions (modals, buttons)
        if (e.target.closest('.modal') || e.target.closest('button') || e.target.closest('.shop-card')) {
            return;
        }

        // Prevent default only if interacting with game canvas/background
        // and NOT if it's a standard UI interaction
        // e.preventDefault(); // Actually, let's be careful. Mouse/Touch often needs preventDefault to stop scrolling.
        // But if we whitelist UI above, we can safely preventDefault here for game touches.
        if (e.cancelable) e.preventDefault();

        if (gameState === 'START') {
            // ONLY start if the specific start button was clicked (handled by its own listener)
            // OR if it's a keyboard event handled elsewhere.
            // DO NOT start on random clicks.
            return;
        }

        if (gameState === 'PLAYING' && !isPaused) {
            dropBox();
        }

        if (gameState === 'GAMEOVER') {
            // Maybe restart on tap? Or force button use. 
            // Let's force button use for clarity.
        }
    }



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

                    // SWAY FIX: Mark boxes as "Landed" on first collision
                    // This prevents the camera from tracking falling boxes
                    if (bodyA.label === 'box') bodyA.isFalling = false;
                    if (bodyB.label === 'box') bodyB.isFalling = false;
                }
            }

            checkScore(bodyA, bodyB);
            checkScore(bodyB, bodyA);
        });
    });

    // Show initial high score
    updateHighScoreDisplay();

    // Init Particle System Ref (before applyTheme)
    snowSystem = new ParticleSystem(christmasBg);

    // Apply saved theme
    applyTheme(currentTheme);
    applyDifficulty(currentDifficulty);

    // Init sound context on first click
    document.addEventListener('click', () => {
        Sound.init();
    }, { once: true });

    // Start Snow System - MOVED UP
    // See top of init()

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
    // Check Notification Dot status (Christmas Theme)
    if (typeof checkNotificationDot === 'function') checkNotificationDot();

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
    const isShare = !shareModal.classList.contains('hidden');
    const shouldHideUI = isStartScreen || isSettings || isShop || isLeaderboard || isShare;

    if (shouldHideUI) {
        document.body.classList.add('ui-hidden');
    } else {
        document.body.classList.remove('ui-hidden');
    }
}

function startGame() {
    // CRITICAL FIX: Prevent Zombie Games
    // If ANY modal is open, do not start the game.
    if (!submitScoreModal.classList.contains('hidden')) return;
    if (!leaderboardModal.classList.contains('hidden')) return;
    if (!shopModal.classList.contains('hidden')) return;
    if (!settingsModal.classList.contains('hidden')) return;
    if (!releaseNotesModal.classList.contains('hidden')) return;

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

    // Reset Zoom
    cameraZoom = 1.0;
    cameraOffsetY = 0;
    spawnerY = 100;
    sceneElement.style.transform = `scale(1)`;

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
        let variance = 0.10; // Default Standard

        if (currentDifficulty === 'easy') variance = 0.05;
        else if (currentDifficulty === 'hard') variance = 0.20;

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

    if (randomSizes) {
        // Randomize bounciness between 0 and set value
        boxRestitution = Math.random() * restitutionVal;
    }

    currentBox = Bodies.rectangle(spawnerX, spawnerY, currentWidth, currentHeight, {
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
    // SWAY FIX: Track if box is currently falling
    currentBox.isFalling = true; // Set to false on collision

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
        // v0.8.7 Visuals: Added Teal (#0097a7), Orange (#f57c00). Removed Yellow.
        const colors = ['#d32f2f', '#1976d2', '#388e3c', '#f57c00', '#7b1fa2', '#0097a7'];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];

        // Gradient Effect (135deg, Lighter -> Base)
        // User Feedback: "Too dark". Boost brightness significantly.
        const lightColor = adjustColor(randomColor, 80);
        const midColor = adjustColor(randomColor, 20);
        div.style.background = `linear-gradient(135deg, ${lightColor}, ${midColor})`;

        // solid bg fallback/base logic handled by gradient mainly, but border darker
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


        // Update Camera Zoom Logic
        if (gameState === 'PLAYING') {
            updateCamera(dt);
        }


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

                Body.setPosition(currentBox, { x: spawnerX, y: spawnerY });
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

        // Apply Camera Transform
        sceneElement.style.transform = `scale(${cameraZoom}) translateY(${cameraOffsetY}px)`;

        requestAnimationFrame(update);
    } catch (e) {
        console.error("Game Loop Error:", e);
        // Try to recover
        requestAnimationFrame(update);
    }
}

function gameOver() {
    if (gameState === 'GAMEOVER') return; // Prevent multiple calls/re-entry
    gameState = 'GAMEOVER';

    // NUCLEAR FOCUS FIX: Blur any active element (like Start/Restart buttons)
    if (document.activeElement) {
        document.activeElement.blur();
    }

    // Disable Restart Button temporarily to prevent accidental key-press triggers
    if (restartBtn) restartBtn.disabled = true;

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
    // Logic for High Scores vs Game Over
    const cookieMsg = document.getElementById('game-over-cookie-msg');

    // Default: Clear cookie message
    if (cookieMsg) cookieMsg.innerText = '';

    // Only show the "Submit Score" modal if it is a GLOBAL HIGH SCORE
    if (score > 0 && isGlobalHighScore) {
        // Pre-fill name
        const savedName = localStorage.getItem('giftStackerPlayerName') || "";
        playerNameInput.value = savedName;

        // Populate Modal Info
        scoreSubmitVal.innerText = score;
        const submitMsg = document.getElementById('submit-score-msg');
        if (submitMsg) {
            const currencyName = score === 1 ? 'Cookie' : 'Cookies';
            submitMsg.innerHTML = `
                <div>Your Score: <span id="submit-score-val" style="font-weight:900;">${score}</span></div>
                <div style="color: #4caf50; font-weight: bold; margin-top: 5px;">+${score} ${currencyName} earned 🍪</div>`;
        }

        // Configure Modal for High Score
        const modalHeader = submitScoreModal.querySelector('h2');
        if (modalHeader) modalHeader.innerText = "🏆 New High Score!";

        playerNameInput.classList.remove('hidden');
        setTimeout(() => playerNameInput.focus(), 100);
        if (submitScoreBtn) submitScoreBtn.classList.remove('hidden');
        if (skipSubmitBtn) skipSubmitBtn.innerText = 'Skip';

        // Show Modal, Hide Game Over
        submitScoreModal.classList.remove('hidden');
        gameOverScreen.classList.add('hidden');
        gameOverScreen.style.display = 'none';
        if (restartBtn) restartBtn.disabled = true;

    } else {
        // NOT a high score (or 0 score). Show standard Game Over screen.
        // Update Cookie Message on Game Over screen
        if (score > 0 && cookieMsg) {
            const currencyName = score === 1 ? 'Cookie' : 'Cookies';
            cookieMsg.innerText = `+${score} ${currencyName} earned 🍪`;
        }

        // Ensure Modal is hidden
        submitScoreModal.classList.add('hidden');

        // Show Game Over Screen
        gameOverScreen.classList.remove('hidden');
        gameOverScreen.style.display = ''; // Restore
        if (restartBtn) restartBtn.disabled = false;

        // Safety blur
        if (document.activeElement) document.activeElement.blur();
    }

    if (startScreen) startScreen.classList.add('hidden');
    updateVisualState();

    // ONBOARDING CHECK
    const hasPlayed = localStorage.getItem('giftStackerHasPlayed');
    if (!hasPlayed) {
        localStorage.setItem('giftStackerHasPlayed', 'true');

        // Bonus!
        totalScoreBank += 25;
        localStorage.setItem('giftStackerTotalBank', totalScoreBank);

        // Show Welcome Modal
        // We need to hide the Game Over screen temporarily?
        // Or just show this on top?
        // Z-index of modals is high.

        setTimeout(() => {
            // Hide other modals just in case
            gameOverScreen.classList.add('hidden');
            submitScoreModal.classList.add('hidden');

            welcomeModal.classList.remove('hidden');
        }, 500); // Small delay for effect
    }
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
            sizeMax: 25,
            directionY: 1, // 1 = down, -1 = up
            directionX: 0, // X velocity
            rotation: 0,   // visual rotation
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
        // this.container.innerHTML = ''; // REMOVED: Do not wipe container, it may contain the tree
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
        if (this.config.type === 'neon') p.classList.add('neon-rain');

        // Random properties
        const size = this.config.sizeMin + Math.random() * (this.config.sizeMax - this.config.sizeMin);
        let x = Math.random() * window.innerWidth;
        const speed = this.config.speedMin + Math.random() * (this.config.speedMax - this.config.speedMin);

        // Start Y depend on direction
        let startY = -40; // Default off top
        if (this.config.directionY === -1) startY = window.innerHeight + 20;

        // If strong X direction (Neon), randomly start further left/right to cover screen
        if (this.config.directionX !== 0) {
            x = Math.random() * (window.innerWidth + 200) - 100; // Wide buffer
        }

        // Color Logic
        let colorStyle = this.config.type === 'neon' ? '#00e5ff' : 'white';
        let extraStyle = '';

        // Direction & Rotation Logic (Randomize side for Neon)
        let dirX = this.config.directionX || 0;
        let rot = this.config.rotation || 0;

        if (this.config.type === 'neon') {
            const neonColors = ['#00fff2', '#ff00ff', '#bc13fe', '#39ff14', '#ffd700'];
            const randColor = neonColors[Math.floor(Math.random() * neonColors.length)];
            colorStyle = randColor;
            extraStyle = `background: linear-gradient(to bottom, transparent, ${randColor}); box-shadow: 0 0 5px ${randColor};`;

            // Randomize Left/Right fall
            if (Math.random() > 0.5) {
                dirX = -dirX;
                rot = -rot; // Mirror the angle
            }
        }

        p.style.cssText = `
            left: ${x}px;
            font-size: ${size}px;
            position: absolute;
            top: ${startY}px;
            opacity: 0.8;
            pointer-events: none;
            color: ${colorStyle};
            transform: rotate(${rot}deg);
            ${extraStyle}
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
            config: this.config,
            directionX: dirX,
            rotation: rot
        });
    }
    updateLoop() {
        if (!this.active) return;

        const height = window.innerHeight;

        this.particles.forEach((p, index) => {
            p.y += p.speed * p.config.directionY;
            // Use specific directionX if available, else config
            const dx = p.directionX !== undefined ? p.directionX : (p.config.directionX || 0);
            p.x += (p.speed * 1.5) * dx;

            p.element.style.top = `${p.y}px`;
            p.element.style.left = `${p.x}px`; // Needs left update now

            // Wiggle
            // Use specific rotation if available
            const rotation = p.rotation !== undefined ? p.rotation : (p.config.rotation || 0);
            let transform = `rotate(${rotation}deg)`;

            if (p.config.wiggle) {
                const xOffset = Math.sin(Date.now() / 1000 + p.x) * (p.config.type === 'bubbles' ? 2 : 0.5);
                transform += ` translateX(${xOffset}px)`;
            }
            p.element.style.transform = transform;

            // Remove if off screen
            if (p.config.directionY === 1 && p.y > height) {
                p.element.remove();
                this.particles.splice(index, 1);
            } else if (p.config.directionY === -1 && p.y < -50) {
                p.element.remove();
                this.particles.splice(index, 1);
            }
            // Side cleanup
            else if (p.x > window.innerWidth + 100 || p.x < -100) {
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
    // themeSelect.value = currentTheme;


    bounceInput.value = restitutionVal;
    updateSettingsUI();
}


function applyTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    // Remove class-based logic if present, though setAttribute overrides it implicitly for CSS selectors checking attr
    document.body.className = ''; // Clear classes to be safe if mixing

    if (!snowSystem) return; // safety

    snowSystem.stop();
    // christmasBg.innerHTML = ''; // REMOVED: Do not wipe tree

    const bgTree = document.getElementById('bg-tree');

    if (theme === 'christmas') {
        christmasBg.style.display = 'block';
        if (bgTree) bgTree.style.display = 'block'; // Ensure tree is visible
        snowSystem.configure({ type: 'snow', directionY: 1, speedMin: 1, speedMax: 3, symbol: null });
        snowSystem.start();
    } else if (theme === 'underwater') {
        christmasBg.style.display = 'block';
        if (bgTree) bgTree.style.display = 'none'; // Hide tree
        snowSystem.configure({ type: 'bubbles', directionY: -1, speedMin: 1, speedMax: 2, symbol: '' });
        snowSystem.start();
    } else if (theme === 'neon') {
        christmasBg.style.display = 'block';
        if (bgTree) bgTree.style.display = 'none'; // Hide tree
        // SE Direction: Right (+0.15) and Down (+1). Rotation -10deg visually (steeper)
        // Speed reduced by ~40% (10-18 -> 6-11)
        snowSystem.configure({ type: 'neon', symbol: '', directionY: 1, directionX: 0.15, speedMin: 6, speedMax: 11, rotation: -10, wiggle: false });
        snowSystem.start();
    } else {
        // Standard or default - NO SNOW
        christmasBg.style.display = 'none';
        snowSystem.stop();
        snowSystem.clear(); // Force clear particles
    }

    currentTheme = theme;
    localStorage.setItem('giftStackerTheme', theme);
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
    return '#' + color.replace(/^#/, '').replace(/../g, color => ('0' + Math.min(255, Math.max(0, parseInt(color, 16) + amount)).toString(16)).substr(-2));
}

function updateCamera(dt) {
    // 1. Find Highest Box Y (Minimum Y value)
    let highestY = window.innerHeight - 50; // Default to platform level

    // Check all boxes that have landed (not the current falling one)
    // Actually check all dynamic boxes except the one currently held by spawner?
    // Or just all boxes. If currentBox is static, it's at spawnerY. We care about the stack.

    // Filter for stacked boxes
    // Filter for stacked boxes (only ones that have landed/scored)
    const stackedBoxes = boxes.filter(b => !b.isStatic && !b.lostLife && b.hasScored);

    if (stackedBoxes.length > 0) {
        // Find min Y
        const topBox = stackedBoxes.reduce((min, b) => b.position.y < min.position.y ? b : min, stackedBoxes[0]);
        highestY = topBox.position.y - (boxSize / 2); // Top edge of top box
    }

    // 2. Calculate Target Spawner Y
    // We want the spawner to be at least MIN_SPAWN_GAP above the highest box.
    // But max 100 (initial position).
    // Coordinate system: 0 is top. Smaller Y is higher up.
    // So if highestY is 500, and GAP is 300, target is 200.
    // If highestY is 200, target is -100.

    let targetSpawnerY = Math.min(100, highestY - MIN_SPAWN_GAP);

    // 3. Smoothly interpolate Spawner Y
    // simple lerp
    const lerpSpeed = 0.05; // 5% per frame
    spawnerY = spawnerY + (targetSpawnerY - spawnerY) * lerpSpeed;

    // 4. Calculate Camera Zoom & Offset
    // We want to keep the platform visible at the bottom? 
    // Or just ensure the Spawner is visible at the top?
    // Let's try to fit [SpawnerY - Padding, PlatformY + Padding] into Window Height.

    const visibleTop = spawnerY - 100; // Padding above spawner
    const visibleBottom = window.innerHeight - 20; // Keep platform near bottom

    const requiredHeight = visibleBottom - visibleTop;
    const availableHeight = window.innerHeight;

    let targetZoom = availableHeight / requiredHeight;

    // Clamp zoom (don't zoom IN more than 1.0, don't zoom OUT too far, e.g. 0.3)
    targetZoom = Math.max(0.3, Math.min(1.0, targetZoom));

    // v0.8.7 CAMERA LOGIC UPDATE
    // Delay zoom-out until stack height > 4 boxes (approx 240px)
    // We check (Platform Y - Highest Y)
    // Platform top is roughly window.innerHeight - 50 - (PLATFORM_HEIGHT/2) ... actually let's use the calc:
    // highestY is the top of the top box.
    // Platform Y (surface) is roughly window.innerHeight - 50 - 10 = -60 from bottom?
    // Let's use relative height from spawner bottom?
    // Logic: If highestY is > (window.innerHeight - 50 - (boxSize * 4)), keep zoom 1.0

    // Platform Surface Y approx:
    const platformSurfaceY = window.innerHeight - 50 - (PLATFORM_HEIGHT / 2);
    const currentStackHeight = platformSurfaceY - highestY;
    const thresh = boxSize * 4;

    if (currentStackHeight < thresh) {
        targetZoom = 1.0;
        // Also force offset to 0 if we want it completely static?
        // Yes, to prevent sway before necessary.
    }

    // Smooth Zoom
    cameraZoom = cameraZoom + (targetZoom - cameraZoom) * lerpSpeed;

    // 5. Calculate Offset
    // We want to center the content or anchor bottom?
    // Ideally, the platform stays at screen bottom when scaled?
    // When scaled, coordinate Y becomes Y * Zoom.
    // We want (PlatformY * Zoom) + OffsetY = ScreenBottom
    // OffsetY = ScreenBottom - (PlatformY * Zoom)

    // Actually, let's try to anchor relative to the visible area logic.
    // If we scale from 'top center', 0 stays at 0.
    // We want the 'visibleTop' to be near 0 on screen?
    // No, we want the view to look natural.

    // Let's anchor the "Virtual Center" of our required rect to the Screen Center.
    // Virtual Center = (visibleTop + visibleBottom) / 2
    // Screen Center = window.innerHeight / 2

    // But Render Transform is `scale(z) translateY(o)`.
    // Wait, Order: `scale` then `translate`. 
    // CSS Transform: functions are applied right to left visually... wait.
    // Standard CSS: transform: scale(z) translate(y); 
    // Means: First translate, THEN scale? No. 
    // transform="scale(2) translate(10px)" -> Scale everything by 2. The 10px translate inside becomes 20px on screen? 
    // Let's stick to simple:
    // transform-origin: top center;
    // We want to shift the world UP so that the relevant part fits.
    // If we shift world by Y, then scale.
    // Let's invoke the formula:
    // ScreenY = (WorldY + OffsetY) * Zoom
    // We want WorldY=PlatformBottom to be at ScreenY=WindowHeight (approx)
    // WindowHeight = (PlatformBottom + OffsetY) * Zoom
    // OffsetY = (WindowHeight / Zoom) - PlatformBottom

    // Let's try anchoring the Platform Bottom to the exact same visual spot (Screen Bottom - margin)
    const platformVisualY = window.innerHeight - 50;
    // (platformVisualY + OffsetY) * Zoom = platformVisualY ? No.
    // We want the bottom of the platform (approx window.innerHeight) to stay at window.innerHeight.

    const worldBottom = window.innerHeight;
    // targetOffsetY = (worldBottom / targetZoom) - worldBottom; ???

    // Let's think: 
    // Spawner moves UP (negative). e.g. -200.
    // We need to see -200.
    // Zoom = 0.5.
    // With Zoom 0.5, -200 becomes -100. Still off screen if origin is 0.
    // We need to move the world DOWN so that -200 (or near it) is visible.

    // Use the logic:
    // We want to map `visibleTop` (e.g. -300) to `margin` (e.g. 50px).
    // (visibleTop + OffsetY) * Zoom = 50
    // OffsetY = (50 / Zoom) - visibleTop

    // Let's try balancing centering.
    // MidPointWorld = (visibleTop + visibleBottom) / 2
    // MidPointScreen = window.innerHeight / 2
    // (MidPointWorld + OffsetY) * Zoom = MidPointScreen
    // OffsetY = (MidPointScreen / Zoom) - MidPointWorld

    const midWorld = (visibleTop + visibleBottom) / 2;
    const midScreen = window.innerHeight / 2;

    const targetOffset = (midScreen / cameraZoom) - midWorld;

    // Smooth Offset
    cameraOffsetY = cameraOffsetY + (targetOffset - cameraOffsetY) * lerpSpeed;

    // v0.8.7 Lock Offset if locked zoom
    if (cameraZoom > 0.99 && currentStackHeight < thresh) {
        cameraOffsetY = cameraOffsetY * 0.9; // Decay to 0
        if (Math.abs(cameraOffsetY) < 1) cameraOffsetY = 0;
    }
}
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
        // Wait for CSS transition (2s) to finish before hiding layout
        setTimeout(() => toastElement.classList.add('hidden'), 2100);
    }, 4500); // Increased from 3000ms
}

function checkNotificationDot() {
    const dot = document.getElementById('christmas-dot');
    if (!dot) return;

    // Check if Christmas theme is owned
    const hasChristmas = Shop.owned && Shop.owned['christmas'];

    // Check if player has played at least one game (so they have the cookies)
    const hasPlayed = localStorage.getItem('giftStackerHasPlayed') === 'true';

    // Show dot if NOT owned AND has played (meaning they can/should go buy it)
    if (!hasChristmas && hasPlayed) {
        dot.classList.remove('hidden');
    } else {
        dot.classList.add('hidden');
    }
}

// HARD RESET LOGIC (Global Event Delegation)
(function () {
    console.log("Reset Logic: Initializing Global Delegation...");

    document.addEventListener('click', (e) => {
        const target = e.target;

        // Helper to check ID or parent ID (for icons inside buttons)
        const isBtn = (id) => target.id === id || target.closest('#' + id);

        // 1. OPEN RESET MODAL
        if (isBtn('hard-reset-btn')) {
            e.preventDefault();
            console.log("Reset: Opening Modal");
            const settingsModal = document.getElementById('settings-modal');
            const hardResetModal = document.getElementById('hard-reset-modal');
            if (settingsModal) settingsModal.classList.add('hidden');
            if (hardResetModal) hardResetModal.classList.remove('hidden');
        }

        // 2. CONFIRM RESET
        else if (isBtn('confirm-reset-btn')) {
            e.preventDefault();
            console.log("Reset: Wiping Data...");
            // WIPE DATA
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith('giftStacker')) {
                    localStorage.removeItem(key);
                }
            });
            sessionStorage.clear();
            // Force Reload
            window.location.reload();
        }

        // 3. CANCEL RESET
        else if (isBtn('cancel-reset-btn')) {
            e.preventDefault();
            console.log("Reset: Cancelled");
            const settingsModal = document.getElementById('settings-modal');
            const hardResetModal = document.getElementById('hard-reset-modal');
            if (hardResetModal) hardResetModal.classList.add('hidden');
            if (settingsModal) settingsModal.classList.remove('hidden');
        }
    });
})();

// EASTER EGG: v0.6.7 "Six Seven" Animation
(function () {
    const versionText = document.getElementById('version-text');
    if (versionText) {
        versionText.style.cursor = 'pointer';
        versionText.addEventListener('click', () => {
            // Refactored sequence function
            const playSequence = () => {
                // 1. Text Pulse
                versionText.classList.remove('six-seven-anim');
                void versionText.offsetWidth;
                versionText.classList.add('six-seven-anim');

                if (Sound && Sound.ctx) {
                    const uiLayer = document.getElementById('ui-layer');

                    // --- STEP 1: "Six" (Red) ---
                    Sound.playTone(880, 'square', 0.1, 0.2);
                    const six = document.createElement('div');
                    six.className = 'floating-number fn-6';
                    six.innerText = '6';
                    if (uiLayer) uiLayer.appendChild(six);
                    setTimeout(() => six.remove(), 1000);

                    // --- STEP 2: "Sev" (Green) ---
                    setTimeout(() => {
                        Sound.playTone(830.6, 'square', 0.1, 0.2);
                        const seven = document.createElement('div');
                        seven.className = 'floating-number fn-7';
                        seven.innerText = '7';
                        seven.style.right = '50px';
                        if (uiLayer) uiLayer.appendChild(seven);
                        setTimeout(() => seven.remove(), 1000);
                    }, 400);

                    // --- STEP 3: "!" (Blue) ---
                    setTimeout(() => {
                        Sound.playTone(880, 'square', 0.1, 0.4);
                        const excl = document.createElement('div');
                        excl.className = 'floating-number fn-excl';
                        excl.innerText = '!';
                        excl.style.right = '70px';
                        if (uiLayer) uiLayer.appendChild(excl);
                        setTimeout(() => excl.remove(), 1000);
                    }, 800);
                }
            };

            // Play Twice (Debounced)
            if (versionText.dataset.playing === "true") return;
            versionText.dataset.playing = "true";

            playSequence();
            setTimeout(playSequence, 1400);

            // Allow re-trigger after full sequence (approx 2.5s)
            setTimeout(() => {
                versionText.dataset.playing = "false";
            }, 2600);
        });
    }
})();

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
function openShareModal(scoreVal = 0) {
    shareModal.classList.remove('hidden');
    updateVisualState();

    const appUrl = window.location.href;
    let msg = `How many gifts can YOU stack? 🎁\nPlay Gift Stacker & find out! ${appUrl}`;

    if (scoreVal > 0) {
        msg = `I just stacked ${scoreVal} gifts! How many can YOU stack? 🎁\nPlay Gift Stacker & find out! ${appUrl}`;
    }

    if (shareText) {
        shareText.value = msg;
    }
}

// CHEAT CODE FOR TESTING
// CHEAT CODE FOR TESTING
window.addEventListener('keydown', (e) => {
    // Shift + C to add 1000 cookies
    // Check code to avoid CapsLock weirdness
    if (e.code === 'KeyC' && e.shiftKey) {
        totalScoreBank += 1000;
        localStorage.setItem('giftStackerTotalBank', totalScoreBank);
        showToast("Cheat: +1000 Cookies! 🍪");
        // Update shop if open
        if (typeof Shop !== 'undefined' && shopModal && !shopModal.classList.contains('hidden')) {
            Shop.updateUI();
        }
    }
});

