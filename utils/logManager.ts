import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "@servi_ads_daily_logs";

export interface DailyLog {
  date: string;
  campaignId: string;
  totalDuration: number; // En secondes
  speedSum: number;
  speedCount: number;
  avgSpeed: number;
}

// 🧠 MÉMOIRE TAMPON (Buffer) : Évite d'écrire sur le disque à chaque seconde
let localLogsBuffer: Record<string, DailyLog> | null = null;
let lastSaveTime = 0;
const SAVE_INTERVAL_MS = 15000; // Sauvegarde sur le disque toutes les 15 secondes seulement

export const LogManager = {
  getTodayString: () => new Date().toISOString().split("T")[0],

  // Initialisation ou récupération du buffer en mémoire
  _initBuffer: async (): Promise<Record<string, DailyLog>> => {
    if (localLogsBuffer !== null) return localLogsBuffer;
    try {
      const existingLogsStr = await AsyncStorage.getItem(STORAGE_KEY);
      localLogsBuffer = existingLogsStr ? JSON.parse(existingLogsStr) : {};
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      localLogsBuffer = {};
    }
    return localLogsBuffer!;
  },

  saveTrackProgress: async (speedInKmh: number, campaignId: string) => {
    try {
      const today = LogManager.getTodayString();
      const logKey = `${today}_${campaignId}`;

      // 1. On travaille uniquement en mémoire (ultra rapide, 0ms de blocage)
      const logs = await LogManager._initBuffer();

      if (!logs[logKey]) {
        logs[logKey] = {
          date: today,
          campaignId: campaignId,
          totalDuration: 0,
          speedSum: 0,
          speedCount: 0,
          avgSpeed: 0,
        };
      }

      // Incrémentation en mémoire
      logs[logKey].totalDuration += 1;

      if (speedInKmh > 2) {
        logs[logKey].speedSum += speedInKmh;
        logs[logKey].speedCount += 1;
        logs[logKey].avgSpeed = Math.round(
          logs[logKey].speedSum / logs[logKey].speedCount,
        );
      }

      // 2. On n'écrit sur le disque QUE si le délai d'intervalle est dépassé
      const now = Date.now();
      if (now - lastSaveTime > SAVE_INTERVAL_MS) {
        lastSaveTime = now;
        // Exécution en arrière-plan sans bloquer l'App
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(logs)).catch((err) =>
          console.error("Erreur flush logs:", err),
        );
      }
    } catch (e) {
      console.error("Erreur écriture logs :", e);
    }
  },

  getAllLogs: async (): Promise<
    Omit<DailyLog, "speedSum" | "speedCount">[]
  > => {
    try {
      // Priorité à la mémoire si disponible, sinon au disque
      const logs = localLogsBuffer || (await LogManager._initBuffer());
      return Object.values(logs).map(
        ({ date, campaignId, totalDuration, avgSpeed }) => ({
          date,
          campaignId,
          totalDuration,
          avgSpeed,
        }),
      );
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      return [];
    }
  },

  clearLogs: async () => {
    try {
      localLogsBuffer = {}; // Vide la mémoire
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error("Erreur de nettoyage des logs :", e);
    }
  },
};
