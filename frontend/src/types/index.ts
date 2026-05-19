export interface User {
  id: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  photoUrl?: string;
  nickname?: string | null;
  freeCredits: number;
  paidCredits: number;
  isAnonymous?: boolean;
  language?: 'zh' | 'en';
}

export interface PaymentTier {
  id: number;
  diamonds: number;
  usd: number | string;
  usdt?: string;
  stars?: number;
  label: string;
  bonus: string;
  monthly?: boolean;
}

export interface Character {
  id: string;
  name: string;
  nameEn?: string | null;
  age: number;
  gender: string;
  occupation: string;
  occupationEn?: string | null;
  personality: string;
  personalityEn?: string | null;
  background: string;
  backgroundEn?: string | null;
  speakingStyle: string;
  speakingStyleEn?: string | null;
  avatarEmoji: string;
  portraitUrl?: string | null;
  faceUrl?: string | null;
  portraitImages?: string[];
  isPublic: boolean;
  usageCount: number;
  avgRating: number;
  reviewCount: number;
  openingScene?: string;
  openingSceneEn?: string | null;
  createdAt: string;
  creator?: { username?: string; firstName?: string };
  reviews?: Review[];
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string;
  imagePrompt?: string;       // ComfyUI generation prompt (non-library chars)
  imageTwoShot?: boolean;
  pendingImageUrl?: string;   // library image locked behind 2💎 payment
  revealUrl?: string;         // URL being slowly un-blurred during fake-generation animation
  revealStage?: number;       // 0→3: controls blur amount, progress bar, status text
  imageGenerating?: boolean;
  imageError?: boolean;       // generation/unlock failed — show retry button
  streaming?: boolean;        // currently receiving chunks — show dots, hide text
  fresh?: boolean;            // just received — animate paragraphs in
}

export interface Conversation {
  id: string;
  totalTurns: number;
  messages: { id: string; role: string; content: string; createdAt: string }[];
}

export interface Review {
  id: string;
  rating: number;
  comment?: string;
  createdAt: string;
  user?: { username?: string; firstName?: string };
}

export interface ChatHistoryItem {
  id: string;
  totalTurns: number;
  updatedAt: string;
  character: { id: string; name: string; nameEn?: string | null; avatarEmoji: string; occupation: string; occupationEn?: string | null; portraitUrl?: string | null };
  lastMessage: { role: string; content: string } | null;
  intimacy: number;
  mood: string;
}

