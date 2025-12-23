const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();

// Разрешаем запросы с любого источника (CORS)
app.use(cors({ origin: '*' }));
app.use(bodyParser.json());

// === ПОДКЛЮЧЕНИЕ К БАЗЕ ДАННЫХ ===
// Переменные берутся из настроек Render (Environment Variables)
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    ssl: { rejectUnauthorized: false } // Обязательно для Aiven/Cloud БД
});

db.connect(err => {
    if (err) {
        console.error('Ошибка подключения к БД:', err);
    } else {
        console.log('MySQL успешно подключен!');
        initTables();
    }
});

// === СОЗДАНИЕ ТАБЛИЦ (Если их нет) ===
function initTables() {
    const queries = [
        `CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(255) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            fullName VARCHAR(255) NOT NULL
        )`,
        `CREATE TABLE IF NOT EXISTS tasks (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT,
            text VARCHAR(255),
            is_done BOOLEAN DEFAULT FALSE
        )`,
        `CREATE TABLE IF NOT EXISTS chat (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(255),
            message TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS homework (
            id INT AUTO_INCREMENT PRIMARY KEY,
            subject VARCHAR(255),
            task TEXT,
            deadline DATE
        )`,
        `CREATE TABLE IF NOT EXISTS news (
            id INT AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(255),
            content TEXT
        )`,
        `CREATE TABLE IF NOT EXISTS events (
            id INT AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(255),
            event_date DATETIME,
            location VARCHAR(255)
        )`,
        `CREATE TABLE IF NOT EXISTS feedback (
            id INT AUTO_INCREMENT PRIMARY KEY,
            category VARCHAR(50),
            subject VARCHAR(255),
            message TEXT
        )`
    ];

    queries.forEach(sql => {
        db.query(sql, err => {
            if (err) console.error("Ошибка инициализации таблицы:", err);
        });
    });
    console.log('Таблицы проверены/созданы.');
}

// ================= МАРШРУТЫ API =================

// 1. РЕГИСТРАЦИЯ И ВХОД
app.post('/register', (req, res) => {
    const { username, password, fullName } = req.body;
    if (!username || !password || !fullName) return res.status(400).json({message: 'Все поля обязательны'});
    
    const sql = 'INSERT INTO users (username, password, fullName) VALUES (?, ?, ?)';
    db.query(sql, [username, password, fullName], (err) => {
        if (err) return res.status(500).json({ message: 'Ошибка регистрации (логин занят?)' });
        res.status(201).json({ message: 'Пользователь создан' });
    });
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const sql = 'SELECT * FROM users WHERE username = ? AND password = ?';
    db.query(sql, [username, password], (err, results) => {
        if (err || results.length === 0) return res.status(401).json({ message: 'Неверный логин или пароль' });
        res.json(results[0]);
    });
});

// 2. СПИСОК УЧАСТНИКОВ (Для вкладки "Участники")
app.get('/api/users', (req, res) => {
    // Возвращаем только имена и логины, без паролей
    const sql = 'SELECT id, fullName, username FROM users ORDER BY fullName ASC';
    db.query(sql, (err, data) => {
        if (err) return res.status(500).json({ error: 'Ошибка сервера' });
        res.json(data);
    });
});

// 3. ЛИЧНЫЕ ЗАДАЧИ
app.get('/api/tasks', (req, res) => {
    const userId = req.query.userId;
    db.query('SELECT * FROM tasks WHERE user_id = ? ORDER BY id DESC', [userId], (err, data) => res.json(data || []));
});

app.post('/api/tasks', (req, res) => {
    const { userId, text } = req.body;
    db.query('INSERT INTO tasks (user_id, text) VALUES (?, ?)', [userId, text], (err, result) => {
        if(err) return res.status(500).json({error: err});
        res.json({ id: result.insertId, text, is_done: 0 });
    });
});

app.put('/api/tasks/:id', (req, res) => {
    db.query('UPDATE tasks SET is_done = NOT is_done WHERE id = ?', [req.params.id], () => res.json({status: 'updated'}));
});

app.delete('/api/tasks/:id', (req, res) => {
    db.query('DELETE FROM tasks WHERE id = ?', [req.params.id], () => res.json({status: 'deleted'}));
});

// 4. ЧАТ
app.get('/api/chat', (req, res) => {
    // Берем последние 50 сообщений, сортируем по времени
    db.query('SELECT * FROM chat ORDER BY created_at ASC LIMIT 50', (err, data) => res.json(data || []));
});

app.post('/api/chat', (req, res) => {
    const { username, message } = req.body;
    db.query('INSERT INTO chat (username, message) VALUES (?, ?)', [username, message], () => res.json({status: 'ok'}));
});

// 5. ОБЩИЕ СПИСКИ (Домашка, Новости и т.д.)
// Универсальный GET
const createGet = (route, table) => {
    app.get(route, (req, res) => {
        db.query(`SELECT * FROM ${table} ORDER BY id DESC LIMIT 20`, (err, data) => res.json(data || []));
    });
};

createGet('/api/homework', 'homework');
createGet('/api/news', 'news');
createGet('/api/events', 'events');
createGet('/api/feedback', 'feedback');

// POST запросы
app.post('/api/homework', (req, res) => {
    const { subject, task, deadline } = req.body;
    db.query('INSERT INTO homework (subject, task, deadline) VALUES (?, ?, ?)', [subject, task, deadline], () => res.json({status:'ok'}));
});

app.post('/api/news', (req, res) => {
    const { title, content } = req.body;
    db.query('INSERT INTO news (title, content) VALUES (?, ?)', [title, content], () => res.json({status:'ok'}));
});

app.post('/api/events', (req, res) => {
    const { title, event_date, location } = req.body;
    db.query('INSERT INTO events (title, event_date, location) VALUES (?, ?, ?)', [title, event_date, location], () => res.json({status:'ok'}));
});

app.post('/api/feedback', (req, res) => {
    const { category, subject, message } = req.body;
    db.query('INSERT INTO feedback (category, subject, message) VALUES (?, ?, ?)', [category, subject, message], () => res.json({status:'ok'}));
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));