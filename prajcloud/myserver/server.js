require('dotenv').config({ path: '../.env' });
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mime = require('mime-types');
const jwt = require('jsonwebtoken');

const User = require('./models/User');
const File = require('./models/File');

const app = express();

const PORT = process.env.PORT || 5001;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
const STORAGE_FOLDER = process.env.STORAGE_FOLDER || path.join(__dirname, 'uploads');
console.log(`📂 Using storage folder: ${STORAGE_FOLDER}`);

if (!fs.existsSync(STORAGE_FOLDER)) fs.mkdirSync(STORAGE_FOLDER);

if (!process.env.MONGO_URI) {
  console.error('❌ MONGO_URI is not defined in .env');
  process.exit(1);
}

app.use(express.static('public'));
app.use(cors({
  origin: [
    "http://localhost:3000",
    "https://homepodsservers.vercel.app"
  ],
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));app.use(express.json());
app.use('/uploads', express.static(STORAGE_FOLDER));

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB Atlas'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = req.body.folderPath || '';
    const dir = path.join(STORAGE_FOLDER, folder);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
});
const upload = multer({ storage });

function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).send('❌ No token provided');
  const token = authHeader.split(' ')[1];

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).send('❌ Invalid token');
    req.userEmail = decoded.email;
    next();
  });
}

app.post('/rename', verifyToken, (req, res) => {
  const { oldPath, newPath } = req.body;
  const fullOldPath = path.join(STORAGE_FOLDER, oldPath);
  const fullNewPath = path.join(STORAGE_FOLDER, newPath);

  if (!fs.existsSync(fullOldPath)) return res.status(404).send('❌ File not found');
  try {
    fs.renameSync(fullOldPath, fullNewPath);
    res.send('✅ File renamed successfully');
  } catch (err) {
    console.error('Rename error:', err);
    res.status(500).send('❌ Rename failed');
  }
});

app.get('/', (req, res) => {
  res.send('🚀 Welcome to Prajwal Cloud Server!');
});

app.post('/signup', async (req, res) => {
  const { username, email, password } = req.body;
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).send('❌ Email already registered');
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, email, password: hashedPassword });
    await newUser.save();
    res.status(201).send('🟢 User created successfully!');
  } catch (err) {
    console.error(err);
    res.status(500).send('❌ Signup failed');
  }
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: '❌ User not found' });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: '❌ Incorrect password' });
    const token = jwt.sign({ email: user.email }, JWT_SECRET, { expiresIn: '2h' });
    res.status(200).json({ message: '✅ Login successful', token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '❌ Login failed' });
  }
});

app.post('/upload', verifyToken, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).send('❌ No file uploaded');
  try {
    const relativePath = path.relative(STORAGE_FOLDER, req.file.path);
    const fileDoc = new File({
      filename: relativePath.replace(/\\/g, '/'),
      size: req.file.size,
      userEmail: req.userEmail
    });
    await fileDoc.save();
    res.send('✅ File uploaded successfully!');
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).send('❌ Upload failed');
  }
});

app.get('/files', verifyToken, async (req, res) => {
  try {
    const folder = req.query.folder || '';
    const targetDir = path.join(STORAGE_FOLDER, folder);
    if (!fs.existsSync(targetDir)) return res.json([]);

    const entries = fs.readdirSync(targetDir, { withFileTypes: true });
    const files = entries
      .filter(entry => {
        const hidden = entry.name.startsWith('.') || entry.name.toLowerCase() === 'thumbs.db';
        return !hidden && entry.name.toLowerCase() !== '.ds_store';
      })
      .map(entry => {
        const fullPath = path.join(targetDir, entry.name);
        const stat = fs.statSync(fullPath);
        return {
          name: entry.name,
          isFolder: entry.isDirectory(),
          size: entry.isDirectory() ? 0 : (stat.size / 1024).toFixed(2),
          time: new Date(stat.mtime).toLocaleString()
        }
      });

    res.json(files);
  } catch (err) {
    console.error('List files error:', err);
    res.status(500).send('❌ Failed to load files');
  }
});

app.get('/download/*', verifyToken, (req, res) => {
  const relativePath = req.params[0];
  const filePath = path.join(STORAGE_FOLDER, relativePath);
  try {
    if (!fs.existsSync(filePath)) return res.status(404).send('❌ File not found');
    const mimetype = mime.contentType(filePath);
    res.setHeader('Content-disposition', 'attachment; filename=' + path.basename(filePath));
    res.setHeader('Content-type', mimetype);
    res.download(filePath);
  } catch (err) {
    console.error('Download error:', err);
    res.status(500).send('❌ Download failed');
  }
});
app.post('/rename', verifyToken, async (req, res) => {
  const { oldPath, newPath } = req.body;
  const fromPath = path.join(STORAGE_FOLDER, oldPath);
  const toPath = path.join(STORAGE_FOLDER, newPath);

  try {
    if (!fs.existsSync(fromPath)) return res.status(404).send('❌ File not found');
    fs.renameSync(fromPath, toPath);
    await File.updateOne({ filename: oldPath }, { filename: newPath });
    res.send('✅ Renamed successfully!');
  } catch (err) {
    console.error('Rename error:', err);
    res.status(500).send('❌ Rename failed');
  }
});
app.delete('/delete/*', verifyToken, async (req, res) => {
  const relativePath = req.params[0];
  const filePath = path.join(STORAGE_FOLDER, relativePath);
  try {
    if (!fs.existsSync(filePath)) return res.status(404).send('❌ File not found');
    fs.unlinkSync(filePath);
    await File.deleteOne({ filename: relativePath });
    res.send('🗑️ File deleted successfully!');
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).send('❌ Failed to delete file');
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
