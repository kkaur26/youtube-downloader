'use client';

import { useState } from 'react';
import Link from 'next/link';

interface VideoInfo {
  title: string;
  author: string;
  duration: number;
  thumbnail: string;
  videoId: string;
}

export default function Home() {
  const [url, setUrl] = useState('');
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [quality, setQuality] = useState('128');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const fetchVideoInfo = async () => {
    if (!url.trim()) {
      setError('Please enter a YouTube URL');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('Fetching video info...');

    try {
      const response = await fetch('/api/youtube/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();

      if (data.success) {
        setVideoInfo(data.videoInfo);
        setMessage('');
      } else {
        setError(data.error || 'Failed to fetch video info');
      }
    } catch (err) {
      setError('Error fetching video info. Make sure the URL is valid.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const downloadAudio = async () => {
    if (!videoInfo) return;

    setDownloading(true);
    setMessage('⏳ Downloading audio... This may take 10-30 seconds');
    setError('');

    try {
      const response = await fetch('/api/youtube/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          quality: parseInt(quality),
          title: videoInfo.title,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Download failed');
      }

      // Get the audio file as blob
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);

      // Create download link and trigger download
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${videoInfo.title.replace(/[^a-z0-9]/gi, '_')}.m4a`;
      document.body.appendChild(link);
      link.click();

      // Cleanup
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(link);

      setMessage(`✅ Download complete! File saved: ${videoInfo.title}.m4a`);
      setTimeout(() => setMessage(''), 5000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`❌ Download failed: ${errorMessage}`);
      console.error('Download error:', err);
    } finally {
      setDownloading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-red-100 to-red-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">🎵</span>
            </div>
            <span className="font-bold text-xl text-gray-900">AudioPull</span>
          </div>
          <div className="flex gap-6">
            <Link href="#how" className="text-gray-600 hover:text-gray-900 font-medium">
              How It Works
            </Link>
            <Link href="#faq" className="text-gray-600 hover:text-gray-900 font-medium">
              FAQ
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Download YouTube Audio
          </h1>
          <p className="text-xl text-gray-600">
            Convert YouTube videos to MP3 and download to your phone instantly
          </p>
        </div>

        {/* Input Section */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <label className="block text-lg font-semibold text-gray-700 mb-4">
            Paste YouTube Link
          </label>
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              onKeyPress={(e) => e.key === 'Enter' && fetchVideoInfo()}
            />
            <button
              onClick={fetchVideoInfo}
              disabled={loading}
              className="px-8 py-3 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 disabled:bg-gray-400 transition"
            >
              {loading ? 'Fetching...' : 'Get Info'}
            </button>
          </div>

          {/* Messages */}
          {message && (
            <div className="mb-4 p-4 bg-blue-100 text-blue-800 rounded-lg">
              {message}
            </div>
          )}
          {error && (
            <div className="mb-4 p-4 bg-red-100 text-red-800 rounded-lg">
              {error}
            </div>
          )}

          {/* Video Info */}
          {videoInfo && (
            <div className="border-t pt-6 mt-6">
              <div className="grid md:grid-cols-3 gap-6">
                {/* Thumbnail */}
                <div>
                  <img
                    src={videoInfo.thumbnail}
                    alt="Video thumbnail"
                    className="w-full rounded-lg shadow-md"
                  />
                </div>

                {/* Details */}
                <div className="md:col-span-2">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    {videoInfo.title}
                  </h3>
                  <p className="text-gray-600 mb-4">
                    <strong>Channel:</strong> {videoInfo.author}
                  </p>
                  <p className="text-gray-600 mb-6">
                    <strong>Duration:</strong> {formatDuration(videoInfo.duration)}
                  </p>

                  {/* Quality Selection */}
                  <div className="mb-6">
                    <label className="block font-semibold text-gray-700 mb-3">
                      Audio Quality
                    </label>
                    <div className="flex gap-3 flex-wrap">
                      {[
                        { value: '64', label: '64 kbps (Smallest)' },
                        { value: '128', label: '128 kbps (Good)' },
                        { value: '192', label: '192 kbps (Better)' },
                        { value: '320', label: '320 kbps (Best)' },
                      ].map((q) => (
                        <button
                          key={q.value}
                          onClick={() => setQuality(q.value)}
                          className={`px-4 py-2 rounded-lg font-semibold transition ${
                            quality === q.value
                              ? 'bg-red-600 text-white'
                              : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                          }`}
                        >
                          {q.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Download Button */}
                  <button
                    onClick={downloadAudio}
                    disabled={downloading}
                    className="w-full px-8 py-4 bg-green-600 text-white text-lg font-bold rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition"
                  >
                    {downloading ? '⏳ Downloading...' : '⬇️ Download MP3'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* How It Works */}
        <div id="how" className="bg-white rounded-lg shadow-md p-8 mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-4xl mb-3">1️⃣</div>
              <h3 className="font-bold text-gray-900 mb-2">Paste Link</h3>
              <p className="text-gray-600">
                Copy any YouTube video link and paste it here
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-3">2️⃣</div>
              <h3 className="font-bold text-gray-900 mb-2">Select Quality</h3>
              <p className="text-gray-600">
                Choose your preferred audio quality (64-320 kbps)
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-3">3️⃣</div>
              <h3 className="font-bold text-gray-900 mb-2">Download</h3>
              <p className="text-gray-600">
                MP3 downloads directly to your phone or computer
              </p>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div id="faq" className="bg-white rounded-lg shadow-md p-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Which YouTube links work?
              </h3>
              <p className="text-gray-600">
                All YouTube links work! Paste any youtube.com or youtu.be link.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                What quality should I choose?
              </h3>
              <p className="text-gray-600">
                128 kbps is good for most uses (saves space). 320 kbps is best quality but larger file.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                How long does it take?
              </h3>
              <p className="text-gray-600">
                Usually 10-30 seconds depending on video length and quality. Faster for shorter videos.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Is it safe?
              </h3>
              <p className="text-gray-600">
                Yes! No registration needed. Your downloads are processed immediately and not stored.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
