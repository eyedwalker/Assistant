import ffmpeg from 'fluent-ffmpeg';
import { Readable } from 'stream';

/**
 * Convert WebM video buffer to MP4 format
 * @param webmBuffer - Buffer containing WebM video data
 * @returns Promise<Buffer> - Buffer containing MP4 video data
 */
export async function convertWebMToMP4(webmBuffer: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    console.log('🎬 Starting WebM to MP4 conversion...');
    const startTime = Date.now();
    
    // Create readable stream from buffer
    const inputStream = Readable.from(webmBuffer);
    
    // Collect output chunks
    const chunks: Buffer[] = [];
    
    // Configure FFmpeg conversion
    ffmpeg(inputStream)
      .inputFormat('webm')
      .videoCodec('libx264')
      .audioCodec('aac')
      .outputFormat('mp4')
      .outputOptions([
        '-preset fast',           // Faster encoding
        '-crf 23',               // Quality (18-28, lower = better)
        '-movflags frag_keyframe+empty_moov+faststart',  // Enable streaming
        '-pix_fmt yuv420p'       // Better compatibility
      ])
      .on('start', (commandLine) => {
        console.log('🎬 FFmpeg command:', commandLine);
      })
      .on('progress', (progress) => {
        if (progress.percent) {
          console.log(`🎬 Conversion progress: ${Math.round(progress.percent)}%`);
        }
      })
      .on('end', () => {
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        const outputBuffer = Buffer.concat(chunks);
        const sizeMB = (outputBuffer.length / (1024 * 1024)).toFixed(2);
        console.log(`✅ Conversion complete: ${sizeMB}MB in ${duration}s`);
        resolve(outputBuffer);
      })
      .on('error', (error) => {
        console.error('❌ FFmpeg conversion failed:', error.message);
        reject(new Error(`Video conversion failed: ${error.message}`));
      })
      .pipe()
      .on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });
  });
}

/**
 * Check if FFmpeg is available on the system
 * @returns Promise<boolean>
 */
export async function checkFFmpegAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    ffmpeg.getAvailableFormats((err) => {
      if (err) {
        console.error('⚠️ FFmpeg not available:', err.message);
        resolve(false);
      } else {
        console.log('✅ FFmpeg is available');
        resolve(true);
      }
    });
  });
}
