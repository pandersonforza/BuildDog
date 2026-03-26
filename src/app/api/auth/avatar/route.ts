import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

export async function POST(request: NextRequest) {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const ext = pathname.split(".").pop()?.toLowerCase();
        const validExts = ["jpg", "jpeg", "png", "gif", "webp"];
        if (!ext || !validExts.includes(ext)) {
          throw new Error("Only image files (jpg, png, gif, webp) are accepted");
        }
        return {
          allowedContentTypes: ALLOWED_IMAGE_TYPES,
          maximumSizeInBytes: 5 * 1024 * 1024, // 5MB max
          tokenPayload: JSON.stringify({}),
        };
      },
      onUploadCompleted: async () => {
        // Nothing needed after upload
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to upload avatar: ${message}` },
      { status: 500 }
    );
  }
}
