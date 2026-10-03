import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { url, quality, title } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Get backend URL from environment or use default Railway URL
    const backendUrl = process.env.BACKEND_URL || 'https://youtube-downloader-backend-production.railway.app';

    // Call the Python backend to download
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minutes

    const response = await fetch(`${backendUrl}/api/youtube/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, quality, title }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Backend error: ${response.status}`);
    }

    // Get the audio file from backend
    const blob = await response.blob();

    // Return the audio file
    return new NextResponse(blob, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mp4',
        'Content-Length': blob.size.toString(),
        'Content-Disposition': `attachment; filename="${title.replace(/[^a-z0-9]/gi, '_')}.m4a"`,
        'Cache-Control': 'no-cache, no-store',
      },
    });
  } catch (error) {
    console.error('Download error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: `Failed to download: ${errorMessage}`,
        hint: 'Backend service may be starting up. Please try again in a few seconds.',
      },
      { status: 500 }
    );
  }
}
