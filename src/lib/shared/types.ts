// Формы данных, которыми обмениваются API и интерфейс.
import type { Gender, Goal, LookingFor } from "./constants";

export type SwipeAction = "like" | "pass" | "superlike";

export type PhotoDto = {
  id: string;
  url: string;
  width: number;
  height: number;
  /** data URL размытого превью */
  blur: string;
};

/** Чужая анкета в том виде, в каком её видит текущий пользователь. */
export type ProfileCard = {
  id: string;
  name: string;
  age: number;
  gender: Gender;
  city: string;
  /** Округлённое расстояние; точных координат в ответах API нет */
  distanceKm: number | null;
  bio: string;
  job: string;
  goal: Goal;
  heightCm: number | null;
  photos: PhotoDto[];
  interests: string[];
  sharedInterests: string[];
  online: boolean;
  isPremium: boolean;
  superLikedYou: boolean;
  myAction: SwipeAction | null;
  matchId: string | null;
};

export type MyProfile = {
  name: string;
  birthDate: string;
  age: number;
  gender: Gender;
  lookingFor: LookingFor;
  goal: Goal;
  bio: string;
  job: string;
  heightCm: number | null;
  city: string;
  lat: number | null;
  lng: number | null;
  ageMin: number;
  ageMax: number;
  maxDistanceKm: number;
  isVisible: boolean;
  boostedUntil: string | null;
};

export type SwipeLimits = {
  /** null — без ограничений (подписка) */
  likesLeft: number | null;
  superlikesLeft: number;
};

export type Me = {
  id: string;
  email: string;
  role: "user" | "admin";
  isPremium: boolean;
  premiumUntil: string | null;
  onboarded: boolean;
  profile: MyProfile | null;
  photos: PhotoDto[];
  interests: string[];
  limits: SwipeLimits;
};

export type Counters = {
  unreadMessages: number;
  newLikes: number;
  unreadNotifications: number;
};

export type MatchPreview = {
  id: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    age: number;
    photo: PhotoDto | null;
    online: boolean;
  };
  lastMessage: { body: string; createdAt: string; mine: boolean } | null;
  unread: number;
};

export type MessageDto = {
  id: string;
  body: string;
  mine: boolean;
  createdAt: string;
  readAt: string | null;
};

export type ChatThread = {
  match: MatchPreview;
  messages: MessageDto[];
};

export type SwipeResult = {
  match: { id: string; user: { id: string; name: string; photo: PhotoDto | null } } | null;
  limits: SwipeLimits;
};

export type LikesResponse = {
  count: number;
  /** false — нужна подписка: вместо анкет приходят только размытые превью */
  unlocked: boolean;
  cards: ProfileCard[];
  teasers: { blur: string; superlike: boolean }[];
};

export type GeoPlace = {
  name: string;
  region: string;
  country: string;
  lat: number;
  lng: number;
};

export type NotificationDto = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
  read: boolean;
};

export type Product = {
  id: string;
  kind: "premium" | "boost";
  title: string;
  description: string;
  priceMinor: number;
  /** Срок подписки в днях или длительность буста в минутах */
  amount: number;
  badge?: string;
};

export type ApiError = {
  error: { code: string; message: string; fields?: Record<string, string> };
};
