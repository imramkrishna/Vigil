import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { S3 } from "./s3.config";

function generateKey(fileName: string): string {
  const timestamp = new Date()
    .toISOString()
    .replace("T", "-")
    .replace(/:/g, "-")
    .split(".")[0];
  return `${fileName}-${Math.floor(Math.random() * 1000)}-${timestamp}`;
}

export function getPublicUrl(key: string): string {
  const baseUrl = (process.env.S3_PUBLIC_DEPLOYMENT_URL ?? "").replace(
    /\/+$/,
    ""
  );
  return `${baseUrl}/${encodeURIComponent(key)}`;
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
