import { Router, type Request, type Response, type NextFunction } from "express";
import multer, { MulterError } from "multer";
import {
  checkIfDocumentExists,
  computeContentHash,
  deleteDocument,
  getPublicUrl,
  listDocuments,
  saveDocument,
  uploadFileToS3,
} from "@vigil/core";
import { injestionQueue } from "@vigil/worker/queue";
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

// POST /api/docs/upload — Upload PDF to S3, save document record, and ingest via documentUrl
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
      const contentHash = computeContentHash(file.buffer);

      // 1. Check for duplicate document before uploading to S3
      const existing = await checkIfDocumentExists(orgId, contentHash);
      if (existing.exists && existing.documentId) {
        res.status(200).json({
          skipped: true,
          documentId: existing.documentId,
          reason: "Document already exists",
        });
        return;
      }

      // 2. Upload PDF to S3 and get public documentUrl
      const storageKey = await uploadFileToS3({
        bucket,
        body: file.buffer,
        fileName: file.originalname,
        mimetype: file.mimetype,
      });
      const documentUrl = getPublicUrl(storageKey);

      // 3. Save pending document record
      const documentId = await saveDocument({
        orgId,
        userId,
        name: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        storageKey,
        contentHash,
      });

      // 4. Enqueue background ingestion job in BullMQ worker
      const job = await injestionQueue.add("ingest-document", {
        documentUrl,
        documentId,
        orgId,
      });

      res.status(202).json({
        skipped: false,
        documentId,
        jobId: job.id,
        status: "pending",
        storageKey,
        documentUrl,
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
    const rows = await listDocuments(orgId);

    const data = rows.map((doc) => ({
      ...doc,
      documentUrl: getPublicUrl(doc.storageKey),
    }));

    res.json({ documents: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch documents";
    res.status(500).json({ error: message });
  }
});

// DELETE /api/docs/:id — Delete a document and its chunks
docsRouter.delete(
  "/:id",
  requireAuth,
  requireRole("admin", "lead"),
  async (req: Request, res: Response) => {
    try {
      const { orgId } = req.auth!;
      const documentId = String(req.params.id ?? "");

      const deleted = await deleteDocument(orgId, documentId);
      if (!deleted) {
        res.status(404).json({ error: "Document not found." });
        return;
      }

      res.json({ deleted });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete document";
      res.status(500).json({ error: message });
    }
  }
);
