const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();

// Разрешаем все запросы (GET, POST, PUT, DELETE)
app.use(cors({ origin: '*' }));
app.use(bodyParser.json());

// Подключение к БД (данные берутся из Render Environment Variables)
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    ssl: { rejectUnauthorized: false }
});

db.connect(err => {
    if (err) console.error('Ошибка БД:', err);
    else {
        console.log('MySQL подключен!');
        initTables();
    }
});

// === СОЗДАНИЕ ТАБЛИЦ ===
function initTables() {
    const tables = [
        `CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(255) UNIQUE,
            password VARCHAR(255),
            fullName VARCHAR(255)
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

    tables.forEach(sql => db.query(sql));
    console.log('Таблицы инициализированы.');
}

// === АВТОРИЗАЦИЯ ===
app.post('/register', (req, res) => {
    const { username, password, fullName } = req.body;
    db.query('INSERT INTO users (username, password, fullName) VALUES (?, ?, ?)', 
        [username, password, fullName], 
        (err) => err ? res.status(500).json({error: err}) : res.json({message: 'OK'})
    );
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    db.query('SELECT * FROM users WHERE username = ? AND password = ?', [username, password], (err, result) => {
        if (err || result.length === 0) return res.status(401).json({message: 'Ошибка входа'});
        res.json(result[0]);
    });
});

// === ЗАДАЧИ (Личные) ===
app.get('/api/tasks', (req, res) => {
    const userId = req.query.userId;
    db.query('SELECT * FROM tasks WHERE user_id = ? ORDER BY id DESC', [userId], (err, data) => res.json(data || []));
});

app.post('/api/tasks', (req, res) => {
    const { userId, text } = req.body;
    db.query('INSERT INTO tasks (user_id, text) VALUES (?, ?)', [userId, text], (err, result) => {
        res.json({ id: result.insertId, text, is_done: 0 });
    });
});

app.put('/api/tasks/:id', (req, res) => {
    // Переключение статуса (сделано/не сделано)
    db.query('UPDATE tasks SET is_done = NOT is_done WHERE id = ?', [req.params.id], () => res.json({status: 'ok'}));
});

app.delete('/api/tasks/:id', (req, res) => {
    db.query('DELETE FROM tasks WHERE id = ?', [req.params.id], () => res.json({status: 'ok'}));
});

// === ЧАТ (Общий) ===
app.get('/api/chat', (req, res) => {
    // Берем последние 50 сообщений
    db.query('SELECT * FROM chat ORDER BY created_at ASC LIMIT 50', (err, data) => res.json(data || []));
});

app.post('/api/chat', (req, res) => {
    const { username, message } = req.body;
    db.query('INSERT INTO chat (username, message) VALUES (?, ?)', [username, message], () => res.json({status: 'ok'}));
});

// === ОБЩИЕ СПИСКИ (Домашка, Новости, События, Вопросы) ===
// Универсальная функция для GET запросов
const createGetRoute = (path, table) => {
    app.get(path, (req, res) => {
        db.query(`SELECT * FROM ${table} ORDER BY id DESC LIMIT 20`, (err, data) => res.json(data || []));
    });
};

createGetRoute('/api/homework', 'homework');
createGetRoute('/api/news', 'news');
createGetRoute('/api/events', 'events');
createGetRoute('/api/feedback', 'feedback');

// Обработка POST запросов для списков
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));