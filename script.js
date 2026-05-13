(function() {
    // ---------- GAME CONFIG ----------
    const canvas = document.getElementById('snakeCanvas');
    const ctx = canvas.getContext('2d');
    const scoreSpan = document.getElementById('scoreDisplay');
    const bestSpan = document.getElementById('bestDisplay');
    const statusDiv = document.getElementById('statusText');

    // Grid settings: 20x20 grid, cell size = 25px (500/20)
    const GRID_SIZE = 20;
    const CELL_SIZE = canvas.width / GRID_SIZE; // 25px

    // Directions as vectors
    const DIRS = {
        'UP': { x: 0, y: -1 },
        'DOWN': { x: 0, y: 1 },
        'LEFT': { x: -1, y: 0 },
        'RIGHT': { x: 1, y: 0 }
    };

    let snake = []; // array of {x, y} positions
    let food = { x: 12, y: 10 };
    let currentDir = 'RIGHT'; // current moving direction string
    let nextDir = 'RIGHT';
    let score = 0;
    let bestScore = 0;
    let gameLoopId = null;
    let gameActive = true;
    let gameIntervalMs = 130; // speed (ms per tick)

    // Load best score from localStorage
    function loadBestScore() {
        const saved = localStorage.getItem('snakeBestScore');
        if (saved !== null && !isNaN(parseInt(saved))) {
            bestScore = parseInt(saved);
            bestSpan.innerText = bestScore;
        } else {
            bestScore = 0;
            bestSpan.innerText = "0";
        }
    }

    function saveBestScore() {
        if (score > bestScore) {
            bestScore = score;
            bestSpan.innerText = bestScore;
            localStorage.setItem('snakeBestScore', bestScore);
        }
    }

    // Helper: generate random free cell for food (avoid snake body)
    function getRandomEmptyCell() {
        const totalCells = GRID_SIZE * GRID_SIZE;
        if (snake.length >= totalCells) return null; // win condition (full board)

        // limit attempts to avoid infinite loops, but with plenty space
        const snakeSet = new Set(snake.map(seg => `${seg.x},${seg.y}`));
        if (snakeSet.size === totalCells) return null;

        let attempts = 0;
        const maxAttempts = 3000;
        while (attempts < maxAttempts) {
            const randX = Math.floor(Math.random() * GRID_SIZE);
            const randY = Math.floor(Math.random() * GRID_SIZE);
            if (!snakeSet.has(`${randX},${randY}`)) {
                return { x: randX, y: randY };
            }
            attempts++;
        }
        // fallback: linear scan (safe)
        for (let i = 0; i < GRID_SIZE; i++) {
            for (let j = 0; j < GRID_SIZE; j++) {
                if (!snakeSet.has(`${i},${j}`)) return { x: i, y: j };
            }
        }
        return null; // full board
    }

    // Initialize new game (reset everything)
    function initGame() {
        // classic starting snake: 3 cells in the middle horizontal
        const startX = Math.floor(GRID_SIZE / 2);
        const startY = Math.floor(GRID_SIZE / 2);
        snake = [
            { x: startX, y: startY },
            { x: startX - 1, y: startY },
            { x: startX - 2, y: startY }
        ];
        currentDir = 'RIGHT';
        nextDir = 'RIGHT';
        score = 0;
        updateScoreUI();
        gameActive = true;
        statusDiv.innerText = '▶ PLAYING';
        statusDiv.style.color = '#c6f7d0';

        // generate first food avoiding snake
        const newFood = getRandomEmptyCell();
        if (newFood) food = newFood;
        else food = { x: 5, y: 5 }; // fallback, but shouldn't happen at start

        // ensure food not overlapping with snake (just safety)
        const snakeSet = new Set(snake.map(s => `${s.x},${s.y}`));
        if (snakeSet.has(`${food.x},${food.y}`)) {
            const altFood = getRandomEmptyCell();
            if (altFood) food = altFood;
        }
    }

    // update score display
    function updateScoreUI() {
        scoreSpan.innerText = score;
        if (score > bestScore) {
            bestSpan.innerText = score;
            // will be saved on gameover / eat moment
        }
    }

    // Check collision with walls or self (excluding the tail if we're about to remove it)
    // For proper collision detection when eating, we need to handle differently
    function checkCollision(headX, headY, snakeArray, isEating) {
        // wall collision
        if (headX < 0 || headX >= GRID_SIZE || headY < 0 || headY >= GRID_SIZE) {
            return true;
        }

        // self collision: check if head position matches any existing segment
        // When eating, the tail is NOT removed, so snake length increases by 1
        // When not eating, the tail WILL be removed, so we should ignore the last segment
        for (let i = 0; i < snakeArray.length; i++) {
            // If we're not eating, ignore the tail segment (last element) because it will be removed
            if (!isEating && i === snakeArray.length - 1) {
                continue;
            }
            if (snakeArray[i].x === headX && snakeArray[i].y === headY) {
                return true;
            }
        }
        return false;
    }

    // Main game logic: move snake, eat food, handle game over
    function gameTick() {
        if (!gameActive) return;

        // commit direction (prevent 180° reversal)
        const forbidden = {
            'UP': 'DOWN',
            'DOWN': 'UP',
            'LEFT': 'RIGHT',
            'RIGHT': 'LEFT'
        };
        if (nextDir && forbidden[nextDir] !== currentDir) {
            currentDir = nextDir;
        }

        const move = DIRS[currentDir];
        const newHead = {
            x: snake[0].x + move.x,
            y: snake[0].y + move.y
        };

        // check if food is eaten
        const willEat = (newHead.x === food.x && newHead.y === food.y);

        // Create new snake array based on eating condition
        let newSnake;
        if (willEat) {
            // When eating: add new head, keep entire old snake (tail stays)
            newSnake = [newHead, ...snake];
        } else {
            // When not eating: add new head, remove tail
            newSnake = [newHead, ...snake.slice(0, -1)];
        }

        // Check collision with the appropriate context (isEating flag determines if tail is considered)
        const collision = checkCollision(newHead.x, newHead.y, snake, willEat);

        if (collision) {
            // GAME OVER
            gameActive = false;
            if (gameLoopId) {
                clearInterval(gameLoopId);
                gameLoopId = null;
            }
            statusDiv.innerText = '💀 GAME OVER 💀';
            statusDiv.style.color = '#ffb7a7';
            saveBestScore(); // store high score if needed
            draw(); // final draw with game over message via draw method
            return;
        }

        // apply new snake
        snake = newSnake;

        // handle food consumption and score update
        if (willEat) {
            score++;
            updateScoreUI();
            saveBestScore(); // update best instantly if new high achieved
            // generate new food
            const newFood = getRandomEmptyCell();
            if (newFood === null) {
                // WIN condition: board completely filled
                gameActive = false;
                if (gameLoopId) clearInterval(gameLoopId);
                gameLoopId = null;
                statusDiv.innerText = '🏆 YOU WIN! PERFECT! 🏆';
                statusDiv.style.color = '#f9f0b6';
                draw();
                return;
            }
            food = newFood;
        }

        // Redraw canvas after each tick
        draw();
    }

    // ------------------- DRAW EVERYTHING ------------------
    function draw() {
        if (!canvas || !ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // draw grid lines (soft)
        ctx.strokeStyle = '#2c5540';
        ctx.lineWidth = 0.6;
        for (let i = 0; i <= GRID_SIZE; i++) {
            ctx.beginPath();
            ctx.moveTo(i * CELL_SIZE, 0);
            ctx.lineTo(i * CELL_SIZE, canvas.height);
            ctx.stroke();
            ctx.moveTo(0, i * CELL_SIZE);
            ctx.lineTo(canvas.width, i * CELL_SIZE);
            ctx.stroke();
        }

        // draw food with juicy effect
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ff5252';
        ctx.beginPath();
        const fx = food.x * CELL_SIZE;
        const fy = food.y * CELL_SIZE;
        ctx.arc(fx + CELL_SIZE / 2, fy + CELL_SIZE / 2, CELL_SIZE * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e63535';
        ctx.beginPath();
        ctx.arc(fx + CELL_SIZE / 2 - 2, fy + CELL_SIZE / 2 - 2, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(fx + CELL_SIZE / 2 - 3, fy + CELL_SIZE / 2 - 4, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ff8a5c';
        ctx.beginPath();
        ctx.ellipse(fx + CELL_SIZE / 2 + 2, fy + CELL_SIZE / 2 + 2, 2, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        // draw snake (gradient scales)
        for (let i = 0; i < snake.length; i++) {
            const seg = snake[i];
            const segX = seg.x * CELL_SIZE;
            const segY = seg.y * CELL_SIZE;
            const isHead = (i === 0);
            const gradient = ctx.createRadialGradient(segX + 6, segY + 6, 3, segX + 12, segY + 12, 14);
            if (isHead) {
                gradient.addColorStop(0, '#88f76b');
                gradient.addColorStop(1, '#3ba52e');
            } else {
                gradient.addColorStop(0, '#63cf43');
                gradient.addColorStop(1, '#2b8c1a');
            }
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.roundRect(segX + 2, segY + 2, CELL_SIZE - 4, CELL_SIZE - 4, 7);
            ctx.fill();
            // eyes on head
            if (isHead) {
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(segX + CELL_SIZE - 8, segY + 8, 3.5, 0, Math.PI * 2);
                ctx.arc(segX + 8, segY + 8, 3.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#020202';
                ctx.beginPath();
                ctx.arc(segX + CELL_SIZE - 7, segY + 7, 1.8, 0, Math.PI * 2);
                ctx.arc(segX + 9, segY + 7, 1.8, 0, Math.PI * 2);
                ctx.fill();
                // tongue tiny
                ctx.beginPath();
                ctx.moveTo(segX + CELL_SIZE / 2, segY + 5);
                ctx.lineTo(segX + CELL_SIZE / 2 + 3, segY + 2);
                ctx.lineTo(segX + CELL_SIZE / 2 - 3, segY + 2);
                ctx.fillStyle = '#ff6161';
                ctx.fill();
            }
        }

        // extra shine
        ctx.shadowBlur = 0;
        if (!gameActive) {
            ctx.font = `bold ${Math.floor(CELL_SIZE * 1.5)}px 'Courier New'`;
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#fff8e7';
            ctx.shadowColor = 'black';
            ctx.shadowBlur = 3;
            ctx.fillText("⚡", canvas.width / 2 - 30, canvas.height / 2 - 20);
            ctx.font = `bold ${Math.floor(CELL_SIZE * 1.2)}px monospace`;
            ctx.fillStyle = '#f9e0a0';
            ctx.shadowBlur = 2;
            if (statusDiv.innerText.includes('GAME OVER')) {
                ctx.fillText("☠️ GAME OVER", canvas.width / 2 - 85, canvas.height / 2 + 25);
            } else if (statusDiv.innerText.includes('WIN')) {
                ctx.fillText("✨ PERFECT WIN ✨", canvas.width / 2 - 95, canvas.height / 2 + 25);
            } else {
                ctx.fillText("GAME OVER", canvas.width / 2 - 65, canvas.height / 2 + 25);
            }
            ctx.shadowBlur = 0;
        }
    }

    // Helper for canvas rounded rect
    if (!CanvasRenderingContext2D.prototype.roundRect) {
        CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
            if (w < 2 * r) r = w / 2;
            if (h < 2 * r) r = h / 2;
            this.moveTo(x + r, y);
            this.lineTo(x + w - r, y);
            this.quadraticCurveTo(x + w, y, x + w, y + r);
            this.lineTo(x + w, y + h - r);
            this.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
            this.lineTo(x + r, y + h);
            this.quadraticCurveTo(x, y + h, x, y + h - r);
            this.lineTo(x, y + r);
            this.quadraticCurveTo(x, y, x + r, y);
            return this;
        };
    }

    // ---------- Direction handling (keyboard + buttons + swipe) ----------
    function changeDirection(newDir) {
        if (!gameActive) return;
        const opposite = {
            'UP': 'DOWN',
            'DOWN': 'UP',
            'LEFT': 'RIGHT',
            'RIGHT': 'LEFT'
        };
        // prevent 180° flips
        if (opposite[newDir] !== currentDir) {
            nextDir = newDir;
        }
    }

    // keyboard controls
    function onKeyDown(e) {
        const key = e.key;
        let dir = null;
        if (key === 'ArrowUp') dir = 'UP';
        else if (key === 'ArrowDown') dir = 'DOWN';
        else if (key === 'ArrowLeft') dir = 'LEFT';
        else if (key === 'ArrowRight') dir = 'RIGHT';
        if (dir) {
            e.preventDefault();
            changeDirection(dir);
        }
        // optional R restart
        if (key === 'r' || key === 'R') {
            e.preventDefault();
            resetAndRestart();
        }
    }

    // restart function
    function resetAndRestart() {
        if (gameLoopId) {
            clearInterval(gameLoopId);
            gameLoopId = null;
        }
        initGame();
        gameActive = true;
        currentDir = 'RIGHT';
        nextDir = 'RIGHT';
        // restart game loop
        startLoop();
        draw();
        statusDiv.innerText = '▶ PLAYING';
        statusDiv.style.color = '#c6f7d0';
    }

    function startLoop() {
        if (gameLoopId) clearInterval(gameLoopId);
        gameLoopId = setInterval(() => {
            gameTick();
        }, gameIntervalMs);
    }

    // add touch / mobile swipe handling
    let touchStart = null;

    function onTouchStart(e) {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const touch = e.touches[0];
        touchStart = { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    }

    function onTouchEnd(e) {
        if (!touchStart || !gameActive) {
            touchStart = null;
            return;
        }
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const endX = e.changedTouches[0].clientX - rect.left;
        const endY = e.changedTouches[0].clientY - rect.top;
        const dx = endX - touchStart.x;
        const dy = endY - touchStart.y;
        if (Math.abs(dx) < 15 && Math.abs(dy) < 15) {
            touchStart = null;
            return;
        }
        if (Math.abs(dx) > Math.abs(dy)) {
            if (dx > 0) changeDirection('RIGHT');
            else changeDirection('LEFT');
        } else {
            if (dy > 0) changeDirection('DOWN');
            else changeDirection('UP');
        }
        touchStart = null;
    }

    // manual arrow buttons
    function attachButtons() {
        const arrows = document.querySelectorAll('.arrow-btn');
        arrows.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const dir = btn.getAttribute('data-dir');
                if (dir && gameActive) changeDirection(dir);
            });
        });
        document.getElementById('restartButton').addEventListener('click', () => {
            resetAndRestart();
        });
    }

    // ---------- INIT GAME & EVENT LISTENERS ----------
    function init() {
        loadBestScore();
        initGame();
        attachButtons();
        window.addEventListener('keydown', onKeyDown);
        canvas.addEventListener('touchstart', onTouchStart, { passive: false });
        canvas.addEventListener('touchend', onTouchEnd);
        canvas.addEventListener('touchcancel', () => { touchStart = null; });
        // optional mouse prevention for context menu
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        startLoop();
        draw();
    }

    // call init once page ready
    init();
})();