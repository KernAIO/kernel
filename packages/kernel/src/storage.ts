import type { Readable } from 'node:stream'
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

export interface Storage {
  bucket: string
  client: S3Client
  presignPut(
    key: string,
    opts: { contentType: string; contentLength?: number; expiresIn?: number },
  ): Promise<string>
  presignGet(
    key: string,
    opts?: {
      expiresIn?: number
      filename?: string
      disposition?: 'inline' | 'attachment'
      contentType?: string
    },
  ): Promise<string>
  put(key: string, body: Buffer | Uint8Array | Readable | string, contentType: string): Promise<void>
  get(key: string): Promise<{ body: Readable; contentType?: string; contentLength?: number }>
  head(key: string): Promise<{ contentLength?: number; contentType?: string } | null>
  delete(key: string): Promise<void>
  /** key layout: ws/<workspaceId>/<module>/<yyyy>/<mm>/<fileId>/<name> */
  keyFor(parts: { workspaceId: string; module: string; id: string; name: string }): string
}

export function createStorage(opts: {
  endpoint?: string
  publicEndpoint?: string
  region: string
  bucket: string
  accessKey?: string
  secretKey?: string
  forcePathStyle?: boolean
}): Storage {
  const client = new S3Client({
    endpoint: opts.endpoint,
    region: opts.region,
    forcePathStyle: opts.forcePathStyle ?? true,
    credentials:
      opts.accessKey && opts.secretKey
        ? { accessKeyId: opts.accessKey, secretAccessKey: opts.secretKey }
        : undefined,
  })
  // presigned URLs must point at the public endpoint (Caddy /s3 → minio)
  const publicClient =
    opts.publicEndpoint && opts.publicEndpoint !== opts.endpoint
      ? new S3Client({
          endpoint: opts.publicEndpoint,
          region: opts.region,
          forcePathStyle: true,
          credentials:
            opts.accessKey && opts.secretKey
              ? { accessKeyId: opts.accessKey, secretAccessKey: opts.secretKey }
              : undefined,
        })
      : client
  const Bucket = opts.bucket
  return {
    bucket: Bucket,
    client,
    presignPut: (Key, o) =>
      getSignedUrl(
        publicClient,
        new PutObjectCommand({ Bucket, Key, ContentType: o.contentType, ContentLength: o.contentLength }),
        { expiresIn: o.expiresIn ?? 900 },
      ),
    presignGet: (Key, o = {}) =>
      getSignedUrl(
        publicClient,
        new GetObjectCommand({
          Bucket,
          Key,
          ResponseContentDisposition: o.filename
            ? `${o.disposition ?? 'inline'}; filename*=UTF-8''${encodeURIComponent(o.filename)}`
            : undefined,
          ResponseContentType: o.contentType,
        }),
        { expiresIn: o.expiresIn ?? 3600 },
      ),
    async put(Key, Body, ContentType) {
      await client.send(new PutObjectCommand({ Bucket, Key, Body, ContentType }))
    },
    async get(Key) {
      const r = await client.send(new GetObjectCommand({ Bucket, Key }))
      return { body: r.Body as Readable, contentType: r.ContentType, contentLength: r.ContentLength }
    },
    async head(Key) {
      try {
        const r = await client.send(new HeadObjectCommand({ Bucket, Key }))
        return { contentLength: r.ContentLength, contentType: r.ContentType }
      } catch {
        return null
      }
    },
    async delete(Key) {
      await client.send(new DeleteObjectCommand({ Bucket, Key }))
    },
    keyFor: ({ workspaceId, module, id, name }) => {
      const d = new Date()
      return `ws/${workspaceId}/${module}/${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${id}/${name.replace(/[^\w.-]+/g, '_').slice(0, 120)}`
    },
  }
}
