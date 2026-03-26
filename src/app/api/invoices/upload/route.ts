import { NextRequest, NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';

// Client upload handler — the file goes directly from browser to Blob storage,
// bypassing the 4.5MB serverless body limit.
export async function POST(request: NextRequest) {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        // Validate the upload before generating a token
        if (!pathname.endsWith('.pdf')) {
          throw new Error('Only PDF files are accepted');
        }
        return {
          allowedContentTypes: ['application/pdf'],
          maximumSizeInBytes: 50 * 1024 * 1024, // 50MB max
          tokenPayload: JSON.stringify({}),
        };
      },
      onUploadCompleted: async () => {
        // Nothing needed after upload
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to upload file: ${message}` },
      { status: 500 }
    );
  }
}
