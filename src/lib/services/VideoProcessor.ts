import { exec } from 'child_process';
import { promisify } from 'util';
import { unlink } from 'fs/promises';
import path from 'path';
import { BedrockAccessor } from '@/lib/accessors/BedrockAccessor';

const execAsync = promisify(exec);

export interface VideoProcessingOptions {
  filepath: string;
  filename: string;
  title: string;
  category: string;
  accessLevel: string;
  tenantId: string;
}

export interface VideoProcessingResult {
  transcript: string;
  duration: number;
  keyTopics: string[];
  timestamps?: Array<{
    time: string;
    text: string;
    topic?: string;
  }>;
}

export class VideoProcessor {
  private bedrockAccessor: BedrockAccessor;

  constructor() {
    this.bedrockAccessor = new BedrockAccessor({
      region: process.env.AWS_BEDROCK_REGION || 'us-east-1',
      modelId: process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-5-sonnet-20240620-v1:0'
    });
  }

  async processVideo(options: VideoProcessingOptions): Promise<VideoProcessingResult> {
    const { filepath, title } = options;
    
    console.log(`🎬 Processing video: ${title}`);
    
    // Step 1: Extract audio from video
    const audioPath = await this.extractAudio(filepath);
    
    // Step 2: Get video duration
    const duration = await this.getVideoDuration(filepath);
    
    // Step 3: Generate transcript (simulated for now - would use AWS Transcribe in production)
    const transcript = await this.generateTranscript(audioPath, title);
    
    // Step 4: Extract key topics using AI
    const keyTopics = await this.extractKeyTopics(transcript, title);
    
    // Step 5: Generate timestamps (simulated)
    const timestamps = this.generateTimestamps(transcript);
    
    // Cleanup audio file
    await this.cleanup(audioPath);
    
    return {
      transcript,
      duration,
      keyTopics,
      timestamps
    };
  }

  private async extractAudio(videoPath: string): Promise<string> {
    const audioPath = videoPath.replace(path.extname(videoPath), '.wav');
    
    try {
      // Using ffmpeg to extract audio (install with: brew install ffmpeg)
      await execAsync(`ffmpeg -i "${videoPath}" -vn -acodec pcm_s16le -ar 16000 -ac 1 "${audioPath}" -y`);
      console.log('🎵 Audio extracted successfully');
      return audioPath;
    } catch (error) {
      console.log('⚠️ FFmpeg not available, using simulated audio extraction');
      // For demo purposes, return a mock audio path
      return audioPath;
    }
  }

  private async getVideoDuration(videoPath: string): Promise<number> {
    try {
      const { stdout } = await execAsync(`ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${videoPath}"`);
      return parseFloat(stdout.trim());
    } catch (error) {
      console.log('⚠️ Could not determine duration, using default');
      return 300; // 5 minutes default
    }
  }

  private async generateTranscript(audioPath: string, title: string): Promise<string> {
    // In production, this would use AWS Transcribe or similar service
    // For demo, we'll generate a realistic eyecare training transcript
    
    console.log('🎤 Generating transcript (simulated)...');
    
    const eyecareTranscripts = [
      `Welcome to this training video on contact lens care and maintenance. Today we'll cover the essential steps every patient needs to know.

First, let's discuss daily cleaning routines. It's crucial that patients understand the importance of washing their hands thoroughly before handling contact lenses. Use antibacterial soap and dry with a lint-free towel.

When removing lenses, always start with the same eye to avoid confusion. Place the lens in your palm and apply a few drops of multipurpose solution. Gently rub the lens for 20 seconds to remove protein deposits and debris.

For storage, always use fresh solution in a clean case. Never reuse old solution or top it off. Replace lens cases every 3 months to prevent bacterial contamination.

Monthly replacement lenses should be discarded exactly on schedule, even if they feel comfortable. Extended wear beyond the recommended period increases infection risk significantly.

In the Eyefinity system, you can set up automated reminders for patients to help them stay on track with their replacement schedule. This feature has proven invaluable for compliance.`,

      `This video demonstrates proper contact lens fitting techniques using Eyefinity's measurement tools.

Start by evaluating the patient's corneal curvature using keratometry readings. The base curve should be selected to match the corneal shape within 0.2mm.

Consider the patient's lifestyle factors. Athletes may benefit from daily disposables, while office workers might prefer monthly lenses with superior deposit resistance.

Tear film quality assessment is critical. Use the tear break-up time test and evaluate for dry eye symptoms before lens selection.

When documenting in Eyefinity, ensure you record the initial comfort rating, vision quality, and any fitting adjustments. This data helps track patient satisfaction over time.

For troubleshooting lens discomfort, first check centration and movement. The lens should move 1-2mm with each blink and center properly over the pupil.`,

      `Patient education is key to successful contact lens wear. This training covers the essential topics to discuss during dispensing.

Begin with hand hygiene education. Demonstrate proper handwashing technique and emphasize its importance for eye health.

Show patients how to insert lenses correctly. Start with the dominant eye, check for inside-out lenses, and ensure proper centration.

Removal technique should be taught using the pinch method rather than sliding, which can damage the cornea.

Discuss the signs of complications that require immediate attention: persistent redness, pain, vision changes, or unusual discharge.

Use Eyefinity's patient education materials to provide take-home instructions. The system's automated follow-up scheduling helps ensure proper care continuation.

Remember to schedule follow-up appointments at appropriate intervals: 1 week, 1 month, and then annually for successful wearers.`
    ];

    // Select appropriate transcript based on title keywords
    let selectedTranscript = eyecareTranscripts[0]; // default
    
    if (title.toLowerCase().includes('fitting')) {
      selectedTranscript = eyecareTranscripts[1];
    } else if (title.toLowerCase().includes('education') || title.toLowerCase().includes('patient')) {
      selectedTranscript = eyecareTranscripts[2];
    }

    return selectedTranscript;
  }

  private async extractKeyTopics(transcript: string, title: string): Promise<string[]> {
    try {
      console.log('🧠 Extracting key topics using AI...');
      
      const response = await this.bedrockAccessor.generateChatResponse(
        `Analyze this eyecare training video transcript and extract 5-7 key topics as brief phrases (2-4 words each). 
        
        Transcript: "${transcript}"
        
        Return only the topics as a comma-separated list, no other text.`,
        'You are an expert in eyecare and optometry education. Extract the most important learning topics.',
        'system',
        'demo-tenant'
      );

      const topics = response.message
        .split(',')
        .map(topic => topic.trim())
        .filter(topic => topic.length > 0)
        .slice(0, 7);

      return topics;
    } catch (error) {
      console.log('⚠️ AI topic extraction failed, using fallback');
      // Fallback topics based on common eyecare themes
      return ['Contact Lens Care', 'Hand Hygiene', 'Lens Storage', 'Patient Education', 'Eyefinity System'];
    }
  }

  private generateTimestamps(transcript: string): Array<{time: string; text: string; topic?: string}> {
    // Split transcript into segments and assign timestamps
    const sentences = transcript.split(/[.!?]+/).filter(s => s.trim().length > 10);
    const timestamps = [];
    
    let currentTime = 0;
    const avgSentenceDuration = 8; // seconds per sentence
    
    for (let i = 0; i < Math.min(sentences.length, 10); i++) {
      const sentence = sentences[i].trim();
      if (sentence) {
        const minutes = Math.floor(currentTime / 60);
        const seconds = currentTime % 60;
        const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        timestamps.push({
          time: timeStr,
          text: sentence,
          topic: this.inferTopicFromSentence(sentence)
        });
        
        currentTime += avgSentenceDuration;
      }
    }
    
    return timestamps;
  }

  private inferTopicFromSentence(sentence: string): string {
    const topicKeywords = {
      'Hand Hygiene': ['hand', 'wash', 'clean', 'soap', 'hygiene'],
      'Lens Care': ['cleaning', 'solution', 'care', 'maintenance'],
      'Storage': ['storage', 'case', 'store', 'container'],
      'Insertion': ['insert', 'putting', 'placing', 'wear'],
      'Removal': ['remove', 'taking', 'pinch'],
      'Patient Education': ['patient', 'teach', 'education', 'instruct'],
      'Eyefinity': ['eyefinity', 'system', 'software']
    };

    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some(keyword => sentence.toLowerCase().includes(keyword))) {
        return topic;
      }
    }
    
    return 'General';
  }

  async cleanup(filepath: string): Promise<void> {
    try {
      await unlink(filepath);
      console.log(`🗑️ Cleaned up: ${path.basename(filepath)}`);
    } catch (error) {
      console.log(`⚠️ Could not cleanup: ${path.basename(filepath)}`);
    }
  }
}
