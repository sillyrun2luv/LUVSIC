import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/** 可选头像 emoji 列表 */
export const AVATAR_OPTIONS = [
  "🌙", "✨", "🌸", "🍵", "🕯️", "🦊", "🐱", "🍃",
  "🔥", "💧", "🎭", "📖", "🎧", "🎲", "🪐", "🐚",
];

interface ProfileState {
  name: string;
  avatar: string;
  setName: (name: string) => void;
  setAvatar: (avatar: string) => void;
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      name: "我",
      avatar: "🌙",
      setName: (name) => set({ name: name.trim() || "我" }),
      setAvatar: (avatar) => set({ avatar }),
    }),
    {
      name: "zwba_profile",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
