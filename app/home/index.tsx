import { useAudioStore, useUserStore } from "@/lib/store";
import { API_URL } from "@/utils/envVariables";
import {
  cleanOldCampaignAudios,
  syncCampaignAudios,
} from "@/utils/fileManager";
import { LogManager } from "@/utils/logManager";
import Feather from "@expo/vector-icons/Feather";
import Geolocation from "@react-native-community/geolocation";
import NetInfo from "@react-native-community/netinfo";
import axios from "axios";
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from "expo-audio";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { VolumeManager } from "react-native-volume-manager";

export default function Home() {
  const token = useUserStore((s) => s.token);
  const user = useUserStore((s) => s.user);

  // 🗄️ Zustand Persistant States & Actions
  const downloadedAudios = useAudioStore((s) => s.downloadedAudios);
  const currentIndex = useAudioStore((s) => s.currentIndex);
  const setCurrentIndex = useAudioStore((s) => s.setCurrentIndex);
  const currentCampaign = useAudioStore((s) => s.currentCampaign);
  const setCurrentCampaign = useAudioStore((s) => s.setCurrentCampaign);
  const clearAudioCache = useAudioStore((s) => s.clearAudioCache);

  const [manualPause, setManualPause] = useState(false);
  const [loading, setLoading] = useState(false);

  // 🔥 ÉTATS GPS EN TEMPS RÉEL
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const watchIdRef = useRef<number | null>(null);

  // 🔥 ÉTAT DU VOLUME (100% = 1.0)
  const [currentVolume, setCurrentVolume] = useState(1.0);
  const VolumePrefered = 0.7;

  // 🗓️ 1. VÉRIFICATION STRICTE DE LA VALIDITÉ DE LA CAMPAGNE
  const campaign = useMemo(() => {
    if (!currentCampaign) return null;
    if (!currentCampaign.audios || currentCampaign.audios.length === 0)
      return null;

    const start = new Date(currentCampaign.startDate).getTime();
    const durationWeeks = currentCampaign.duration || 0;
    const expirationTime = start + durationWeeks * 7 * 24 * 60 * 60 * 1000;

    if (Date.now() > expirationTime) {
      return null;
    }

    return currentCampaign;
  }, [currentCampaign]);

  // 🎯 2. RÉSOLUTION DE LA SOURCE AUDIO
  const audioUri = useMemo(() => {
    if (!campaign?.audios?.length) return null;

    const currentAudio = campaign.audios[currentIndex];
    const localUri = downloadedAudios[currentAudio.id];

    return localUri || currentAudio.audioFile;
  }, [campaign, currentIndex, downloadedAudios]);

  // ⚙️ 3. INITIALISATION DU PLAYER
  const player = useAudioPlayer(audioUri ?? null);
  const status = useAudioPlayerStatus(player);

  // 🔥 4. NETTOYAGE AUTOMATIQUE SI OBSOLÈTE
  useEffect(() => {
    if (currentCampaign && !campaign) {
      console.log("Campagne obsolète détectée. Player mis en pause.");
      try {
        player?.pause();
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (e) {}
    }
  }, [campaign, currentCampaign, player]);

  // 📡 5. LOGIQUE DE SYNCHRONISATION
  const handleSynchronize = async () => {
    if (loading) return;

    const state = await NetInfo.fetch();
    if (!state.isConnected) {
      Alert.alert(
        "Connexion requise",
        "Veuillez vous connecter à Internet ou activer vos données mobiles pour synchroniser l'appareil.",
      );
      return;
    }

    setLoading(true);

    const analyticsLogs = await LogManager.getAllLogs();
    console.log("Logs à transférer vers le back-office :", analyticsLogs);

    if (currentCampaign && !campaign) {
      try {
        player?.pause();
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (e) {}
      clearAudioCache();
      setCurrentIndex(0);
    }

    if (!token) {
      setLoading(false);
      Alert.alert("Erreur", "Session utilisateur non valide.");
      return;
    }

    try {
      const { data } = await axios.post(
        `${API_URL}/api/mobile/audio/lancement`,
        { logs: analyticsLogs, TaxiUserId: user?.id },
        { headers: { Authorization: `Bearer ${token}` }, timeout: 12000 },
      );

      await LogManager.clearLogs();

      if (
        data?.campaign &&
        data.campaign.audios &&
        data.campaign.audios.length > 0
      ) {
        const isCampaignActive = await syncCampaignAudios(data.campaign);

        if (isCampaignActive) {
          setCurrentCampaign(data.campaign);
          if (
            useAudioStore.getState().currentIndex >= data.campaign.audios.length
          ) {
            setCurrentIndex(0);
          }
          setLoading(false);
          Alert.alert("Succès", "Nouvelle campagne synchronisée avec succès !");
        } else {
          clearAudioCache();
          setCurrentIndex(0);
          setLoading(false);
          Alert.alert("Information", "La campagne reçue est déjà expirée.");
        }
      } else {
        setLoading(false);
        setTimeout(() => {
          Alert.alert(
            "Contenu indisponible",
            "Une campagne a été trouvée sur le serveur mais aucun fichier audio n'est disponible pour le moment. Veuillez réessayer plus tard.",
          );
        }, 100);
        return;
      }
    } catch (error) {
      console.log("Échec de la synchronisation réseau :", error);
      setLoading(false);
      Alert.alert(
        "Connexion requise",
        "Impossible de joindre le serveur. Vérifiez votre connexion internet.",
      );
    } finally {
      setLoading(false);
    }
  };

  // 🔊 GESTION DU VOLUME EN TEMPS REEL
  useEffect(() => {
    const getInitialVolume = async () => {
      try {
        const result = await VolumeManager.getVolume();
        setCurrentVolume(result.volume);
      } catch (e) {
        console.log("Erreur init volume:", e);
      }
    };

    getInitialVolume();

    const volumeSubscription = VolumeManager.addVolumeListener((result) => {
      setCurrentVolume(result.volume);
    });

    return () => {
      volumeSubscription.remove();
    };
  }, []);

  const isVolumeTooLow = useMemo(
    () => currentVolume < VolumePrefered,
    [currentVolume],
  );
  const isPlayActive = useMemo(
    () => status.playing && !isVolumeTooLow && !!campaign,
    [campaign, isVolumeTooLow, status.playing],
  );

  // 📍 6. SUIVI GPS : Écoute de la vitesse du taxi
  useEffect(() => {
    Geolocation.requestAuthorization(
      () => {
        watchIdRef.current = Geolocation.watchPosition(
          (position) => {
            const speedMps = position.coords.speed ?? 0;
            const speedKmh = Math.max(0, speedMps * 3.6);
            setCurrentSpeed(speedKmh);
          },
          (error) => console.log("Erreur de tracking GPS:", error),
          { enableHighAccuracy: true, distanceFilter: 5, interval: 2000 },
        );
      },
      (error) => console.log("Permissions GPS refusées:", error),
    );

    return () => {
      if (watchIdRef.current !== null) {
        Geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // 📊 ENREGISTREMENT DES LOGS SUR INTERVALLE (Buffer mémoire géré par LogManager)
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    if (isPlayActive && campaign?.id) {
      interval = setInterval(() => {
        LogManager.saveTrackProgress(currentSpeed, campaign.id);
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlayActive, currentSpeed, campaign?.id]);

  // 🔇 SI le volume est trop bas, on stoppe automatiquement le playback
  useEffect(() => {
    if (isVolumeTooLow && status.playing && player) {
      console.log("Volume insuffisant. Pause automatique forcée.");
      player.pause();
    }
  }, [isVolumeTooLow, status.playing, player]);

  // 🔁 Configuration Initiale Système Audio
  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: "doNotMix",
    });
  }, []);

  // 🛡️ GESTION DYNAMIQUE DE LA NOTIFICATION ANDROID (LOCKSCREEN)
  useEffect(() => {
    if (Platform.OS === "android" && player) {
      if (status.playing) {
        player.setActiveForLockScreen(true);
      } else {
        player.setActiveForLockScreen(false);
      }
    }
  }, [status.playing, player]);

  // 🔄 7. LOGIQUE DE LECTURE CONTINUE SÉCURISÉE (RÉSOUT LE CRASH DE TRANSITION)
  useEffect(() => {
    if (!audioUri || !player || !campaign || isVolumeTooLow) return;

    try {
      player.replace(audioUri);

      if (!manualPause) {
        player.play();
      }
    } catch (e) {
      console.error("Erreur d'initialisation de la piste :", e);
    }

    const subscription = player.addListener(
      "playbackStatusUpdate",
      (statusUpdate) => {
        // 🔥 On ne déclenche la transition que si le morceau est complètement terminé
        if (statusUpdate.didJustFinish && !statusUpdate.isBuffering) {
          const total = campaign.audios.length;
          if (total > 0) {
            // 🛑 On force une pause immédiate pour couper le thread de l'ancienne piste
            player.pause();

            setCurrentIndex((prev) => {
              return total === 1 ? 0 : (prev + 1) % total;
            });
          }
        }
      },
    );

    // 🧼 NETTOYAGE LÉGER : On désabonne uniquement l'écouteur pour laisser le lecteur respirer
    return () => {
      subscription.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    audioUri,
    isVolumeTooLow,
    manualPause,
    player,
    setCurrentIndex,
    // campaign retiré des dépendances ici pour éviter de réinstancier à chaque seconde de log
  ]);

  // 🧹 8. UNIQUE NETTOYAGE GLOBAL AU DÉMONTAGE DE L'ÉCRAN (FERMETURE DE L'APPLICATION)
  useEffect(() => {
    return () => {
      if (player) {
        try {
          player.pause();
          if (Platform.OS === "android") {
            player.setActiveForLockScreen(false);
          }
          player.clearLockScreenControls(); // Fait disparaître définitivement la notif à la fermeture
        } catch (e) {
          console.log("Erreur lors du démontage matériel :", e);
        }
      }
    };
  }, [player]);

  // TOGGLE AUDIO
  const toggle = () => {
    if (isVolumeTooLow) return;
    if (status.playing) {
      setManualPause(true);
      player.pause();
    } else {
      setManualPause(false);
      player.play();
    }
  };

  // CHECKER IF CAMPAIGN STILL ON GOING
  useEffect(() => {
    const checkCurrentCampaign = async () => {
      // Pas de campagne => inutile de vérifier
      if (!currentCampaign) return;

      // Vérifier la connexion
      const network = await NetInfo.fetch();

      if (!network.isConnected) {
        console.log("Mode hors ligne, vérification ignorée.");
        return;
      }

      try {
        const { data } = await axios.post(
          `${API_URL}/api/mobile/audio/check`,
          {
            campaignId: currentCampaign.id,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            timeout: 10000,
          },
        );

        console.log("NOT INFINITE LOOP!!");

        if (!data.exists) {
          console.log("Campagne supprimée du serveur.");

          try {
            player.pause();
          } catch {}

          await cleanOldCampaignAudios(currentCampaign.audios);

          await LogManager.clearLogs();

          clearAudioCache();

          setCurrentCampaign(null);

          setCurrentIndex(0);
        }
      } catch (error) {
        console.log("Impossible de vérifier la campagne :", error);
      }
    };

    checkCurrentCampaign();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Loader plein écran
  if (loading && !campaign) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#4F7CFF" />
      </View>
    );
  }

  // ALERTE DE VOLUME BAS
  if (isVolumeTooLow) {
    return (
      <View
        style={[
          styles.container,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <Feather
          name="volume-x"
          size={64}
          color="#FF4F4F"
          style={{ marginBottom: 24 }}
        />
        <Text style={styles.noCampaignText}>Volume trop bas</Text>
        <Text style={[styles.expiredSubtext, { color: "#AAA" }]}>
          Le volume de diffusion doit être supérieur à **70%** pour jouer les
          annonces publicitaires. Veuillez augmenter le volume de la tablette ou
          du téléphone.
        </Text>
        <Text
          style={{
            color: "#FF4F4F",
            fontFamily: "Lato_700Bold",
            fontSize: 16,
            marginTop: 10,
          }}
        >
          Volume actuel : {Math.round(currentVolume * 100)}% / 70% minimum
        </Text>
      </View>
    );
  }

  // ÉCRAN DE SYNCHRONISATION
  if (!campaign || !audioUri) {
    return (
      <View style={[styles.container, { justifyContent: "center" }]}>
        <Feather
          name="disc"
          size={44}
          color="#666"
          style={{ alignSelf: "center", marginBottom: 20 }}
        />
        <Text style={styles.noCampaignText}>Prêt pour synchronisation</Text>
        <Text style={styles.expiredSubtext}>
          Aucune campagne active n&apos;est disponible sur cet appareil.
          Veuillez cliquer sur le bouton ci-dessous pour actualiser.
        </Text>
        <Pressable
          style={({ pressed }) => [
            styles.syncBtn,
            pressed && styles.syncBtnPressed,
          ]}
          onPress={handleSynchronize}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={styles.syncBtnText}>Synchroniser les campagnes</Text>
          )}
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 📡 BADGE DE DÉBOGAGE GPS ABSOLU */}
      <View style={styles.debugGpsBadge}>
        <View
          style={[
            styles.debugDot,
            { backgroundColor: currentSpeed > 2 ? "#4FFF7C" : "#FF4F4F" },
          ]}
        />
        <Text style={styles.debugGpsText}>
          GPS Vitesse :{" "}
          <Text style={{ fontFamily: "Lato_700Bold", color: "#4F7CFF" }}>
            {currentSpeed.toFixed(1)} km/h
          </Text>
        </Text>
        <Text style={styles.debugStatusText}>
          {currentSpeed > 2
            ? "Statut : En mouvement"
            : "Statut : À l'arrêt / Écarté"}
        </Text>
      </View>

      <View style={styles.headerContainer}>
        <Text style={styles.subtitle}>Campagne Active</Text>
        <Text style={styles.title} numberOfLines={1}>
          {campaign.name}
        </Text>
      </View>

      <View style={styles.playerWrapper}>
        <Pressable
          style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
          onPress={toggle}
        >
          <View style={styles.innerCircle}>
            <Feather
              name={status.playing ? "pause" : "play"}
              size={48}
              color="#FFF"
              style={!status.playing ? { marginLeft: 6 } : {}}
            />
          </View>
        </Pressable>
      </View>

      <View style={styles.footerContainer}>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressBar,
              {
                width: `${((currentIndex + 1) / campaign.audios.length) * 100}%`,
              },
            ]}
          />
        </View>

        <Text style={styles.info}>
          Publication {currentIndex + 1} sur {campaign.audios.length}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0A0C",
    paddingHorizontal: 32,
    justifyContent: "space-between",
    paddingTop: 80,
    paddingBottom: 60,
  },
  headerContainer: {
    alignItems: "center",
    marginTop: 20,
  },
  subtitle: {
    color: "#666",
    fontSize: 12,
    letterSpacing: 3,
    textTransform: "uppercase",
    fontFamily: "Lato_400Regular",
    marginBottom: 8,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 24,
    textAlign: "center",
    textTransform: "capitalize",
    fontFamily: "Lato_700Bold",
    letterSpacing: 0.5,
  },
  playerWrapper: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  btn: {
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 1,
    borderColor: "rgba(79, 124, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  btnPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  innerCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "#4F7CFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#4F7CFF",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  footerContainer: {
    alignItems: "center",
    width: "100%",
  },
  progressTrack: {
    width: "60%",
    height: 3,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 2,
    marginBottom: 16,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#4F7CFF",
    borderRadius: 2,
  },
  info: {
    color: "#8E8E93",
    fontSize: 14,
    fontFamily: "Lato_400Regular",
    letterSpacing: 0.5,
  },
  noCampaignText: {
    color: "#FFF",
    textAlign: "center",
    fontFamily: "Lato_700Bold",
    fontSize: 20,
    marginBottom: 8,
  },
  expiredSubtext: {
    color: "#666",
    textAlign: "center",
    fontFamily: "Lato_400Regular",
    fontSize: 14,
    paddingHorizontal: 20,
    marginBottom: 32,
    lineHeight: 20,
  },
  syncBtn: {
    backgroundColor: "#4F7CFF",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 30,
    alignSelf: "center",
    minWidth: 200,
    alignItems: "center",
    justifyContent: "center",
  },
  syncBtnPressed: {
    opacity: 0.85,
  },
  syncBtnText: {
    color: "#FFF",
    fontFamily: "Lato_700Bold",
    fontSize: 16,
  },
  debugGpsBadge: {
    position: "absolute",
    top: 50,
    left: 20,
    right: 20,
    backgroundColor: "rgba(20, 20, 25, 0.9)",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    flexDirection: "row",
    alignItems: "center",
    zIndex: 999,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  debugDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  debugGpsText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: "Lato_400Regular",
    flex: 1,
  },
  debugStatusText: {
    color: "#666",
    fontSize: 11,
    fontFamily: "Lato_400Regular",
  },
});
