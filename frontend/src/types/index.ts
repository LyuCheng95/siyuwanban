export interface User {
  id: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  photoUrl?: string;
  freeCredits: number;
  paidCredits: number;
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
  isPublic: boolean;
  usageCount: number;
  avgRating: number;
  reviewCount: number;
  createdAt: string;
  creator?: { username?: string; firstName?: string };
  reviews?: Review[];
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string;
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

export interface PaymentTier {
  stars: number;
  turns: number;
  label: string;
}
