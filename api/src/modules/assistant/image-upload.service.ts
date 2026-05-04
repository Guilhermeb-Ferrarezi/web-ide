import crypto from 'node:crypto';
import path from 'node:path';
import { config } from '../../config.ts';

type UploadImageResult = {
  key: string;
  url: string;
  mimeType: string;
  size: number;
};

export class ImageUploadNotConfiguredError extends Error {
  constructor() {
    super('Image uploads are not configured. Set CLOUDFLARE_* variables to enable image attachments.');
    this.name = 'ImageUploadNotConfiguredError';
  }
}

function isConfigured() {
  return Boolean(
    config.CLOUDFLARE_ACCOUNT_ID &&
      config.CLOUDFLARE_ACCESS_KEY_ID &&
      config.CLOUDFLARE_SECRET_ACCESS_KEY &&
      config.CLOUDFLARE_BUCKET_NAME &&
      config.CLOUDFLARE_PUBLIC_URL,
  );
}

function getExtFromMime(mimeType: string) {
  const map: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/avif': 'avif',
    'image/svg+xml': 'svg',
  };
  return map[mimeType.toLowerCase()] ?? 'bin';
}

function sha256Hex(value: string | Buffer) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function hmac(key: Buffer | string, value: string) {
  return crypto.createHmac('sha256', key).update(value).digest();
}

function getSigningKey(secretAccessKey: string, dateStamp: string, region: string, service: string) {
  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, 'aws4_request');
}

function toAmzDate(date: Date) {
  const iso = date.toISOString().replace(/[:-]|\.\d{3}/g, '');
  return iso.slice(0, 15) + 'Z';
}

function toDateStamp(date: Date) {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

function encodeRfc3986(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function encodeObjectKey(key: string) {
  return key.split('/').map(encodeRfc3986).join('/');
}

function buildObjectKey(originalName: string, mimeType: string) {
  const base = path.posix.basename(originalName).replace(/[^a-zA-Z0-9._-]/g, '-');
  const unique = crypto.randomUUID();
  const ext = path.posix.extname(base) || `.${getExtFromMime(mimeType)}`;
  const stem = path.posix.basename(base, ext) || 'image';
  return `codex/${new Date().toISOString().slice(0, 10)}/${stem}-${unique}${ext}`;
}

export async function uploadCodexImage(input: {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}): Promise<UploadImageResult> {
  if (!isConfigured()) {
    throw new ImageUploadNotConfiguredError();
  }

  const key = buildObjectKey(input.filename, input.mimeType);
  const method = 'PUT';
  const region = 'auto';
  const service = 's3';
  const host = `${config.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const endpoint = `https://${host}/${config.CLOUDFLARE_BUCKET_NAME}/${encodeRfc3986(key)}`;
  const now = new Date();
  const amzDate = toAmzDate(now);
  const dateStamp = toDateStamp(now);
  const payloadHash = sha256Hex(input.buffer);
  const canonicalUri = `/${config.CLOUDFLARE_BUCKET_NAME}/${encodeObjectKey(key)}`;
  const canonicalHeaders = [
    `host:${host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`,
    `content-type:${input.mimeType}`,
  ].join('\n') + '\n';
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = [
    method,
    canonicalUri,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');
  const signingKey = getSigningKey(config.CLOUDFLARE_SECRET_ACCESS_KEY, dateStamp, region, service);
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');
  const authorization = `AWS4-HMAC-SHA256 Credential=${config.CLOUDFLARE_ACCESS_KEY_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const response = await fetch(endpoint, {
    method,
    headers: {
      Authorization: authorization,
      'Content-Type': input.mimeType,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
    },
    body: input.buffer,
  });

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw new Error(`R2 upload failed with status ${response.status}${details ? `: ${details}` : ''}`);
  }

  const publicBase = config.CLOUDFLARE_PUBLIC_URL.replace(/\/+$/, '');
  return {
    key,
    url: `${publicBase}/${encodeObjectKey(key)}`,
    mimeType: input.mimeType,
    size: input.buffer.length,
  };
}
