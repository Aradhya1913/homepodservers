// models/File.js

const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    default: 0 // for folders
  },
  time: {
    type: Date,
    default: Date.now
  },
  userEmail: {
    type: String,
    required: true
  },
  isFolder: {
    type: Boolean,
    default: false
  },
  parentFolder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'File',
    default: null // root-level if null
  }
});

module.exports = mongoose.model('File', fileSchema);