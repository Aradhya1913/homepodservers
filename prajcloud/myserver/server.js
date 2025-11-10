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
const admin = require('firebase-admin');

const User = require('./models/User');
const File = require('./models/File');

const app = express();

// 🔧 Configuration
const PORT = process.env.PORT || 5001;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
const STORAGE_FOLDER = process.env.STORAGE_FOLDER || path.join(__dirname, 'uploads');
console.log(`📂 Using storage folder: ${STORAGE_FOLDER}`);

// 🧩 Initialize Firebase Admin (for Google Sign-in verification)
const serviceAccount = require('./serviceAccountKey.json'); // must be present in same directory
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// 📦 Ensure storage folder exists
if (!fs.existsSync(STORAGE_FOLDER)) fs.mkdirSync(STORAGE_FOLDER, { recursive: true });

// 🧠 Connect MongoDB
if (!process.env.MONGO_URI) {
  console.error('❌ MONGO_URI is not defined in .env');
  process.exit(1);
}
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB Atlas'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// ⚙️ Middleware setup
app.use(express.static('public'));
app.use(express.json());
app.use(cors({
  origin: [
    "http://localhost:3000",
    "https://homepodsservers.vercel.app"
  ],
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));
app.use('/uploads', express.static(STORAGE_FOLDER));

// 🗂️ Multer storage configuration
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

// 🔐 Token Verification Middleware (supports Firebase & Local JWT)
async function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).send('❌ No token providedf');
  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).send('❌ No token provided');

  try {
    const decodedFirebase = await admin.auth().verifyIdToken(token);
    req.userEmail = decodedFirebase.email;
    console.log("✅ Firebase user verified:", decodedFirebase.email);
    return next();
  } catch (err) {
    console.log("⚠️ Firebase token verification failed:", err.message);
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      console.error("❌ Token verification failed:", err.message);
      return res.status(403).send('❌ Invalid token');
    }
    req.userEmail = decoded.email;
    next();
  });
}

// 🚀 Default route
app.get('/', (req, res) => {
  res.send('🚀 Welcome to Prajwal Cloud Server!');
});

// 👤 Signup
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

// 🔑 Login
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

// 📤 Upload file (store metadata)
app.post('/upload', verifyToken, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).send('❌ No file uploaded');
  try {
    const relativePath = path.relative(STORAGE_FOLDER, req.file.path).replace(/\\/g, '/');
    const mimeType = mime.lookup(req.file.path) || '';
    const fileType = mimeType.startsWith('image')
      ? 'image'
      : mimeType.startsWith('video')
      ? 'video'
      : mimeType.includes('pdf')
      ? 'pdf'
      : mimeType.includes('word') || mimeType.includes('officedocument')
      ? 'doc'
      : 'other';

    const folderPath = req.body.folderPath || '';

    const fileDoc = new File({
      filename: relativePath,
      size: req.file.size,
      userEmail: req.userEmail,
      fileType,
      folderPath,
      uploadedAt: new Date(),
      fullPathUrl: `/uploads/${relativePath}`,
    });

    await fileDoc.save();
    res.send('✅ File uploaded and metadata saved!');
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).send('❌ Upload failed');
  }
});
// 📁 List files/folders (auto-sync with MongoDB)
app.get('/files', verifyToken, async (req, res) => {
  try {
    const folder = req.query.folder || '';
    const targetDir = path.join(STORAGE_FOLDER, folder);
    if (!fs.existsSync(targetDir)) return res.json([]);

    const entries = fs.readdirSync(targetDir, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name.toLowerCase() === 'thumbs.db') continue;

      const fullPath = path.join(targetDir, entry.name);
      const stat = fs.statSync(fullPath);
      const isFolder = entry.isDirectory();
      const size = isFolder ? 0 : stat.size;
      const time = new Date(stat.mtime).toLocaleString();

      const relativePath = folder ? `${folder}/${entry.name}` : entry.name;

      // ✅ Auto-insert missing files into MongoDB
      let existing = await File.findOne({ userEmail: req.userEmail, filename: relativePath });
      if (!existing) {
        const mimeType = mime.lookup(fullPath) || '';
        const fileType = mimeType.startsWith('image')
          ? 'image'
          : mimeType.startsWith('video')
          ? 'video'
          : mimeType.includes('pdf')
          ? 'pdf'
          : mimeType.includes('word') || mimeType.includes('officedocument')
          ? 'doc'
          : isFolder
          ? 'folder'
          : 'other';

        await File.create({
          filename: relativePath,
          size,
          userEmail: req.userEmail,
          isFolder,
          folderPath: folder,
          fileType,
          uploadedAt: new Date(),
          fullPathUrl: `/uploads/${relativePath}`,
        });
      }

      files.push({
        name: entry.name,
        isFolder,
        size: (size / 1024).toFixed(2),
        time,
      });
    }

    res.json(files);
  } catch (err) {
    console.error('List files error:', err);
    res.status(500).send('❌ Failed to load files');
  }
});

// 📥 Download file
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

// ✏️ Rename file/folder
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

// 🗑️ Delete file
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
// ======= Recursive Folder Analytics =======
app.get('/analytics', verifyToken, async (req, res) => {
  try {
    const userEmail = req.userEmail;
    const folder = (req.query.folder || '').replace(/\\/g, '/');
    const folderRegex = new RegExp(`^${folder}`);

    const files = await File.find({ userEmail, folderPath: folderRegex });

    if (!files.length) {
      return res.json({ summary: `No files found in folder: "${folder || 'root'}".` });
    }

    const stats = {
      totalFiles: files.filter(f => !f.isFolder).length,
      totalFolders: files.filter(f => f.isFolder).length,
      totalSize: files.reduce((sum, f) => sum + (f.size || 0), 0),
      imageCount: files.filter(f => f.fileType === 'image').length,
      videoCount: files.filter(f => f.fileType === 'video').length,
      pdfCount: files.filter(f => f.fileType === 'pdf').length,
      docCount: files.filter(f => f.fileType === 'doc').length,
      otherCount: files.filter(f => f.fileType === 'other').length,
    };

    const summary = `
📁 Folder: ${folder || 'Root'}
📦 Total Files: ${stats.totalFiles}
🗂️ Folders: ${stats.totalFolders}
💾 Total Size: ${(stats.totalSize / (1024 * 1024)).toFixed(2)} MB
🖼️ Images: ${stats.imageCount}
🎬 Videos: ${stats.videoCount}
📄 PDFs: ${stats.pdfCount}
📝 Docs: ${stats.docCount}
📁 Others: ${stats.otherCount}
    `.trim();

    // ✅ Optional AI summary
    let aiMessage = '';
    try {
      const aiPrompt = `
      Analyze these file stats and generate a short, friendly summary:
      ${JSON.stringify(stats, null, 2)}
      `;

      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: aiPrompt }],
      });

      aiMessage = response.choices[0].message.content;
    } catch (err) {
      console.warn('AI summary failed:', err.message);
    }

    // ✅ Send only once
    res.json({ summary, stats, aiMessage });
  } catch (err) {
    console.error('Error generating analytics:', err);
    res.status(500).json({ error: 'Failed to generate analytics.' });
  }
});
// 📊 Dynamic AI Insights endpoint for dashboard auto-update
app.get('/api/ai-insights', async (req, res) => {
  try {
    // Temporary mock (replace with real DB later)
    const stats = {
      totalFiles: 21,
      totalFolders: 3,
      totalSize: "161.03 MB",
      images: 8,
      pdfs: 6,
      videos: 0,
      docs: 6,
      others: 1,
    };

    res.json(stats);
  } catch (err) {
    console.error("AI Insights Error:", err);
    res.status(500).json({ error: "Failed to fetch AI Insights" });
  }
}); 
// 🚀 Start server
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});