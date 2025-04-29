class MathGame {
    constructor() {
        this.score = 0;
        this.currentLevel = 1;
        this.timeElapsed = 0;
        this.levelStartTime = 0;
        this.timer = null;
        this.problem = null;
        this.correctAnswer = null;
        this.completedLevels = [];

        this.initializeElements();
        this.loadCompletedLevels().then(() => {
            this.startTimer();
            this.generateProblem();
            this.setupEventListeners();
        });
    }

    initializeElements() {
        this.timerElement = document.getElementById('timer');
        this.scoreElement = document.getElementById('score');
        this.levelElement = document.getElementById('current-level');
        this.problemElement = document.getElementById('problem');
        this.answerInput = document.getElementById('answer');
        this.checkButton = document.getElementById('check-answer');
        this.resultElement = document.getElementById('result');
    }

    async loadCompletedLevels() {
        try {
            const response = await fetch('/api/user-levels', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) {
                throw new Error('Помилка завантаження рівнів');
            }

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error || 'Помилка завантаження рівнів');
            }

            this.completedLevels = data.levels
                .filter(level => level.completed)
                .map(level => level.level);
            
            // Знаходимо перший незавершений рівень
            const firstUncompleted = data.levels.find(level => !level.completed);
            if (firstUncompleted) {
                this.currentLevel = firstUncompleted.level;
                this.levelElement.textContent = this.currentLevel;
            } else {
                // Якщо всі рівні завершені, показуємо повідомлення
                this.showResult('Вітаємо! Ви завершили всі рівні!', 'correct');
                this.problemElement.textContent = 'Гра завершена';
                this.answerInput.style.display = 'none';
                this.checkButton.style.display = 'none';
            }
        } catch (error) {
            console.error('Помилка при завантаженні рівнів:', error);
            this.showResult('Помилка завантаження рівнів. Спробуйте оновити сторінку.', 'incorrect');
        }
    }

    startTimer() {
        this.levelStartTime = this.timeElapsed;
        this.timer = setInterval(() => {
            this.timeElapsed++;
            const minutes = Math.floor(this.timeElapsed / 60);
            const seconds = this.timeElapsed % 60;
            this.timerElement.textContent = `${minutes.toString().padStart(2, '0')}.${seconds.toString().padStart(2, '0')}`;
        }, 1000);
    }

    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes.toString().padStart(2, '0')}.${remainingSeconds.toString().padStart(2, '0')}`;
    }

    generateProblem() {
        const operations = ['+', '-', '*'];
        const operation = operations[Math.floor(Math.random() * operations.length)];
        let num1, num2;

        switch(operation) {
            case '+':
                num1 = Math.floor(Math.random() * 50) + 1;
                num2 = Math.floor(Math.random() * 50) + 1;
                this.correctAnswer = num1 + num2;
                break;
            case '-':
                num1 = Math.floor(Math.random() * 50) + 1;
                num2 = Math.floor(Math.random() * num1) + 1;
                this.correctAnswer = num1 - num2;
                break;
            case '*':
                num1 = Math.floor(Math.random() * 12) + 1;
                num2 = Math.floor(Math.random() * 12) + 1;
                this.correctAnswer = num1 * num2;
                break;
        }

        this.problemElement.textContent = `${num1} ${operation} ${num2} = ?`;
        this.answerInput.value = '';
        this.answerInput.focus();
    }

    async checkAnswer() {
        const userAnswer = parseInt(this.answerInput.value);
        
        if (isNaN(userAnswer)) {
            this.showResult('Будь ласка, введіть число', 'incorrect');
            return;
        }

        if (userAnswer === this.correctAnswer) {
            this.score += 10;
            this.scoreElement.textContent = this.score;
            this.showResult('Правильно!', 'correct');
            
            // Розраховуємо час проходження рівня
            const levelTime = this.timeElapsed - this.levelStartTime;
            
            // Перевіряємо, чи рівень вже не завершений
            if (this.completedLevels.includes(this.currentLevel)) {
                this.showResult('Цей рівень вже завершений', 'incorrect');
                return;
            }
            
            // Завершуємо рівень
            try {
                const response = await fetch('/api/complete-level', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify({ 
                        level: this.currentLevel,
                        completionTime: this.formatTime(levelTime)
                    })
                });

                if (response.ok) {
                    this.completedLevels.push(this.currentLevel);
                    this.currentLevel++;
                    this.levelElement.textContent = this.currentLevel;
                    this.levelStartTime = this.timeElapsed;
                    
                    // Перевіряємо, чи є ще рівні
                    if (this.currentLevel > 10) {
                        this.showResult('Вітаємо! Ви завершили всі рівні!', 'correct');
                        this.problemElement.textContent = 'Гра завершена';
                        this.answerInput.style.display = 'none';
                        this.checkButton.style.display = 'none';
                    } else {
                        setTimeout(() => {
                            this.generateProblem();
                            this.showResult('');
                        }, 1500);
                    }
                } else {
                    const errorData = await response.json();
                    this.showResult(errorData.error || 'Помилка при збереженні прогресу', 'incorrect');
                }
            } catch (error) {
                console.error('Помилка:', error);
                this.showResult('Помилка при збереженні прогресу', 'incorrect');
            }
        } else {
            this.showResult('Неправильно! Спробуйте ще раз.', 'incorrect');
        }
    }

    showResult(message, className = '') {
        this.resultElement.textContent = message;
        this.resultElement.className = `result-message ${className}`;
    }

    setupEventListeners() {
        this.checkButton.addEventListener('click', () => this.checkAnswer());
        this.answerInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.checkAnswer();
            }
        });
    }
}

// Запускаємо гру при завантаженні сторінки
document.addEventListener('DOMContentLoaded', () => {
    new MathGame();
}); 