import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

// Extract video ID from YouTube URL
function extractVideoId(url: string): string | null {
  const regexPatterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
    /youtube\.com\/embed\/([^&\n?#]+)/,
    /youtube\.com\/v\/([^&\n?#]+)/,
  ];

  for (const regex of regexPatterns) {
    const match = url.match(regex);
    if (match?.[1]) {
      return match[1];
    }
  }
  return null;
}

export async function POST(request: NextRequest) {
  let tempDir: string | null = null;
  let outputFile: string | null = null;

  try {
    const { url, quality, title } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      return NextResponse.json({ error: 'Invalid YouTube URL' }, { status: 400 });
    }

    // Create temp directory for download
    tempDir = path.join('/tmp', `yt-${Date.now()}`);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Safe filename
    const safeTitle = title.replace(/[^a-z0-9]/gi, '_').substring(0, 50);
    outputFile = path.join(tempDir, `${safeTitle}.m4a`);

    console.log(`Downloading: ${url} to ${outputFile}`);

    // Use yt-dlp to download audio
    const command = `yt-dlp -f "ba" -x --audio-format m4a --audio-quality ${quality}K -o "${outputFile}" "${url}"`;

    const { stdout, stderr } = await execAsync(command, {
      timeout: 300000, // 5 minute timeout
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });

    console.log('Download stdout:', stdout);
    if (stderr) console.log('Download stderr:', stderr);

    // Check if file was created
    if (!fs.existsSync(outputFile)) {
      throw new Error('Download failed - output file not created');
    }

    // Read the file
    const fileBuffer = fs.readFileSync(outputFile);

    // Clean up temp files
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (cleanupError) {
      console.error('Cleanup error:', cleanupError);
    }

    // Return the audio file
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mp4',
        'Content-Length': fileBuffer.length.toString(),
        'Content-Disposition': `attachment; filename="${safeTitle}.m4a"`,
        'Cache-Control': 'no-cache, no-store',
      },
    });
  } catch (error) {
    // Clean up on error
    if (tempDir && fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (e) {
        console.error('Cleanup error:', e);
      }
    }

    console.error('Download error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: `Failed to download: ${errorMessage}`,
        hint: 'Make sure the YouTube URL is valid and the video is accessible',
      },
      { status: 500 }
    );
  }
}
