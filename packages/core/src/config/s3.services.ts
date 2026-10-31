import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { S3 } from "./s3.config.js";
import { db, documents } from "../db/index.js";

function generateKey(fileName: string): string {
  const timestamp = new Date()
    .toISOString()
    .replace("T", "-")
    .replace(/:/g, "-")
    .split(".")[0];
  return `${fileName}-${Math.floor(Math.random() * 1000)}-${timestamp}`;
}

export async function saveDocument(params: {
  name: string;
  userId: string;
  orgId?: string;
  mimeType: string;
  size: number;
  storageKey: string;
  contentHash?: string;
}) {
  const { name, userId, orgId, mimeType, size, storageKey, contentHash } =
    params;
  const inserted = await db
    .insert(documents)
    .values({
      name,
      userId,
      orgId: orgId ?? null,
      mimeType,
      size,
      storageKey,
      contentHash: contentHash ?? null,
    })
    .returning({ id: documents.id });
  console.log("Saved Document to the database : ", name, storageKey);
  return inserted[0]?.id;
}

export async function uploadFileToS3(params: {
  bucket: string;
  body: Buffer | string | Uint8Array;
  fileName: string;
  mimetype?: string;
}): Promise<string> {
  const { bucket, body, mimetype, fileName } = params;
  const key = generateKey(fileName);
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: mimetype,
  });
  await S3.send(command);
  return key;
}

export async function getFileTextFromS3(params: {
  bucket: string;
  key: string;
}): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: params.bucket,
    Key: params.key,
  });
  const response = await S3.send(command);
  if (!response.Body) {
    throw new Error(`Empty S3 body for key: ${params.key}`);
  }
  return response.Body.transformToString("utf-8");
}
