async function completeLevel(levelId) {
    try {
        const response = await fetch('/api/complete-level', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ level: levelId })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Помилка при завершенні рівня');
        }

        const result = await response.json();
        if (result.success) {
            // Оновлюємо інтерфейс
            const levelElement = document.querySelector(`[data-level="${levelId}"]`);
            if (levelElement) {
                levelElement.classList.add('completed');
                const dateElement = levelElement.querySelector('.completion-date');
                if (dateElement) {
                    dateElement.textContent = new Date().toLocaleDateString('uk-UA');
                }
            }
        }
    } catch (error) {
        console.error('Помилка:', error);
        alert(error.message);
    }
}

// Додаємо обробники подій для кнопок завершення рівня
document.addEventListener('DOMContentLoaded', () => {
    const completeButtons = document.querySelectorAll('.complete-level');
    completeButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const levelId = e.target.dataset.level;
            if (levelId) {
                completeLevel(levelId);
            }
        });
    });
}); 