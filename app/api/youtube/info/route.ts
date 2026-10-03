import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

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
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Extract video ID
    const videoId = extractVideoId(url);
    if (!videoId) {
      return NextResponse.json({ error: 'Invalid YouTube URL' }, { status: 400 });
    }

    try {
      // Try to get info from YouTube using oEmbed API (no auth needed)
      const response = await axios.get(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
      );

      const { title, author_name, thumbnail_url } = response.data;

      // Get additional info from YouTube page metadata
      const pageResponse = await axios.get(`https://www.youtube.com/watch?v=${videoId}`, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
      });

      // Extract duration from page HTML
      let duration = 0;

      // Try multiple regex patterns to find duration
      const patterns = [
        /"lengthSeconds":"(\d+)"/,
        /"videoDetails":\{[^}]*"lengthSeconds":"(\d+)"/,
        /"duration":(\d+)/,
        /"length":"(\d+)"/,
      ];

      for (const pattern of patterns) {
        const match = pageResponse.data.match(pattern);
        if (match?.[1]) {
          duration = parseInt(match[1]);
          break;
        }
      }

      return NextResponse.json({
        success: true,
        videoInfo: {
          title: title || 'Unknown Title',
          author: author_name || 'Unknown Channel',
          duration: duration,
          thumbnail: thumbnail_url || '',
          videoId: videoId,
        },
      });
    } catch (apiError) {
      // Fallback: return basic info with video ID
      return NextResponse.json({
        success: true,
        videoInfo: {
          title: 'Video',
          author: 'YouTube',
          duration: 0,
          thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
          videoId: videoId,
        },
      });
    }
  } catch (error) {
    console.error('Error fetching video info:', error);
    return NextResponse.json(
      { error: 'Failed to fetch video information. Check the URL and try again.' },
      { status: 500 }
    );
  }
}
