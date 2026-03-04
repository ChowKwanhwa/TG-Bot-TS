import { S3Client } from "@aws-sdk/client-s3";

const r2Client = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
    },
    // Cloudflare R2 signature mismatch fix for aws-sdk v3
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
});

export { r2Client };

export const getR2PublicUrl = (key: string) => {
    if (process.env.R2_PUBLIC_DOMAIN) {
        return `${process.env.R2_PUBLIC_DOMAIN}/${key}`;
    }
    return null;
};
