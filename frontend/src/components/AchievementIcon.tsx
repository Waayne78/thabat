import { Award, Book, BookOpen, Bookmark, Flame, Moon, Repeat, Sprout, Star, type LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  sprout: Sprout, flame: Flame, moon: Moon, book: Book, bookmark: Bookmark, award: Award, repeat: Repeat, star: Star, "book-open": BookOpen,
};

export function AchievementIcon({ name, size = 22 }: { name: string; size?: number }) {
  const Icon = ICONS[name] ?? Star;
  return <Icon size={size} strokeWidth={1.6} />;
}
