const multer = require("multer");

// Configure storage for PDF files in memory
const storage = multer.memoryStorage();

// File filter to only allow PDF files
const fileFilter = (req, file, cb) => {
  if (file.mimetype === "application/pdf") {
    cb(null, true);
  } else {
    cb(new Error("Not a PDF file! Please upload a PDF."), false);
  }
};

const uploadPdf = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit for PDFs
  },
  fileFilter: fileFilter,
});

module.exports = uploadPdf;
