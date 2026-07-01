import { useUserStore } from "@/lib/store";
import { ensureAudioDirectory } from "@/utils/fileManager"; // <--- Importez la fonction ici
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

SplashScreen.preventAutoHideAsync();

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
      const start = Date.now();

      try {
        await ensureAudioDirectory();

        const elapsed = Date.now() - start;
        const remaining = Math.max(0, 5000 - elapsed);

        await new Promise((resolve) => setTimeout(resolve, remaining));

        if (!token || !isAuthenticated) {
          router.replace("/");
        } else {
          router.replace("/home");
        }
      } finally {
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
