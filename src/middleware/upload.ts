import multer from "multer";

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "video/mp4",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];

export const upload = multer({
  storage: multer.memoryStorage(), // 👈 key change
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "File type not allowed. Allowed types: PDF, TXT, DOC, DOCX, JPG, PNG, MP4"
        )
      );
    }
  },
});