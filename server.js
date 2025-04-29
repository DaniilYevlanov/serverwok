const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const exphbs = require('express-handlebars');
const cookieParser = require('cookie-parser');
const fs = require('fs');
require('dotenv').config();

const app = express();

// Налаштування Handlebars
app.engine('hbs', exphbs.engine({
    defaultLayout: 'main',
    extname: '.hbs'
}));
app.set('view engine', 'hbs');

// Middleware
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Функції для роботи з файлом користувачів
const USERS_FILE = path.join(__dirname, 'data', 'users.json');

const readUsers = () => {
    try {
        const data = fs.readFileSync(USERS_FILE, 'utf8');
        return JSON.parse(data).users;
    } catch (error) {
        return [];
    }
};

const writeUsers = (users) => {
    try {
        fs.writeFileSync(USERS_FILE, JSON.stringify({ users }, null, 2));
        return true;
    } catch (error) {
        console.error('Помилка збереження даних:', error);
        return false;
    }
};

// Структура рівнів
const defaultLevels = Array.from({ length: 10 }, (_, i) => ({
    level: i + 1,
    completed: false,
    completionTime: null
}));

// Секретний ключ для JWT
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Middleware для перевірки токена
const authenticateToken = (req, res, next) => {
    const token = req.cookies.token;

    if (!token) {
        return res.redirect('/login');
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.redirect('/login');
        }
        req.user = user;
        next();
    });
};

// Головна сторінка
app.get('/', (req, res) => {
    res.render('index', {
        title: 'Система Авторизації'
    });
});

// Сторінка реєстрації
app.get('/register', (req, res) => {
    res.render('register', {
        title: 'Реєстрація'
    });
});

// Сторінка входу
app.get('/login', (req, res) => {
    res.render('login', {
        title: 'Вхід'
    });
});

// API endpoints
app.post('/api/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        const users = readUsers();

        if (users.find(user => user.username === username)) {
            return res.status(400).json({ message: 'Користувач вже існує' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = {
            username,
            password: hashedPassword,
            registrationDate: new Date().toLocaleDateString('uk-UA'),
            levels: [...defaultLevels]
        };

        users.push(user);
        writeUsers(users);

        res.redirect('/login');
    } catch (error) {
        res.status(500).json({ message: 'Помилка сервера' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const users = readUsers();
        const user = users.find(user => user.username === username);

        if (!user) {
            return res.status(400).json({ message: 'Користувач не знайдений' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(400).json({ message: 'Невірний пароль' });
        }

        const token = jwt.sign({ username: user.username }, JWT_SECRET);
        res.cookie('token', token, { httpOnly: true });
        res.redirect('/profile');
    } catch (error) {
        res.status(500).json({ message: 'Помилка сервера' });
    }
});

app.get('/profile', authenticateToken, (req, res) => {
    const users = readUsers();
    const user = users.find(u => u.username === req.user.username);
    if (!user) {
        return res.redirect('/login');
    }
    res.render('profile', {
        title: 'Профіль',
        user: {
            username: user.username,
            registrationDate: user.registrationDate,
            levels: user.levels
        }
    });
});

app.post('/api/complete-level', authenticateToken, async (req, res) => {
    try {
        const { level, completionTime } = req.body;
        const users = readUsers();
        const userIndex = users.findIndex(u => u.username === req.user.username);

        if (userIndex === -1) {
            return res.status(404).json({ error: 'Користувач не знайдений' });
        }

        // Перевірка на валідність рівня
        if (!level || level < 1 || level > 10) {
            return res.status(400).json({ error: 'Невірний номер рівня' });
        }

        const levelIndex = users[userIndex].levels.findIndex(l => l.level === level);
        if (levelIndex === -1) {
            return res.status(404).json({ error: 'Рівень не знайдений' });
        }

        // Перевірка чи рівень вже завершений
        if (users[userIndex].levels[levelIndex].completed) {
            return res.status(400).json({ error: 'Рівень вже завершений' });
        }

        // Оновлюємо дані рівня
        users[userIndex].levels[levelIndex].completed = true;
        users[userIndex].levels[levelIndex].completionDate = new Date().toISOString();
        users[userIndex].levels[levelIndex].completionTime = completionTime;

        // Зберігаємо зміни
        if (writeUsers(users)) {
            res.json({ 
                success: true,
                message: 'Рівень успішно завершений',
                completionDate: users[userIndex].levels[levelIndex].completionDate,
                completionTime: completionTime
            });
        } else {
            res.status(500).json({ error: 'Помилка збереження даних' });
        }
    } catch (error) {
        console.error('Помилка при завершенні рівня:', error);
        res.status(500).json({ error: 'Внутрішня помилка сервера' });
    }
});

app.post('/api/reset-levels', authenticateToken, (req, res) => {
    const users = readUsers();
    const userIndex = users.findIndex(u => u.username === req.user.username);

    if (userIndex === -1) {
        return res.status(404).json({ error: 'Користувач не знайдений' });
    }

    // Скидаємо всі рівні
    users[userIndex].levels = users[userIndex].levels.map(level => ({
        ...level,
        completed: false,
        completionDate: null,
        completionTime: null
    }));

    if (writeUsers(users)) {
        res.json({ success: true });
    } else {
        res.status(500).json({ error: 'Помилка збереження даних' });
    }
});

app.get('/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect('/');
});

app.get('/game', authenticateToken, (req, res) => {
    res.render('game', {
        title: 'Математична гра'
    });
});

app.get('/api/user-levels', authenticateToken, (req, res) => {
    try {
        const users = readUsers();
        const user = users.find(u => u.username === req.user.username);

        if (!user) {
            return res.status(404).json({ error: 'Користувач не знайдений' });
        }

        res.json({
            success: true,
            levels: user.levels
        });
    } catch (error) {
        console.error('Помилка при отриманні рівнів:', error);
        res.status(500).json({ error: 'Внутрішня помилка сервера' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Сервер запущено на порту ${PORT}`);
}); 