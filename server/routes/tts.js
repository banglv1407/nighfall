import { Router } from 'express';
import fs from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const router = Router();
const __dirname = dirname(fileURLToPath(import.meta.url));
const cacheDir = join(__dirname, '..', 'tts_cache');

// Ensure cache directory exists
if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
}

// GET /api/tts?text=...
router.get('/', async (req, res) => {
  try {
    const text = req.query.text;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Text query parameter is required' });
    }

    // Clean text by stripping emojis and trimming whitespace
    const cleanText = text.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD00-\uDFFF]/g, '').trim();
    if (!cleanText) {
      return res.status(400).json({ error: 'Text query parameter cannot be empty' });
    }

    // Generate unique MD5 hash for cache indexing
    const hash = crypto.createHash('md5').update(cleanText).digest('hex');
    const filePath = join(cacheDir, `${hash}.mp3`);

    // Check if the file already exists in local cache
    if (fs.existsSync(filePath)) {
      console.log(`[TTS CACHE] Serving cached audio for: "${cleanText.substring(0, 30)}..."`);
      return res.sendFile(filePath);
    }

    // Fetch from external TTS API
    console.log(`[TTS API] Fetching new audio from HappyPlatform for: "${cleanText.substring(0, 30)}..."`);
    const response = await fetch('https://airouter.happyplatform.io.vn/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer sk-f203b442c61c6b75-rd0cru-4c6f08c2'
      },
      body: JSON.stringify({
        model: 'google-tts/vi',
        input: cleanText
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[TTS API] Failed to fetch speech:', errText);
      return res.status(502).json({ error: 'External speech synthesis failed' });
    }

    // Save audio buffer to cache
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(filePath, buffer);

    console.log(`[TTS CACHE] Saved new audio file: ${hash}.mp3 (${buffer.length} bytes)`);
    res.sendFile(filePath);
  } catch (e) {
    console.error('[TTS ERROR] Error processing speech synthesis request:', e);
    res.status(500).json({ error: 'Internal server error during speech synthesis' });
  }
});

export default router;
