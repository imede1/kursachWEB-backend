const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();

// Настройка CORS (чтобы GitHub Pages мог стучаться сюда)
app.use(cors({
    origin: '*', // В идеале тут будет ссылка на твой сайт, но пока '*' (всем можно)
}));
app.use(bodyParser.json());

// ПОДКЛЮЧЕНИЕ К БД (Теперь читаем настройки из окружения)
const db = mysql.createConnection({
    host: process.env.DB_HOST,       // Адрес
    user: process.env.DB_USER,       // Логин
    password: process.env.DB_PASSWORD, // Пароль
    database: process.env.DB_NAME,   // Имя БД
    port: process.env.DB_PORT,       // Порт
    ssl: { rejectUnauthorized: false } // Важно для Aiven!
});

db.connect(err => {
    if (err) {
        console.error('Ошибка подключения к БД:', err);
    } else {
        console.log('MySQL (Aiven) успешно подключен!');
    }
});

// ... (Дальше твои маршруты /api/login, /api/tasks и т.д. без изменений)

// Слушаем порт, который выдаст Render, или 3000 локально
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});