from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
import subprocess
import os
import tempfile
import json
import re

app = Flask(__name__)
# Enable CORS for all origins and methods
CORS(app, resources={r"/*": {"origins": "*"}}, methods=['GET', 'POST', 'OPTIONS'])

def extract_video_id(url):
    """Extract video ID from YouTube URL"""
    patterns = [
        r'(?:youtube\.com/watch\?v=|youtu\.be/)([^&\n?#]+)',
        r'youtube\.com/embed/([^&\n?#]+)',
        r'youtube\.com/v/([^&\n?#]+)',
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None

@app.route('/', methods=['GET'])
def root():
    """Root endpoint"""
    return jsonify({'message': 'YouTube Downloader Backend', 'status': 'running'})

@app.route('/health', methods=['GET'])
@app.route('/health/', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'ok', 'service': 'youtube-downloader-backend'})

@app.route('/api/youtube/info', methods=['POST', 'OPTIONS'])
def youtube_info():
    """Get YouTube video info"""
    if request.method == 'OPTIONS':
        return '', 204

    try:
        data = request.json
        if not data:
            return jsonify({'error': 'No JSON data provided'}), 400

        url = data.get('url')
        if not url:
            return jsonify({'error': 'URL is required'}), 400

        video_id = extract_video_id(url)
        if not video_id:
            return jsonify({'error': 'Invalid YouTube URL'}), 400

        try:
            # Use yt-dlp to get info with JSON output
            cmd = [
                'yt-dlp',
                '--dump-json',
                '--no-warnings',
                '--socket-timeout', '10',
                url
            ]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=15)

            if result.returncode == 0:
                data_dict = json.loads(result.stdout)
                return jsonify({
                    'success': True,
                    'videoInfo': {
                        'title': data_dict.get('title', 'Unknown'),
                        'author': data_dict.get('uploader', 'Unknown'),
                        'duration': data_dict.get('duration', 0),
                        'thumbnail': data_dict.get('thumbnail', f'https://img.youtube.com/vi/{video_id}/maxresdefault.jpg'),
                        'videoId': video_id
                    }
                })
        except Exception as e:
            print(f"Error: {e}")

        # Fallback response
        return jsonify({
            'success': True,
            'videoInfo': {
                'title': 'Video',
                'author': 'YouTube',
                'duration': 0,
                'thumbnail': f'https://img.youtube.com/vi/{video_id}/maxresdefault.jpg',
                'videoId': video_id
            }
        })

    except Exception as error:
        print(f"Error fetching video info: {error}")
        return jsonify({'error': str(error)}), 500

@app.route('/api/youtube/download', methods=['POST', 'OPTIONS'])
def youtube_download():
    """Download YouTube audio"""
    if request.method == 'OPTIONS':
        return '', 204

    temp_dir = None
    output_file = None

    try:
        data = request.json
        if not data:
            return jsonify({'error': 'No JSON data provided'}), 400

        url = data.get('url')
        quality = int(data.get('quality', 128))
        title = data.get('title', 'audio')

        if not url:
            return jsonify({'error': 'URL is required'}), 400

        video_id = extract_video_id(url)
        if not video_id:
            return jsonify({'error': 'Invalid YouTube URL'}), 400

        # Create temp directory
        temp_dir = tempfile.mkdtemp()
        safe_title = "".join(c if c.isalnum() else "_" for c in title)[:50]
        output_file = os.path.join(temp_dir, f'{safe_title}.m4a')

        print(f"Starting download: {url}")

        # Use yt-dlp with maximum bypass options
        cmd = [
            'yt-dlp',
            '-f', 'bestaudio',
            '-x',
            '--audio-format', 'm4a',
            '--audio-quality', f'{quality}K',
            '-o', output_file,
            '--no-warnings',
            '--quiet',
            '--no-playlist',
            '--socket-timeout', '30',
            '--extractor-args', 'youtube:player_client=android',
            url
        ]

        print(f"Running yt-dlp command")
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)

        if result.returncode != 0:
            error_msg = result.stderr or result.stdout or 'Download failed'
            print(f"yt-dlp error: {error_msg}")
            raise Exception(f"Download failed: {error_msg}")

        # Check if file was created
        if not os.path.exists(output_file):
            raise Exception('Output file not created')

        # Read the file
        with open(output_file, 'rb') as f:
            file_data = f.read()

        print(f"Download successful: {len(file_data)} bytes")

        # Cleanup temp files
        try:
            import shutil
            if os.path.exists(temp_dir):
                shutil.rmtree(temp_dir)
        except:
            pass

        # Return the audio file
        return app.response_class(
            response=file_data,
            status=200,
            headers={
                'Content-Type': 'audio/mp4',
                'Content-Length': str(len(file_data)),
                'Content-Disposition': f'attachment; filename="{safe_title}.m4a"',
                'Cache-Control': 'no-cache, no-store'
            }
        )

    except subprocess.TimeoutExpired:
        print("Timeout: Download took too long")
        return jsonify({'error': 'Download timeout - video too long or connection issue'}), 500
    except Exception as error:
        print(f"Download error: {error}")
        return jsonify({'error': f'Failed to download: {str(error)}'}), 500
    finally:
        # Cleanup temp files
        if temp_dir and os.path.exists(temp_dir):
            try:
                import shutil
                shutil.rmtree(temp_dir)
            except:
                pass

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
