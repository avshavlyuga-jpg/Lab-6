
// Инициализация игры
document.addEventListener('DOMContentLoaded', function() {
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');
    const gameScreen = document.getElementById('game-screen');
    const messageOverlay = document.getElementById('message-overlay');
    const levelCompleteOverlay = document.getElementById('level-complete-overlay');
    const gameOverOverlay = document.getElementById('game-over-overlay');
    const startOverlay = document.getElementById('start-overlay');
    const pauseOverlay = document.getElementById('pause-overlay');
    const levelDisplay = document.getElementById('level-display');
    const timeDisplay = document.getElementById('time-display');
    const livesDisplay = document.getElementById('lives-display');
    const speedDisplay = document.getElementById('speed-display');
    const fullscreenBtn = document.getElementById('fullscreen-btn');

    // Добавляем индикатор здоровья
    const gameUI = document.getElementById('game-ui');
    const healthElem = document.createElement('div');
    healthElem.id = 'health-indicator';
    healthElem.innerHTML = 'Здоровье: <span id="health-display">100</span>';
    gameUI.appendChild(healthElem);
    const healthDisplay = document.getElementById('health-display');

    // Установка размеров canvas
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Фокус на игровом экране для управления клавиатурой
    gameScreen.focus();

    // Константы игры
    const GRAVITY = 0.3;
    const PLAYER_NORMAL_SPEED = 2.5;
    const PLAYER_BOOST_SPEED = 3.5;
    const JUMP_NORMAL_FORCE = -8;
    const JUMP_BOOST_FORCE = -10;
    const TILE_SIZE = Math.min(canvas.width, canvas.height) / 20;
    const SPIKE_DAMAGE = 100;
    const ENEMY_DAMAGE = 20;
    const SWORD_DAMAGE = 50;

    // Текущие значения скорости и прыжка
    let currentPlayerSpeed = PLAYER_NORMAL_SPEED;
    let currentJumpForce = JUMP_NORMAL_FORCE;

    // Переменные игры
    let gameState = {
        currentLevel: 1,
        lives: 3,
        timeLeft: 120,
        isPaused: false,
        isGameOver: false,
        levelComplete: false,
        gameStarted: false,
        player: null,
        platforms: [],
        spikes: [],
        exits: [],
        swords: [], // Новый массив для мечей
        enemies: [], // Новый массив для врагов
        keys: {},
        isSpeedBoost: false,
        playerHasSword: false, // Флаг наличия меча у игрока
        playerHealth: 100, // Здоровье игрока
        enemyHealth: 100  // Здоровье врага (для уровня 2)
    };

    // Управление с клавиатуры
    gameScreen.addEventListener('keydown', (e) => {
        // Начало игры при нажатии любой клавиши
        if (!gameState.gameStarted && startOverlay.style.display !== 'none') {
            startGame();
            return;
        }

        gameState.keys[e.code] = true;

        // Ускорение по Shift
        if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
            gameState.keys['Shift'] = true;
            if (gameState.gameStarted && !gameState.isPaused) {
                activateSpeedBoost();
            }
        }

        // Атака мечом по клавише Ctrl (только на уровне 2)
        if ((e.code === 'ControlLeft' || e.code === 'ControlRight') && gameState.playerHasSword && gameState.currentLevel === 2) {
            gameState.keys['Control'] = true;
            if (gameState.gameStarted && !gameState.isPaused) {
                playerAttack();
            }
        }


        // Перезапуск уровня по клавише R
        if (e.code === 'KeyR') {
            if (gameState.isGameOver) {
                restartGame();
            } else {
                resetLevel();
            }
        }


        // Предотвращение стандартных действий браузера
        if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
            e.preventDefault();
        }
    });

    gameScreen.addEventListener('keyup', (e) => {
        gameState.keys[e.code] = false;

        // Отпускание Shift
        if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
            gameState.keys['Shift'] = false;
            deactivateSpeedBoost();
        }

        // Отпускание Ctrl
        if (e.code === 'ControlLeft' || e.code === 'ControlRight') {
            gameState.keys['Control'] = false;
        }
    });

    // Начало игры по клику
    gameScreen.addEventListener('click', () => {
        if (!gameState.gameStarted && startOverlay.style.display !== 'none') {
            startGame();
        }
    });

    // Активация ускорения
    function activateSpeedBoost() {
        if (!gameState.isSpeedBoost) {
            gameState.isSpeedBoost = true;
            currentPlayerSpeed = PLAYER_BOOST_SPEED;
            currentJumpForce = JUMP_BOOST_FORCE;
            speedDisplay.textContent = "УСКОРЕНИЕ";
            speedDisplay.classList.add('speed-boost');
        }
    }

    // Деактивация ускорения
    function deactivateSpeedBoost() {
        gameState.isSpeedBoost = false;
        currentPlayerSpeed = PLAYER_NORMAL_SPEED;
        currentJumpForce = JUMP_NORMAL_FORCE;
        speedDisplay.textContent = "НОРМАЛЬНАЯ";
        speedDisplay.classList.remove('speed-boost');
    }

    // Атака игрока
    function playerAttack() {
        if (!gameState.playerHasSword || gameState.currentLevel !== 2) return;

        const player = gameState.player;
        const enemy = gameState.enemies[0];

        if (!enemy) return;

        // Проверка расстояния до врага
        const distance = Math.sqrt(
            Math.pow(player.x + player.width/2 - (enemy.x + enemy.width/2), 2) +
            Math.pow(player.y + player.height/2 - (enemy.y + enemy.height/2), 2)
        );

        // Если враг в радиусе атаки
        if (distance < 100) {
            gameState.enemyHealth -= SWORD_DAMAGE;
            showMessage(`Вы атаковали врага! У врага осталось: ${Math.max(0, gameState.enemyHealth)} HP`, 1000);

            // Враг получает урон
            enemy.takeDamage(SWORD_DAMAGE);

            if (gameState.enemyHealth <= 0) {
                showMessage("Враг побежден! Идите к выходу!", 1500);
                gameState.enemies = []; // Убираем врага
            }
        } else {
            showMessage("Враг слишком далеко!", 500);
        }
    }

    // Класс игрока (обновлен для поддержки меча)
    class Player {
        constructor(x, y) {
            this.x = x;
            this.y = y;
            this.width = TILE_SIZE * 0.7;
            this.height = TILE_SIZE * 1.5;
            this.velocityX = 0;
            this.velocityY = 0;
            this.onGround = false;
            this.color = '#d4af37';
            this.direction = 1; // 1 - вправо, -1 - влево
            this.isJumping = false;
            this.isClimbing = false;
            this.hasSword = false;
            this.swordColor = '#bdc3c7';
        }

        update() {
            // Применение гравитации
            if (!this.onGround && !this.isClimbing) {
                this.velocityY += GRAVITY;
            }

            // Управление движением
            if (gameState.keys['ArrowLeft'] && !gameState.isPaused && !gameState.levelComplete && !gameState.isGameOver && gameState.gameStarted) {
                this.velocityX = -currentPlayerSpeed;
                this.direction = -1;
            } else if (gameState.keys['ArrowRight'] && !gameState.isPaused && !gameState.levelComplete && !gameState.isGameOver && gameState.gameStarted) {
                this.velocityX = currentPlayerSpeed;
                this.direction = 1;
            } else {
                this.velocityX = 0;
            }

            // Прыжок
            if (gameState.keys['Space'] && this.onGround && !gameState.isPaused && !gameState.levelComplete && !gameState.isGameOver && gameState.gameStarted) {
                this.velocityY = currentJumpForce;
                this.onGround = false;
            }

            // Подъем/спуск по лестницам (только на уровне 1)
            this.isClimbing = false;
            if (gameState.keys['ArrowUp'] && !gameState.isPaused && !gameState.levelComplete && !gameState.isGameOver && gameState.gameStarted && gameState.currentLevel === 1) {
                // Проверка, находится ли игрок рядом с лестницей
                for (const platform of gameState.platforms) {
                    if (platform.isLadder &&
                        this.x + this.width/2 > platform.x &&
                        this.x + this.width/2 < platform.x + platform.width &&
                        this.y + this.height > platform.y &&
                        this.y < platform.y + platform.height) {
                        this.isClimbing = true;
                        this.velocityY = -currentPlayerSpeed;
                        break;
                    }
                }
            }

            // Обновление позиции
            this.x += this.velocityX;
            this.y += this.velocityY;

            // Ограничение выхода за границы экрана
            if (this.x < 0) this.x = 0;
            if (this.x + this.width > canvas.width) this.x = canvas.width - this.width;
            if (this.y < 0) this.y = 0;
            if (this.y + this.height > canvas.height) {
                this.y = canvas.height - this.height;
                this.onGround = true;
                this.velocityY = 0;
            }

            // Проверка столкновений с платформами
            this.onGround = false;
            for (const platform of gameState.platforms) {
                if (this.collidesWith(platform) && !platform.isLadder) {
                    // Столкновение сверху
                    if (this.velocityY > 0 && this.y + this.height <= platform.y + this.velocityY) {
                        this.y = platform.y - this.height;
                        this.onGround = true;
                        this.velocityY = 0;
                    }
                    // Столкновение снизу
                    else if (this.velocityY < 0 && this.y >= platform.y + platform.height + this.velocityY) {
                        this.y = platform.y + platform.height;
                        this.velocityY = 0;
                    }
                    // Столкновение сбоку
                    else if (this.velocityX !== 0) {
                        if (this.velocityX > 0 && this.x + this.width <= platform.x + this.velocityX) {
                            this.x = platform.x - this.width;
                        } else if (this.velocityX < 0 && this.x >= platform.x + platform.width + this.velocityX) {
                            this.x = platform.x + platform.width;
                        }
                    }
                }
            }

            // Проверка столкновений с шипами (только на уровне 1)
            if (gameState.currentLevel === 1) {
                for (const spike of gameState.spikes) {
                    if (this.collidesWith(spike)) {
                        takeDamage(SPIKE_DAMAGE);
                        // Отталкивание от шипов
                        if (this.x < spike.x + spike.width/2) {
                            this.x = spike.x - this.width;
                        } else {
                            this.x = spike.x + spike.width;
                        }
                        break;
                    }
                }
            }

            // Проверка подбора меча (только на уровне 1)
            for (const sword of gameState.swords) {
                if (this.collidesWith(sword)) {
                    pickUpSword(sword);
                    break;
                }
            }

            // Проверка столкновения с врагом (только на уровне 2)
            if (gameState.currentLevel === 2) {
                for (const enemy of gameState.enemies) {
                    if (this.collidesWith(enemy)) {
                        takeDamage(ENEMY_DAMAGE);
                        // Отталкивание от врага
                        if (this.x < enemy.x + enemy.width/2) {
                            this.x = enemy.x - this.width - 10;
                        } else {
                            this.x = enemy.x + enemy.width + 10;
                        }
                        break;
                    }
                }
            }

            // Проверка достижения выхода
            for (const exit of gameState.exits) {
                if (this.collidesWith(exit)) {
                    completeLevel();
                    break;
                }
            }
        }

        collidesWith(object) {
            return this.x < object.x + object.width &&
                this.x + this.width > object.x &&
                this.y < object.y + object.height &&
                this.y + this.height > object.y;
        }

        draw() {
            // Тело принца
            ctx.fillStyle = this.color;
            ctx.fillRect(this.x, this.y, this.width, this.height);

            // Голова
            ctx.fillStyle = '#f7dc6f';
            ctx.fillRect(this.x + this.width/4, this.y, this.width/2, this.height/4);

            // Глаза
            ctx.fillStyle = '#000';
            const eyeOffset = this.direction > 0 ? this.width/3 : this.width/4;
            ctx.fillRect(this.x + eyeOffset, this.y + this.height/8, this.width/10, this.height/15);

            // Меч в руке (если подобран, только на уровне 2)
            if (gameState.playerHasSword && gameState.currentLevel === 2) {
                ctx.fillStyle = this.swordColor;
                const swordLength = TILE_SIZE;
                const swordX = this.direction > 0 ? this.x + this.width : this.x - swordLength;
                const swordY = this.y + this.height/3;

                // Клинок
                ctx.fillRect(swordX, swordY, swordLength * this.direction, 5);

                // Эфес
                ctx.fillStyle = '#d4af37';
                const guardX = this.direction > 0 ? swordX : swordX + swordLength;
                ctx.fillRect(guardX - 3 * this.direction, swordY - 5, 6, 15);

                // Рукоять
                ctx.fillStyle = '#8b4513';
                ctx.fillRect(guardX - 2 * this.direction, swordY - 4, 4, 13);
            }
            // Меч для уровня 1 (оригинальный вид)
            else if (gameState.currentLevel === 1) {
                ctx.fillStyle = '#bdc3c7';
                ctx.fillRect(this.x + (this.direction > 0 ? this.width : -this.width/3), this.y + this.height/3, this.width/3, this.height/20);
            }
        }
    }

    // Класс меча
    class Sword {
        constructor(x, y) {
            this.x = x;
            this.y = y;
            this.width = TILE_SIZE * 0.8;
            this.height = TILE_SIZE * 0.2;
            this.color = '#bdc3c7';
            this.hiltColor = '#d4af37';
            this.handleColor = '#8b4513';
            this.isPickedUp = false;
        }

        draw() {
            if (this.isPickedUp) return;

            // Клинок
            ctx.fillStyle = this.color;
            ctx.fillRect(this.x, this.y, this.width, this.height);

            // Острие
            ctx.beginPath();
            ctx.moveTo(this.x + this.width, this.y);
            ctx.lineTo(this.x + this.width + 10, this.y + this.height/2);
            ctx.lineTo(this.x + this.width, this.y + this.height);
            ctx.closePath();
            ctx.fill();

            // Эфес
            ctx.fillStyle = this.hiltColor;
            ctx.fillRect(this.x - 5, this.y - 5, 10, this.height + 10);

            // Рукоять
            ctx.fillStyle = this.handleColor;
            ctx.fillRect(this.x - 8, this.y - 3, 6, this.height + 6);

            // Драгоценный камень на эфесе
            ctx.fillStyle = '#e74c3c';
            ctx.beginPath();
            ctx.arc(this.x - 2, this.y + this.height/2, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Класс врага (исправленная версия с коллизией)
    class Enemy {
        constructor(x, y) {
            this.x = x;
            this.y = y;
            this.width = TILE_SIZE * 0.8;
            this.height = TILE_SIZE * 1.3;
            this.velocityX = 0;
            this.velocityY = 0;
            this.color = '#c0392b';
            this.health = 100;
            this.speed = 1.5;
            this.direction = 1;
            this.isAlive = true;
            this.attackCooldown = 0;
            this.onGround = false; // Добавляем флаг нахождения на земле
        }

        update() {
            if (!this.isAlive) return;

            // Следование за игроком
            const player = gameState.player;
            if (player) {
                // Определяем направление к игроку
                if (player.x + player.width/2 > this.x + this.width/2) {
                    this.direction = 1;
                    this.velocityX = this.speed;
                } else {
                    this.direction = -1;
                    this.velocityX = -this.speed;
                }

                // Небольшая гравитация для врага
                if (!this.onGround) {
                    this.velocityY += GRAVITY * 0.5;
                }
            }

            // Обновление позиции
            this.x += this.velocityX;
            this.y += this.velocityY;

            // Ограничение выхода за границы экрана (горизонтальные)
            if (this.x < 0) {
                this.x = 0;
                this.velocityX = 0;
            }
            if (this.x + this.width > canvas.width) {
                this.x = canvas.width - this.width;
                this.velocityX = 0;
            }

            // Проверка столкновений с платформами
            this.onGround = false;
            for (const platform of gameState.platforms) {
                if (this.collidesWith(platform) && !platform.isLadder) {
                    // Столкновение сверху (падение на платформу)
                    if (this.velocityY > 0 && this.y + this.height <= platform.y + this.velocityY) {
                        this.y = platform.y - this.height;
                        this.onGround = true;
                        this.velocityY = 0;
                    }
                    // Столкновение снизу (подпрыгивание в потолок)
                    else if (this.velocityY < 0 && this.y >= platform.y + platform.height + this.velocityY) {
                        this.y = platform.y + platform.height;
                        this.velocityY = 0;
                    }
                    // Столкновение сбоку
                    else if (this.velocityX !== 0) {
                        if (this.velocityX > 0 && this.x + this.width <= platform.x + this.velocityX) {
                            this.x = platform.x - this.width;
                            this.velocityX = 0;
                            this.direction *= -1; // Меняем направление при столкновении сбоку
                        } else if (this.velocityX < 0 && this.x >= platform.x + platform.width + this.velocityX) {
                            this.x = platform.x + platform.width;
                            this.velocityX = 0;
                            this.direction *= -1; // Меняем направление при столкновении сбоку
                        }
                    }
                }
            }

            // Падение с края платформы (чтобы враг не ходил в пустоту)
            if (this.onGround) {
                let willFall = true;
                const checkX = this.x + this.width/2 + (this.direction * 10); // Проверяем немного впереди по направлению движения

                for (const platform of gameState.platforms) {
                    if (!platform.isLadder &&
                        platform.y <= this.y + this.height &&
                        platform.y + platform.height >= this.y + this.height &&
                        checkX >= platform.x &&
                        checkX <= platform.x + platform.width) {
                        willFall = false;
                        break;
                    }
                }

                if (willFall) {
                    this.direction *= -1; // Разворачиваемся, если впереди обрыв
                    this.velocityX = this.speed * this.direction;
                }
            }

            // Охлаждение атаки
            if (this.attackCooldown > 0) {
                this.attackCooldown--;
            }
        }

        // Метод проверки столкновений (добавляем в класс Enemy)
        collidesWith(object) {
            return this.x < object.x + object.width &&
                this.x + this.width > object.x &&
                this.y < object.y + object.height &&
                this.y + this.height > object.y;
        }

        takeDamage(amount) {
            this.health -= amount;
            if (this.health <= 0) {
                this.isAlive = false;
                showMessage("Враг повержен!", 1000);
            }
        }

        draw() {
            if (!this.isAlive) return;

            // Тело врага
            ctx.fillStyle = this.color;
            ctx.fillRect(this.x, this.y, this.width, this.height);

            // Голова
            ctx.fillStyle = '#e74c3c';
            ctx.fillRect(this.x + this.width/4, this.y, this.width/2, this.height/4);

            // Глаза
            ctx.fillStyle = '#000';
            const eyeOffset = this.direction > 0 ? this.width/3 : this.width/4;
            ctx.fillRect(this.x + eyeOffset, this.y + this.height/8, this.width/10, this.height/15);

            // Индикатор здоровья
            const healthBarWidth = 60;
            const healthBarHeight = 6;
            const healthBarX = this.x + this.width/2 - healthBarWidth/2;
            const healthBarY = this.y - 15;

            // Фон индикатора
            ctx.fillStyle = '#2c3e50';
            ctx.fillRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight);

            // Здоровье
            const healthWidth = (this.health / 100) * healthBarWidth;
            ctx.fillStyle = this.health > 50 ? '#27ae60' : (this.health > 20 ? '#f39c12' : '#e74c3c');
            ctx.fillRect(healthBarX, healthBarY, healthWidth, healthBarHeight);

            // Рамка индикатора
            ctx.strokeStyle = '#ecf0f1';
            ctx.lineWidth = 1;
            ctx.strokeRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight);

            // Текст здоровья
            ctx.fillStyle = '#ecf0f1';
            ctx.font = '10px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`${this.health} HP`, this.x + this.width/2, healthBarY - 2);
            ctx.textAlign = 'left';
        }
    }

    // Класс платформы
    class Platform {
        constructor(x, y, width, height, isLadder = false) {
            this.x = x;
            this.y = y;
            this.width = width;
            this.height = height;
            this.isLadder = isLadder;
            this.color = isLadder ? '#8b4513' : '#7f8c8d';
            this.brickColor = '#95a5a6';
            this.brickDarkColor = '#7f8c8d';
        }

        draw() {
            // Для обычных платформ рисуем кирпичи
            if (!this.isLadder) {
                // Основной фон
                ctx.fillStyle = this.color;
                ctx.fillRect(this.x, this.y, this.width, this.height);

                // Кирпичная кладка
                const brickWidth = 15;
                const brickHeight = 8;

                for (let row = 0; row < this.height / brickHeight; row++) {
                    for (let col = 0; col < this.width / brickWidth; col++) {
                        const brickX = this.x + col * brickWidth;
                        const brickY = this.y + row * brickHeight;

                        // Чередование рядов кирпичей
                        if (row % 2 === 0) {
                            // Четные ряды
                            ctx.fillStyle = col % 2 === 0 ? this.brickColor : this.brickDarkColor;
                        } else {
                            // Нечетные ряды со смещением
                            ctx.fillStyle = (col + 0.5) % 2 === 0 ? this.brickColor : this.brickDarkColor;
                        }

                        // Рисуем кирпич с закруглениями
                        ctx.fillRect(brickX, brickY, brickWidth - 1, brickHeight - 1);

                        // Линии между кирпичами
                        ctx.fillStyle = '#5d6d7e';
                        if (col < this.width / brickWidth - 1) {
                            ctx.fillRect(brickX + brickWidth - 1, brickY, 1, brickHeight - 1);
                        }
                        if (row < this.height / brickHeight - 1) {
                            ctx.fillRect(brickX, brickY + brickHeight - 1, brickWidth - 1, 1);
                        }
                    }
                }

                // Верхняя часть платформы
                ctx.fillStyle = '#d4af37';
                ctx.fillRect(this.x, this.y - 3, this.width, 3);

            } else {
                // Лестница
                ctx.fillStyle = this.color;
                ctx.fillRect(this.x, this.y, this.width, this.height);

                // Боковые стороны лестницы
                ctx.fillStyle = '#5d4037';
                ctx.fillRect(this.x, this.y, 3, this.height);
                ctx.fillRect(this.x + this.width - 3, this.y, 3, this.height);

                // Перекладины лестницы
                ctx.fillStyle = '#d4af37';
                const stepHeight = 20;
                for (let i = 0; i < this.height / stepHeight; i++) {
                    const stepY = this.y + i * stepHeight;
                    ctx.fillRect(this.x, stepY, this.width, 4);
                }
            }
        }
    }

    // Класс шипов
    class Spike {
        constructor(x, y, width, height) {
            this.x = x;
            this.y = y;
            this.width = width;
            this.height = height;
            this.color = '#c0392b';
            this.metalColor = '#7f8c8d';
            this.bladeColor = '#e74c3c';
        }

        draw() {
            // Основание шипа
            ctx.fillStyle = this.metalColor;
            ctx.fillRect(this.x, this.y + this.height - 5, this.width, 5);

            // Металлическая стойка
            ctx.fillStyle = '#95a5a6';
            ctx.fillRect(this.x + this.width/2 - 3, this.y + this.height - 10, 6, 10);

            // Лезвие шипа
            ctx.fillStyle = this.bladeColor;

            // Рисуем треугольник-шип
            ctx.beginPath();
            ctx.moveTo(this.x + this.width/2, this.y);
            ctx.lineTo(this.x + this.width/4, this.y + this.height - 10);
            ctx.lineTo(this.x + this.width/4 * 3, this.y + this.height - 10);
            ctx.closePath();
            ctx.fill();

            // Острие
            ctx.fillStyle = '#ffebee';
            ctx.beginPath();
            ctx.moveTo(this.x + this.width/2, this.y);
            ctx.lineTo(this.x + this.width/2 - 2, this.y + 5);
            ctx.lineTo(this.x + this.width/2 + 2, this.y + 5);
            ctx.closePath();
            ctx.fill();

            // Боковые грани для объема
            ctx.fillStyle = '#b03a2e';
            ctx.beginPath();
            ctx.moveTo(this.x + this.width/2, this.y);
            ctx.lineTo(this.x + this.width/4, this.y + this.height - 10);
            ctx.lineTo(this.x + this.width/4, this.y + this.height - 8);
            ctx.lineTo(this.x + this.width/2 - 2, this.y + 3);
            ctx.closePath();
            ctx.fill();
        }
    }

    // Класс выхода
    class Exit {
        constructor(x, y, width, height) {
            this.x = x;
            this.y = y;
            this.width = width;
            this.height = height;
            this.color = '#27ae60';
        }

        draw() {
            // Дверь выхода
            ctx.fillStyle = this.color;
            ctx.fillRect(this.x, this.y, this.width, this.height);

            // Деревянная текстура двери
            ctx.fillStyle = '#1e8449';
            for (let i = 0; i < this.height; i += 10) {
                ctx.fillRect(this.x, this.y + i, this.width, 3);
            }
            for (let i = 0; i < this.width; i += 10) {
                ctx.fillRect(this.x + i, this.y, 3, this.height);
            }

            // Ручка
            ctx.fillStyle = '#d4af37';
            ctx.beginPath();
            ctx.arc(this.x + this.width - 15, this.y + this.height/2, 5, 0, Math.PI * 2);
            ctx.fill();

            // Замок
            ctx.fillStyle = '#2c3e50';
            ctx.fillRect(this.x + this.width - 25, this.y + this.height/2 - 10, 10, 20);

            // Арка над дверью
            ctx.fillStyle = '#2c3e50';
            ctx.beginPath();
            ctx.arc(this.x + this.width/2, this.y, 20, 0, Math.PI, true);
            ctx.fill();

            // Кирпичи над аркой
            ctx.fillStyle = '#7f8c8d';
            for (let i = 0; i < 5; i++) {
                ctx.fillRect(this.x + i * 8, this.y - 5, 6, 5);
            }
        }
    }

    // Инициализация уровней
    function initLevel(level) {
        gameState.platforms = [];
        gameState.spikes = [];
        gameState.exits = [];
        gameState.swords = [];
        gameState.enemies = [];

        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;
        const floorHeight = canvasHeight - TILE_SIZE;

        if (level === 1) {
            // Пол
            gameState.platforms.push(new Platform(0, floorHeight, canvasWidth, TILE_SIZE));

            // Стены по бокам
            gameState.platforms.push(new Platform(0, 0, TILE_SIZE, canvasHeight));
            gameState.platforms.push(new Platform(canvasWidth - TILE_SIZE, 0, TILE_SIZE, canvasHeight));

            // Потолок
            gameState.platforms.push(new Platform(0, 0, canvasWidth, TILE_SIZE));

            // Платформа в начале - стартовая площадка
            gameState.platforms.push(new Platform(44, floorHeight - TILE_SIZE * 3, 250, 250));

            gameState.spikes.push(new Spike(300, floorHeight-38, TILE_SIZE, TILE_SIZE));
            for (let i = 0; i < 4; i++) {
                gameState.spikes.push(new Spike(300+30*i, floorHeight-38, TILE_SIZE, TILE_SIZE));
            }


            for (let i = 0; i < 32; i++) {
                gameState.spikes.push(new Spike(520+30*i, floorHeight-38, TILE_SIZE, TILE_SIZE));
            }

            // Меч (добавляем на уровне 1)
            gameState.swords.push(new Sword(490, floorHeight - 330));

            // Первая платформа
            gameState.platforms.push(new Platform(450, floorHeight - 300, TILE_SIZE * 3, TILE_SIZE));

            // Платформа после спуска
            gameState.platforms.push(new Platform(TILE_SIZE * 12, floorHeight - TILE_SIZE*1.5, TILE_SIZE * 3, TILE_SIZE*10));

            // Вторая платформа с лестницей для подъема
            gameState.platforms.push(new Platform(TILE_SIZE * 18, floorHeight - TILE_SIZE * 6, TILE_SIZE * 3, TILE_SIZE));

            // Лестница для подъема
            gameState.platforms.push(new Platform(TILE_SIZE * 17, floorHeight - TILE_SIZE * 6, TILE_SIZE, TILE_SIZE * 3.5, true));

            // Высокая платформа перед выходом
            gameState.platforms.push(new Platform(TILE_SIZE * 25, floorHeight - TILE_SIZE * 7, TILE_SIZE * 4, TILE_SIZE));

            // Шип
            gameState.spikes.push(new Spike(TILE_SIZE * 28, floorHeight - TILE_SIZE * 8, TILE_SIZE, TILE_SIZE));

            // Платформа с выходом
            gameState.platforms.push(new Platform(TILE_SIZE * 33, floorHeight - TILE_SIZE * 3, TILE_SIZE * 8, TILE_SIZE));

            // Выход - дверь
            gameState.exits.push(new Exit(TILE_SIZE * 39, floorHeight - TILE_SIZE * 6, TILE_SIZE * 2, TILE_SIZE * 3));

            // Игрок - начинаем на стартовой платформе
            gameState.player = new Player(100, 100);

            // Сбрасываем здоровье игрока
            gameState.playerHealth = 100;
            updateHealthDisplay();
        }

        // Уровень 2 - битва с врагом
        else if (level === 2) {
            // Пол
            gameState.platforms.push(new Platform(0, floorHeight, canvasWidth, TILE_SIZE));

            // Стены по бокам
            gameState.platforms.push(new Platform(0, 0, TILE_SIZE, canvasHeight));
            gameState.platforms.push(new Platform(canvasWidth - TILE_SIZE, 0, TILE_SIZE, canvasHeight));

            // Потолок
            gameState.platforms.push(new Platform(0, 0, canvasWidth, TILE_SIZE));

            // Выход
            gameState.exits.push(new Exit(canvasWidth - TILE_SIZE*4, floorHeight - TILE_SIZE*3, TILE_SIZE*2, TILE_SIZE*3));

            // Враг (в центре)
            const enemy = new Enemy(canvasWidth/2 - 30, floorHeight - 100);
            gameState.enemies.push(enemy);

            // Игрок
            gameState.player = new Player(50, floorHeight - TILE_SIZE*4);

            // Сбрасываем здоровье врага
            gameState.enemyHealth = 100;
        }
    }

    // Подбор меча
    function pickUpSword(sword) {
        if (!sword.isPickedUp) {
            sword.isPickedUp = true;
            gameState.playerHasSword = true;
            gameState.player.hasSword = true;
            showMessage("Вы подобрали меч! Нажмите CTRL для атаки на 2 уровне", 2000);

            // Убираем меч из массива
            gameState.swords = gameState.swords.filter(s => s !== sword);
        }
    }

    // Получение урона
    function takeDamage(amount) {
        gameState.playerHealth -= amount;
        updateHealthDisplay();

        // Если здоровье закончилось
        if (gameState.playerHealth <= 0) {
            gameState.lives--;
            livesDisplay.textContent = gameState.lives;

            if (gameState.lives <= 0) {
                gameOver(); // Игра закончена
            } else {
                // Восстанавливаем здоровье и перезапускаем уровень
                gameState.playerHealth = 100;
                updateHealthDisplay();
                resetLevel();
            }
        }
    }

    // Обновление отображения здоровья
    function updateHealthDisplay() {
        healthDisplay.textContent = gameState.playerHealth;

        // Меняем цвет в зависимости от здоровья
        if (gameState.playerHealth > 70) {
            healthDisplay.style.color = '#27ae60';
        } else if (gameState.playerHealth > 30) {
            healthDisplay.style.color = '#f39c12';
        } else {
            healthDisplay.style.color = '#e74c3c';
        }
    }

    // Завершение уровня
    function completeLevel() {
        if (gameState.levelComplete) return;

        gameState.levelComplete = true;

        // Если это второй уровень - сначала проверяем, повержен ли враг
        if (gameState.currentLevel === 2) {
            if (gameState.enemies.length > 0 && gameState.enemyHealth > 0) {
                showMessage("Сначала победите врага!", 1500);
                gameState.levelComplete = false;
                return;
            }

            setTimeout(() => {
                gameWin();
            }, 500);
        } else {
            setTimeout(() => {
                levelCompleteOverlay.style.display = 'flex';

                setTimeout(() => {
                    levelCompleteOverlay.style.display = 'none';
                    gameState.currentLevel++;
                    levelDisplay.textContent = gameState.currentLevel;
                    gameState.levelComplete = false;
                    initLevel(gameState.currentLevel);

                    // Сообщение для 2 уровня
                    if (gameState.currentLevel === 2) {
                        if (gameState.playerHasSword) {
                            showMessage("У вас есть меч! Нажмите CTRL для атаки врага", 2500);
                        }
                    }
                }, 2000);
            }, 500);
        }
    }

    // Конец игры
    function gameOver() {
        gameState.isGameOver = true;
        gameOverOverlay.style.display = 'flex';
    }

    function gameWin() {
        gameState.isGameOver = true;
        gameOverOverlay.innerHTML = `
        <div class="message">
            <h2>ПОБЕДА!</h2>
            <p>Вы прошли все уровни!</p>
            <p>Время: ${timeDisplay.textContent}</p>
            <p>Нажмите R для перезапуска игры</p>
        </div>
    `;
        gameOverOverlay.style.display = 'flex';
    }

    // Начало игры
    function startGame() {
        gameState.gameStarted = true;
        startOverlay.style.display = 'none';
        gameScreen.focus();
        speedDisplay.textContent = "НОРМАЛЬНАЯ";
        updateHealthDisplay();
    }

    // Перезапуск игры
    function restartGame() {
        gameState.currentLevel = 1;
        gameState.lives = 3;
        gameState.timeLeft = 120;
        gameState.isPaused = false;
        gameState.isGameOver = false;
        gameState.levelComplete = false;
        gameState.gameStarted = true;
        gameState.playerHasSword = false;
        gameState.playerHealth = 100;
        gameState.enemyHealth = 100;

        // Сброс ускорения
        gameState.isSpeedBoost = false;
        currentPlayerSpeed = PLAYER_NORMAL_SPEED;
        currentJumpForce = JUMP_NORMAL_FORCE;

        levelDisplay.textContent = gameState.currentLevel;
        livesDisplay.textContent = gameState.lives;
        speedDisplay.textContent = "НОРМАЛЬНАЯ";
        speedDisplay.classList.remove('speed-boost');
        speedDisplay.style.color = '';

        gameOverOverlay.style.display = 'none';
        levelCompleteOverlay.style.display = 'none';
        pauseOverlay.style.display = 'none';

        initLevel(gameState.currentLevel);
        updateHealthDisplay();
        gameScreen.focus();
    }

    // Сброс уровня
    function resetLevel() {
        if (!gameState.gameStarted) return;

        // Сброс ускорения при перезапуске уровня
        if (gameState.isSpeedBoost) {
            deactivateSpeedBoost();
        }

        // Восстанавливаем здоровье
        gameState.playerHealth = 100;
        updateHealthDisplay();

        // Инициализируем уровень заново
        initLevel(gameState.currentLevel);
    }

    // Показ сообщения
    function showMessage(text, duration) {
        messageOverlay.innerHTML = `<div class="message">${text}</div>`;

        if (duration > 0) {
            setTimeout(() => {
                messageOverlay.innerHTML = '';
            }, duration);
        }
    }

    // Обновление таймера
    function updateTimer() {
        if (!gameState.gameStarted || gameState.isPaused || gameState.levelComplete || gameState.isGameOver) return;

        gameState.timeLeft--;

        if (gameState.timeLeft <= 0) {
            gameOver();
            return;
        }

        const minutes = Math.floor(gameState.timeLeft / 60);
        const seconds = gameState.timeLeft % 60;

        timeDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    // Основной игровой цикл
    function gameLoop() {
        // Очистка экрана
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Рисование фона
        drawBackground();

        // Обновление и отрисовка игровых объектов
        if (gameState.gameStarted && !gameState.isPaused && !gameState.levelComplete && !gameState.isGameOver) {
            gameState.player.update();

            // Обновление врагов
            if (gameState.currentLevel === 2) {
                gameState.enemies.forEach(enemy => enemy.update());
            }
        }

        // Отрисовка всех объектов
        if (gameState.gameStarted) {
            gameState.platforms.forEach(platform => platform.draw());
            gameState.spikes.forEach(spike => spike.draw());
            gameState.swords.forEach(sword => sword.draw());
            gameState.enemies.forEach(enemy => enemy.draw());
            gameState.exits.forEach(exit => exit.draw());
            if (gameState.player) gameState.player.draw();
        }

        requestAnimationFrame(gameLoop);
    }

    // Рисование фона
    function drawBackground() {
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, '#0c2461');
        gradient.addColorStop(0.5, '#1e3799');
        gradient.addColorStop(1, '#0c2461');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Текстура каменных стен по бокам
        ctx.fillStyle = 'rgba(44, 62, 80, 0.3)';
        for (let x = 0; x < canvas.width; x += 30) {
            for (let y = 0; y < canvas.height; y += 30) {
                if ((x + y) % 60 === 0) {
                    ctx.fillRect(x, y, 20, 20);
                }
            }
        }
    }

    // Запуск таймера
    setInterval(updateTimer, 1000);

    // Инициализация первого уровня и запуск игры
    initLevel(1);
    gameLoop();

    // Автофокус на игровом экране
    setTimeout(() => {
        gameScreen.focus();
    }, 100);
});
