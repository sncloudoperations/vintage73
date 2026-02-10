const multer = require('multer');
const path = require('path');
const fs = require('fs');

// UPLOAD PATH: Use env variable or fallback to default
const uploadDir = process.env.UPLOADS_PATH || path.join(__dirname, '../../frontend/public/uploads');

// Ensure upload directory exists (robust check)
try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log(`[UPLOAD] Created upload directory at: ${uploadDir}`);
  }
} catch (err) {
  console.error(`[UPLOAD_ERROR] Failed to create upload directory: ${err.message}`);
}

// Configure Storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Unique filename: file-<timestamp>-<random>.ext
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'file-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File Filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp|gif|svg/;
  const isExtensionValid = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const isMimetypeValid = allowedTypes.test(file.mimetype);

  if (isExtensionValid && isMimetypeValid) {
    return cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images (jpeg, jpg, png, webp, gif, svg) are allowed.'));
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // Increased to 10MB for production flexibility
    files: 5 // Limit number of files per request
  },
  fileFilter: fileFilter
});

module.exports = upload;
