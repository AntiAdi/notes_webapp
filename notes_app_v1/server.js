// Required modules
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const port = 3000;

// Database Setup
const db = new sqlite3.Database('./db.sqlite');

// Create users table if not exists
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT
    )`);

    // Create notes table if not exists
    db.run(`CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        content TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);
});

// Middleware setup
app.use(express.static('public'));  // Serve static files from the "public" directory
app.use(bodyParser.urlencoded({ extended: false })); // Parse URL-encoded bodies
app.use(bodyParser.json());  // Parse JSON bodies

// Session configuration
app.use(session({
    secret: 'secret',  // Secret used for signing the session ID cookie
    resave: false,  // Do not save the session if it is not modified
    saveUninitialized: false  // Do not save a session that is new but not modified
}));

// Routes

// Signup Route (POST)
app.post('/signup', (req, res) => {
    const { username, password } = req.body;

    // Check for missing fields
    if (!username || !password) return res.status(400).json({ error: "Missing fields" });

    // Check if user already exists
    db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
        if (err) return res.status(500).json({ error: "Database error" });

        // If user exists, return error
        if (user) return res.status(400).json({ error: "Username already exists" });

        // Insert new user into the database
        db.run("INSERT INTO users (username, password) VALUES (?, ?)", [username, password], function (err) {
            if (err) return res.status(500).json({ error: "Failed to create user" });

            req.session.userId = this.lastID;  // Set the user ID in session
            res.json({ success: true });  // Return success response
        });
    });
});

// Login Route (POST)
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    // Check for missing fields
    if (!username || !password) return res.status(400).json({ error: "Missing fields" });

    // Check if the user exists
    db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
        if (err) return res.status(500).json({ error: "Database error" });

        // If user does not exist, return error
        if (!user) return res.status(401).json({ error: "User not found" });

        // Validate password
        if (user.password !== password) return res.status(401).json({ error: "Incorrect password" });

        // Store user ID in session and return success
        req.session.userId = user.id;
        res.json({ success: true });
    });
});

// Logout Route (GET)
app.get('/logout', (req, res) => {
    req.session.destroy();  // Destroy session on logout
    res.redirect('/');  // Redirect to homepage
});

// Fetch notes for the logged-in user
app.get('/notes', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });

    const sql = 'SELECT * FROM notes WHERE user_id = ?';
    const params = [req.session.userId];

    // Fetch the notes from the database
    db.all(sql, params, (err, rows) => {
        if (err) {
            console.error('DB error:', err.message);
            return res.status(500).json({ error: 'DB failure' });
        }
        res.json(rows);  // Return the notes as JSON
    });
});

// Add a new note
app.post('/add-note', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });

    const { content } = req.body;

    // Check for empty note content
    if (!content || content.trim() === "") {
        return res.status(400).json({ error: 'Why Not Write Something ?' });
    }

    const timestamp = new Date().toISOString();  // Set the timestamp of the note

    // Insert new note into the database
    db.run('INSERT INTO notes (user_id, content, created_at) VALUES (?, ?, ?)', [req.session.userId, content, timestamp], err => {
        if (err) return res.status(500).json({ error: 'Failed to add note' });
        res.redirect('/dashboard.html');  // Redirect after adding note
    });
});

// Start the server on the specified port
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});