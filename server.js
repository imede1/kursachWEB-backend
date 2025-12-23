const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();

// Настройки CORS
app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST']
}));
app.use(bodyParser.json());

// Подключение к БД через переменные окружения (их введем на хостинге)
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    ssl: { rejectUnauthorized: false } // Нужно для облачных БД
});

db.connect(err => {
    if (err) {
        console.error('Ошибка подключения к БД:', err);
    } else {
        console.log('Успешное подключение к MySQL!');
        
        // Создаем таблицу пользователей автоматически, если её нет
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(255) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                fullName VARCHAR(255) NOT NULL
            )
        `;
        db.query(createTableQuery, (err) => {
            if(err) console.error("Ошибка создания таблицы", err);
            else console.log("Таблица users проверена/создана.");
        });
    }
});

// === МАРШРУТЫ ===

// 1. Регистрация
app.post('/register', (req, res) => {
    const { username, password, fullName } = req.body;
    
    if(!username || !password || !fullName) {
        return res.status(400).json({ message: 'Заполните все поля' });
    }

    const sql = 'INSERT INTO users (username, password, fullName) VALUES (?, ?, ?)';
    db.query(sql, [username, password, fullName], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: 'Ошибка регистрации (возможно логин занят)' });
        }
        res.status(201).json({ message: 'Пользователь создан' });
    });
});

// 2. Вход
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    const sql = 'SELECT * FROM users WHERE username = ? AND password = ?';
    db.query(sql, [username, password], (err, results) => {
        if (err) {
            return res.status(500).json({ message: 'Ошибка сервера' });
        }
        if (results.length > 0) {
            // Пользователь найден
            const user = results[0];
            res.json({
                id: user.id,
                username: user.username,
                fullName: user.fullName
            });
        } else {
            res.status(401).json({ message: 'Неверный логин или пароль' });
        }
    });
});

// Тестовый маршрут, чтобы проверить, работает ли сервер
app.get('/', (req, res) => {
    res.send('Backend is working!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});