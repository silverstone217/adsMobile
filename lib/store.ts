import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface User {
  id: string;
  phone: string;
  name: string | null;
  createdAt: Date;
  isBanned: boolean;
}

interface UserState {
  token: string | null;
  user: User | null;

  isAuthenticated: boolean;

  login: (data: { token: string; user: User }) => void;

  logout: () => void;

  updateUser: (user: Partial<User>) => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      token: null,
      user: null,

      isAuthenticated: false,

      login: ({ token, user }) =>
        set({
          token,
          user,
          isAuthenticated: true,
        }),

      logout: () =>
        set({
          token: null,
          user: null,
          isAuthenticated: false,
        }),

      updateUser: (updatedUser) =>
        set((state) => ({
          user: state.user
            ? {
                ...state.user,
                ...updatedUser,
              }
            : null,
        })),
    }),
    {
      name: "taxi-user-storage",

      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

export interface Audio {
  id: string;
  createdAt: Date;
  audioFile: string;
  audioDuration: number;
}
export interface Campaign {
  id: string;
  name: string;
  duration: number;
  startDate: Date;

  audios: Audio[];
}

interface AudioState {
  downloadedAudios: Record<string, string>;
  currentIndex: number;

  currentCampaign: Campaign | null;

  setDownloadedAudio: (audioId: string, localUri: string) => void;

  // 🔥 Ajoutez cette ligne pour déclarer la fonction et typer "audioIds" en tableau de chaînes
  removeAudiosFromStore: (audioIds: string[]) => void;

  setCurrentIndex: (index: number | ((prev: number) => number)) => void;
  setCurrentCampaign: (campaign: Campaign | null) => void;

  clearAudioCache: () => void;
}

export const useAudioStore = create<AudioState>()(
  persist(
    (set) => ({
      downloadedAudios: {},
      currentIndex: 0,
      currentCampaign: null,

      setCurrentCampaign: (campaign) => set({ currentCampaign: campaign }),

      setDownloadedAudio: (audioId, localUri) =>
        set((state) => ({
          downloadedAudios: {
            ...state.downloadedAudios,
            [audioId]: localUri,
          },
        })),

      // TypeScript associera automatiquement le type (audioIds: string[]) défini dans l'interface
      removeAudiosFromStore: (audioIds) =>
        set((state) => {
          const newCache = { ...state.downloadedAudios };
          audioIds.forEach((id) => {
            delete newCache[id];
          });
          return { downloadedAudios: newCache };
        }),

      setCurrentIndex: (index) => {
        const nextIndex =
          typeof index === "function"
            ? index(useAudioStore.getState().currentIndex)
            : index;
        set({ currentIndex: nextIndex });
      },

      clearAudioCache: () => set({ downloadedAudios: {} }),
    }),
    {
      name: "taxi-audio-storage",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
