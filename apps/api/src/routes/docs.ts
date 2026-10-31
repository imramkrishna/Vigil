import { Router, type Request, type Response, type NextFunction } from "express";
import multer, { MulterError } from "multer";
import { desc, eq } from "drizzle-orm";
import {
  documents,
  getPublicUrl,
  ingestDocument,
  uploadFileToS3,
  withOrgContext,
} from "@vigil/core";
import { requireAuth, requireRole } from "../middleware/require-auth";

export const docsRouter = Router();

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
});

function handleUploadMiddleware(
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

// POST /api/docs/upload — Upload PDF to S3 and ingest chunks into Postgres
docsRouter.post(
  "/upload",
  requireAuth,
  requireRole("admin", "lead", "responder"),
  handleUploadMiddleware,
  async (req: Request, res: Response) => {
    try {
      const file = req.file;

      if (!file) {
        res.status(400).json({ error: "No file uploaded. Use form field 'file'." });
        return;
      }

      if (file.size === 0 || file.buffer.length === 0) {
        res.status(400).json({ error: "Uploaded file is empty." });
        return;
      }

      if (file.mimetype !== "application/pdf") {
        res.status(400).json({ error: "Only PDF files (application/pdf) are supported." });
        return;
      }

      const bucket = process.env.S3_BUCKET_NAME;
      if (!bucket) {
        res.status(500).json({ error: "S3_BUCKET_NAME is not configured." });
        return;
      }

      const { userId, orgId } = req.auth!;

      const storageKey = await uploadFileToS3({
        bucket,
        body: file.buffer,
        fileName: file.originalname,
        mimetype: file.mimetype,
      });

      const sourceUrl = getPublicUrl(storageKey);

      const result = await ingestDocument({
        body: file.buffer,
        name: file.originalname,
        mimeType: file.mimetype,
        userId,
        orgId,
        storageKey,
        sourceUrl,
      });

      res.status(result.skipped ? 200 : 201).json({
        ...result,
        storageKey,
        sourceUrl,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to upload and ingest document";
      res.status(500).json({ error: message });
    }
  }
);

// GET /api/docs — List all documents for the active organization
docsRouter.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const { orgId } = req.auth!;

    const rows = await withOrgContext(orgId, (tx) =>
      tx
        .select()
        .from(documents)
        .where(eq(documents.orgId, orgId))
        .orderBy(desc(documents.createdAt))
    );

    const data = rows.map((doc) => ({
      ...doc,
      sourceUrl: getPublicUrl(doc.storageKey),
    }));

    res.json({ documents: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch documents";
    res.status(500).json({ error: message });
  }
});
