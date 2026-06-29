import { useUserStore } from "@/lib/store";
import { COLORS } from "@/utils/theme";
import { ensureAudioDirectory } from "@/utils/fileManager"; // <--- Importez la fonction ici
import {
  Lato_100Thin,
  Lato_300Light,
  Lato_400Regular,
  Lato_700Bold,
  Lato_900Black,
  useFonts,
} from "@expo-google-fonts/lato";
import { router, Stack } from "expo-router";
import { useEffect } from "react";
import { StatusBar, View } from "react-native";

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
    if (!fontsLoaded) return;

    const initApp = async () => {
      try {
        // Crée le dossier unique proprement au démarrage
        await ensureAudioDirectory();
      } catch (e) {
        // Gérer l'échec de la création du dossier si nécessaire
        console.error("Impossible d'initialiser l'espace de stockage", e);
      }

      if (!token || !isAuthenticated) {
        router.replace("/");
      } else {
        router.replace("/home");
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
