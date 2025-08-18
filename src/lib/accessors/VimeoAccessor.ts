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
   * Get video transcript/captions
   */
  async getVideoTranscript(videoId: string): Promise<any> {
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

    return response.json();
  }
}
