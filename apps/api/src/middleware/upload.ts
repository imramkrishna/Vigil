import type { NextFunction, Request, Response } from "express";
import multer, { MulterError } from "multer";

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
});

export function handleUploadMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  upload.single("file")(req, res, (err: unknown) => {
    if (!err) return next();

    if (err instanceof MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        res.status(413).json({ error: "File exceeds the 15MB size limit." });
        return;
      }
      res.status(400).json({ error: `Upload error: ${err.message}` });
      return;
    }

    res.status(400).json({ error: "Invalid file upload request." });
  });
}
