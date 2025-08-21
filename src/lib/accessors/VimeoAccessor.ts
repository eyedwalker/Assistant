/**
 * Vimeo API Accessor for video management
 */

interface VimeoVideo {
  uri: string;
  name: string;
  description: string | null;
  duration: number;
  link: string;
  download?: Array<{
    quality: string;
    type: string;
    link: string;
    size: number;
  }>;
  created_time: string;
  modified_time: string;
}

interface VimeoListResponse {
  total: number;
  page: number;
  per_page: number;
  paging: {
    next: string | null;
    previous: string | null;
    first: string;
    last: string;
  };
  data: VimeoVideo[];
}

export class VimeoAccessor {
  private accessToken: string;
  private baseUrl = 'https://api.vimeo.com';

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  /**
   * Fetch all videos from a Vimeo account
   */
  async getAllVideos(options: {
    page?: number;
    perPage?: number;
    query?: string;
    fields?: string;
  } = {}): Promise<VimeoListResponse> {
    const params = new URLSearchParams({
      page: (options.page || 1).toString(),
      per_page: (options.perPage || 100).toString(),
      fields: options.fields || 'uri,name,description,duration,link,download,created_time,modified_time'
    });

    if (options.query) {
      params.append('query', options.query);
    }

    const response = await fetch(`${this.baseUrl}/me/videos?${params}`, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Accept': 'application/vnd.vimeo.*+json;version=3.4'
      }
    });

    if (!response.ok) {
      throw new Error(`Vimeo API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Fetch all videos recursively (handles pagination)
   */
  async fetchAllVideos(query?: string): Promise<VimeoVideo[]> {
    const allVideos: VimeoVideo[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await this.getAllVideos({
        page,
        perPage: 100,
        query
      });

      allVideos.push(...response.data);
      
      hasMore = response.paging.next !== null;
      page++;

      // Add delay to avoid rate limiting
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return allVideos;
  }

  /**
   * Get video details by ID
   */
  async getVideo(videoId: string): Promise<VimeoVideo> {
    const response = await fetch(`${this.baseUrl}/videos/${videoId}`, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Accept': 'application/vnd.vimeo.*+json;version=3.4'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch video: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Get video download links
   */
  async getVideoDownloadLinks(videoId: string): Promise<Array<{
    quality: string;
    type: string;
    link: string;
    size: number;
  }>> {
    const video = await this.getVideo(videoId);
    return video.download || [];
  }

  /**
   * Get video transcript/captions as extracted text
   */
  async getVideoTranscript(videoId: string): Promise<string | null> {
    try {
      // Get text tracks metadata
      const response = await fetch(`${this.baseUrl}/videos/${videoId}/texttracks`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Accept': 'application/vnd.vimeo.*+json;version=3.4'
        }
      });

      if (!response.ok) {
        console.warn(`No transcript available for video ${videoId}`);
        return null;
      }

      const textTracksData = await response.json();
      const textTracks = textTracksData.data || [];

      if (textTracks.length === 0) {
        return null;
      }

      // Find the first active text track or the first available one
      const activeTrack = textTracks.find((track: any) => track.active) || textTracks[0];

      if (!activeTrack || !activeTrack.link) {
        return null;
      }

      // Fetch the actual transcript content
      const transcriptResponse = await fetch(activeTrack.link);
      
      if (!transcriptResponse.ok) {
        console.warn(`Failed to fetch transcript content for video ${videoId}`);
        return null;
      }

      const transcriptContent = await transcriptResponse.text();

      // Parse VTT format if needed
      let parsedTranscript = '';
      if (transcriptContent.includes('WEBVTT')) {
        // Remove VTT headers and timestamps
        const lines = transcriptContent.split('\n');
        let isText = false;
        
        for (const line of lines) {
          if (line.trim() === '') {
            isText = false;
          } else if (line.includes('-->')) {
            isText = true;
          } else if (isText && !line.startsWith('WEBVTT') && !line.match(/^\d+$/)) {
            parsedTranscript += line + ' ';
          }
        }
      } else {
        parsedTranscript = transcriptContent;
      }

      const cleanTranscript = parsedTranscript.trim();
      return cleanTranscript.length > 0 ? cleanTranscript : null;

    } catch (error) {
      console.error(`Error fetching transcript for video ${videoId}:`, error);
      return null;
    }
  }
}
