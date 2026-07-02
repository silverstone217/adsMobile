import { useUserStore } from "@/lib/store";
import { ensureAudioDirectory } from "@/utils/fileManager";
import { COLORS } from "@/utils/theme";
import {
  Lato_100Thin,
  Lato_300Light,
  Lato_400Regular,
  Lato_700Bold,
  Lato_900Black,
  useFonts,
} from "@expo-google-fonts/lato";
import { router, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { StatusBar, View } from "react-native";

// On empêche le splash de se cacher automatiquement au démarrage
SplashScreen.preventAutoHideAsync();

// Note : Avec Expo SDK 54, la configuration de la durée ici sert principalement
// à l'animation de sortie (fade). Le blocage réel se fait dans le useEffect.
SplashScreen.setOptions({
  duration: 1000,
  fade: true,
});

// Définissez ici le temps total souhaité en millisecondes (ex: 5000 pour 5s, 10000 pour 10s)
const SPLASH_DURATION = 5000;

export default function RootLayout() {
  let [fontsLoaded] = useFonts({
    Lato_100Thin,
    Lato_300Light,
    Lato_400Regular,
    Lato_700Bold,
    Lato_900Black,
  });

  const token = useUserStore((state) => state.token);
  const isAuthenticated = useUserStore((state) => state.isAuthenticated);

  useEffect(() => {
    // On attend absolument que les polices soient prêtes avant de lancer le chrono de la logique
    if (!fontsLoaded) return;

    const initApp = async () => {
      const start = Date.now();

      try {
        // Vos tâches asynchrones (ex: création de dossier)
        await ensureAudioDirectory();

        // Calcul du temps écoulé pendant les tâches
        const elapsed = Date.now() - start;
        // On force l'attente jusqu'à atteindre la durée cible (SPLASH_DURATION)
        const remaining = Math.max(0, SPLASH_DURATION - elapsed);

        if (remaining > 0) {
          await new Promise((resolve) => setTimeout(resolve, remaining));
        }

        // Redirection vers le bon écran (l'écran change en tâche de fond)
        if (!token || !isAuthenticated) {
          router.replace("/");
        } else {
          router.replace("/home");
        }
      } catch (error) {
        console.error("Erreur lors de l'initialisation :", error);
      } finally {
        // C'est SEULEMENT ici, après l'attente forcée et la redirection, qu'on cache le Splash Screen
        await SplashScreen.hideAsync();
      }
    };

    initApp();
  }, [fontsLoaded, token, isAuthenticated]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: COLORS.background },
        }}
      />
      <StatusBar
        animated
        barStyle="light-content"
        backgroundColor={COLORS.background}
      />
    </View>
  );
}
