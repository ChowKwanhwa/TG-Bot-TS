# Lessons Learned: Railway Deployment & Docker Optimization

## Build-time Environment Variables
- **Problem**: Next.js builds (and other node scripts) might fail if they attempt to instantiate clients (like `Resend`) that require environment variables not present during build.
- **Solution**: Always instantiate such clients inside request handlers or runtime-only functions, or provide safe dummy defaults during build.

## Prisma Client in Multi-stage Docker Builds
- **Problem**: `prisma generate` creates files in `node_modules`. If using Next.js `standalone` mode, it attempts to copy these. However, if you subsequently overwrite `node_modules` in the runner stage (e.g., to support a side-car worker), you must ensure the source `node_modules` also contains the generated client.
- **Solution**: Copy `node_modules` from the stage *after* `prisma generate` was run (e.g., the `builder` stage), or re-run `prisma generate` in the `deps` stage if schema is available.

## Permission Issues in Slim Images
- **Problem**: Using `useradd` for a non-root user (e.g., `nextjs`) in a Docker image can lead to `EACCES` errors if tools like `npm` or `npx` try to write to a non-existent or restricted home directory.
- **Solution**: Explicitly set `ENV HOME=/tmp` or create a writable home directory and `chown` it at build time.

## Multi-service Monorepo on Railway
- **Problem**: Tracking logs and status for multiple services in a single repo can be confusing if they don't deploy at the exact same time or if CLI linking is ambiguous.
- **Solution**: Use explicit service IDs (`railway logs --service <ID>`) for unambiguous verification.

## Cloudflare R2 SignatureDoesNotMatch with AWS SDK v3
- **Problem**: Encountering `SignatureDoesNotMatch` when uploading to Cloudflare R2 using `@aws-sdk/lib-storage` `Upload` instances.
- **Solution**: AWS SDK v3 automatically populates checksum headers for multipart/streamed uploads which R2 may calculate differently or reject. Disable this enforcement by setting `requestChecksumCalculation: "WHEN_REQUIRED"` and `responseChecksumValidation: "WHEN_REQUIRED"` in the `S3Client` instantiation to resolve the issue.

## GramJS Uploading Buffer to Telegram
- **Problem**: Calling `client.uploadFile` and passing a Node.js `Buffer` natively throws a `Could not create buffer from file` error because GramJS validates inputs rigorously online/in browser-like contexts.
- **Solution**: Import `CustomFile` from `telegram/client/uploads` and wrap the buffer explicitly using `new CustomFile(filename, size, "", buffer)` to correctly upload via GramJS `uploadFile` method.
