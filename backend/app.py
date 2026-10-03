from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
import subprocess
import os
import tempfile
import json
from pathlib import Path

app = Flask(__name__)
# Enable CORS for all routes
CORS(app, resources={r"/*": {"origins": "*"}}, methods=['GET', 'POST', 'OPTIONS'])

def extract_video_id(url):
    """Extract video ID from YouTube URL"""
    import re
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

def get_video_info(url):
    """Get video info using yt-dlp"""
    try:
        video_id = extract_video_id(url)
        if not video_id:
            return None

        cmd = [
            'yt-dlp',
            '--dump-json',
            '--no-warnings',
            '-e',
            url
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)

        if result.returncode == 0:
            data = json.loads(result.stdout)
            return {
                'title': data.get('title', 'Unknown'),
                'author': data.get('uploader', 'Unknown'),
                'duration': data.get('duration', 0),
                'thumbnail': data.get('thumbnail', f'https://img.youtube.com/vi/{video_id}/maxresdefault.jpg'),
                'videoId': video_id
            }
    except Exception as e:
        print(f"Error getting video info: {e}")

    return None

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

        info = get_video_info(url)
        if not info:
            # Fallback with basic info
            info = {
                'title': 'Video',
                'author': 'YouTube',
                'duration': 0,
                'thumbnail': f'https://img.youtube.com/vi/{video_id}/maxresdefault.jpg',
                'videoId': video_id
            }

        return jsonify({'success': True, 'videoInfo': info})

    except Exception as e:
        print(f"Error: {e}")
        return jsonify({'error': str(e)}), 500

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
        quality = data.get('quality', 128)
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

        # Download using yt-dlp with anti-bot bypass
        cmd = [
            'yt-dlp',
            '-f', 'ba',
            '-x',
            '--audio-format', 'm4a',
            '--audio-quality', f'{quality}K',
            '-o', output_file,
            '--no-warnings',
            '--extractor-args', 'youtube:player_client=web',
            '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            '-S', 'res,ext:m4a:m4b',
            url
        ]

        print(f"Running: {' '.join(cmd)}")
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)

        if result.returncode != 0:
            error_msg = result.stderr or result.stdout or 'Download failed'
            print(f"Download error: {error_msg}")
            return jsonify({'error': f'Download failed: {error_msg}'}), 500

        # Check if file exists
        if not os.path.exists(output_file):
            return jsonify({'error': 'Download failed - output file not created'}), 500

        # Read and return file
        with open(output_file, 'rb') as f:
            file_data = f.read()

        # Cleanup
        import shutil
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)

        return send_file(
            os.path.join(temp_dir, f'{safe_title}.m4a'),
            mimetype='audio/mp4',
            as_attachment=True,
            download_name=f'{safe_title}.m4a'
        ) if os.path.exists(os.path.join(temp_dir, f'{safe_title}.m4a')) else app.response_class(
            response=file_data,
            status=200,
            headers={
                'Content-Type': 'audio/mp4',
                'Content-Disposition': f'attachment; filename="{safe_title}.m4a"',
                'Cache-Control': 'no-cache, no-store'
            }
        )

    except subprocess.TimeoutExpired:
        return jsonify({'error': 'Download timeout - video too long or connection issue'}), 500
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({'error': f'Error: {str(e)}'}), 500
    finally:
        # Cleanup temp files
        if temp_dir and os.path.exists(temp_dir):
            import shutil
            try:
                shutil.rmtree(temp_dir)
            except:
                pass

@app.route('/health', methods=['GET'])
@app.route('/health/', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'ok', 'service': 'youtube-downloader-backend'})

@app.route('/', methods=['GET'])
def root():
    """Root endpoint"""
    return jsonify({'message': 'YouTube Downloader Backend', 'status': 'running'})

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
