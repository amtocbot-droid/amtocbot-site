export interface BlogPost {
  id: string;
  date: string;
  title: string;
  level: string;
  topic: string;
  blogUrl: string;
  linkedinUrl: string;
  twitterUrl: string;
  youtubeUrl?: string;
  status: string;
}

export interface Video {
  id: string;
  date: string;
  title: string;
  level: string;
  youtubeUrl: string;
  spotifyUrl?: string;
  duration: string;
  type: 'video' | 'podcast' | 'short';
}

export interface TranscriptSegment {
  label: string;
  entries: TranscriptEntry[];
}

export interface TranscriptEntry {
  speaker: string;
  text: string;
  timestamp: string;
}

export interface Milestone {
  name: string;
  target: number;
  current: number;
  status: 'Done' | 'Pending';
}

export interface PlatformAccount {
  platform: string;
  handle: string;
  url: string;
  icon: string;
}

export interface ContentData {
  blogs: BlogPost[];
  videos: Video[];
  milestones: Milestone[];
  platforms: PlatformAccount[];
  weeklySummary: {
    week: string;
    blogs: number;
    videos: number;
    podcasts: number;
    socialPosts: number;
  };
  monthlySummary: {
    month: string;
    blogs: number;
    videos: number;
    podcasts: number;
  };
}
