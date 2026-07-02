import { Audio, Campaign, useAudioStore, useUserStore } from "@/lib/store";
import axios from "axios";
import { Directory, File, Paths } from "expo-file-system";
import { API_URL } from "./envVariables";

// Définir le chemin vers votre dossier unique d'audios
export const getAudioDirectory = () => {
  return new Directory(Paths.document, "audios");
};

/**
 * Vérifie si le dossier "audios" existe au lancement, sinon le crée.
 */
export const ensureAudioDirectory = async (): Promise<string> => {
  try {
    const audioDir = getAudioDirectory();

    // Vérifie si le dossier existe déjà
    if (!audioDir.exists) {
      console.log("Le dossier audio n'existe pas, création en cours...");
      audioDir.create();
    } else {
      console.log("Le dossier audio existe déjà.");
    }

    return audioDir.uri;
  } catch (error) {
    console.error("Erreur lors de l'initialisation du dossier audio:", error);
    throw error;
  }
};

// DOWNLOAD AUDIO
export const downloadCampaignAudios = async (audios: Audio[]) => {
  const audioDir = getAudioDirectory();

  // Accès aux données hors d'un composant React
  const { downloadedAudios, setDownloadedAudio } = useAudioStore.getState();

  for (const audio of audios) {
    try {
      const fileExtension =
        audio.audioFile.split(".").pop()?.split("?")[0] || "mp3";
      const localFile = new File(audioDir, `${audio.id}.${fileExtension}`);

      // Double sécurité : présent dans Zustand ET physiquement présent sur le disque
      if (downloadedAudios[audio.id] && localFile.exists) {
        console.log(`Audio déjà présent en local : ${audio.id}`);
        continue;
      }

      console.log(`Téléchargement de l'audio : ${audio.id}`);

      // 🔥 CORRECTION : Appel de la méthode statique de la classe File
      const downloadedFile = await File.downloadFileAsync(
        audio.audioFile,
        localFile,
      );

      // Sauvegarde persistante de l'URI locale récupérée du résultat
      setDownloadedAudio(audio.id, downloadedFile.uri);
    } catch (error) {
      console.error(`Erreur téléchargement audio ${audio.id}:`, error);
    }
  }
};

// DELETE AUDIO
/**
 * Supprime physiquement les fichiers du disque et nettoie le store Zustand
 */
export const cleanOldCampaignAudios = async (audios: Audio[]) => {
  const audioDir = getAudioDirectory();
  const { removeAudiosFromStore } = useAudioStore.getState();
  const idsToDelete: string[] = [];

  for (const audio of audios) {
    try {
      const fileExtension =
        audio.audioFile.split(".").pop()?.split("?")[0] || "mp3";
      const localFile = new File(audioDir, `${audio.id}.${fileExtension}`);

      // Supprime le fichier s'il existe sur le téléphone
      if (localFile.exists) {
        localFile.delete();
        console.log(`Fichier supprimé du disque : ${audio.id}`);
      }

      idsToDelete.push(audio.id);
    } catch (error) {
      console.error(
        `Erreur lors de la suppression du fichier ${audio.id}:`,
        error,
      );
    }
  }

  // Nettoyage du store Zustand en une seule fois
  if (idsToDelete.length > 0) {
    removeAudiosFromStore(idsToDelete);
  }
};

//Decrementer le nombre de telechargement restant d'une pub(audio)
export const notifyAudioDownloaded = async (audioId: string) => {
  try {
    const token = useUserStore.getState().token;

    await axios.post(
      `${API_URL}/api/mobile/audio/downloaded`,
      {
        audioId,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        timeout: 10000,
      },
    );
  } catch (error) {
    console.log("Impossible de notifier le serveur du téléchargement", error);
  }
};

/**
 * Gère intelligemment le téléchargement ou la suppression selon la validité de la campagne
 */
export const syncCampaignAudios = async (
  campaign: Campaign,
): Promise<boolean> => {
  const { downloadedAudios, setDownloadedAudio } = useAudioStore.getState();
  const audioDir = getAudioDirectory();

  // 1. Calcul des dates
  const start = new Date(campaign.startDate); // per days
  const now = new Date();

  const end = new Date(start);
  end.setDate(end.getDate() + campaign.duration);

  const isExpired = now > end;

  // 2. Si la campagne est expirée, on nettoie TOUT et on stoppe
  if (isExpired) {
    console.log(
      `La campagne "${campaign.name}" est expirée. Nettoyage des fichiers...`,
    );
    await cleanOldCampaignAudios(campaign.audios);
    return false; // Indique que la campagne ne doit pas être jouée
  }

  // 3. Si elle est valide (en cours ou à venir), on s'assure que ses audios sont là
  console.log(
    `La campagne "${campaign.name}" est valide. Synchronisation des audios...`,
  );

  for (const audio of campaign.audios) {
    try {
      const fileExtension =
        audio.audioFile.split(".").pop()?.split("?")[0] || "mp3";
      const localFile = new File(audioDir, `${audio.id}.${fileExtension}`);

      // Déjà présent ? On passe au suivant
      if (downloadedAudios[audio.id] && localFile.exists) {
        continue;
      }

      console.log(`Téléchargement de l'audio requis : ${audio.id}`);
      const downloadedFile = await File.downloadFileAsync(
        audio.audioFile,
        localFile,
      );

      // Notifier le telechargement au server et decrementer la limite de telechargement restant
      await notifyAudioDownloaded(audio.id);

      setDownloadedAudio(audio.id, downloadedFile.uri);
    } catch (error) {
      console.error(`Erreur téléchargement audio ${audio.id}:`, error);
    }
  }

  return true; // La campagne est active et prête
};
