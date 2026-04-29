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
}

export interface PaymentTier {
  id: number;
  diamonds: number;
  usd: number;
  label: string;
  bonus: string;
}

export interface Character {
  id: string;
  name: string;
  age: number;
  gender: string;
  occupation: string;
  personality: string;
  background: string;
  speakingStyle: string;
  avatarEmoji: string;
  portraitUrl?: string | null;
  faceUrl?: string | null;
  portraitImages?: string[];
  isPublic: boolean;
  usageCount: number;
  avgRating: number;
  reviewCount: number;
  openingScene?: string;
  createdAt: string;
  creator?: { username?: string; firstName?: string };
  reviews?: Review[];
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string;
  imagePrompt?: string;
  imageTwoShot?: boolean;
  imageGenerating?: boolean;
  streaming?: boolean;  // currently receiving chunks — show dots, hide text
  fresh?: boolean;      // just received — animate paragraphs in
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
  character: { id: string; name: string; avatarEmoji: string; occupation: string; portraitUrl?: string | null };
  lastMessage: { role: string; content: string } | null;
  intimacy: number;
  mood: string;
}

export interface PaymentTier {
  stars: number;
  turns: number;
  label: string;
}
