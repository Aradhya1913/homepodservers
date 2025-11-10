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
  },
  fileType: {
    type: String,
    default: 'unknown' // could be image, video, pdf, etc.
  },
  folderPath: {
    type: String,
    default: '' // stores the logical or actual folder path for the file
  },
  uploadedAt: {
    type: Date,
    default: Date.now // timestamp when file is uploaded
  },
  fullPathUrl: {
    type: String,
    default: '' // URL reference to file if accessible from storage
  }
});

module.exports = mongoose.model('File', fileSchema);