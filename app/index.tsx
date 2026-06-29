import { useUserStore } from "@/lib/store";
import { API_URL } from "@/utils/envVariables";
import { COLORS, TEXT_SIZE } from "@/utils/theme";
import Feather from "@expo/vector-icons/Feather";
import axios, { isAxiosError } from "axios";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const DATA = [
  {
    type: "Connexion",
    title: "Re-bonjour,",
    subtitle: "Entrez vos identifiants pour vous connecter",
    footerText: "Pas de compte ?",
    footerAction: "S'inscrire",
  },
  {
    type: "Inscription",
    title: "Créer un compte,",
    subtitle: "Remplissez les champs pour commencer",
    footerText: "Déjà inscrit ?",
    footerAction: "Se connecter",
  },
];

export default function Index() {
  const [isSignin, setIsSignin] = useState(false);

  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordType, setPasswordType] = useState<"password" | "text">(
    "password",
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const login = useUserStore((state) => state.login);

  const currentContent = useMemo(
    () => (isSignin ? DATA[1] : DATA[0]),
    [isSignin],
  );

  // LOGIN
  const handleLogin = async () => {
    try {
      setError("");

      if (!phone.trim() || !password.trim()) {
        setError("Tous les champs sont obligatoires");
        return;
      }

      setLoading(true);

      const payload = {
        phone: phone.trim(),
        password: password.trim(),
      };

      const { data } = await axios.post(
        `${API_URL}/api/mobile/auth/login`,

        payload,
        {
          timeout: 15000,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      if (data.error) {
        setError(data.message);
        return;
      }

      login({
        token: data.token,
        user: data.user,
      });

      // router.replace("/(protected)");
    } catch (error) {
      console.log(error);

      if (isAxiosError(error)) {
        setError(error.response?.data?.message ?? "Impossible de se connecter");
      } else {
        setError("Oops, error inconnue !");
      }
    } finally {
      setLoading(false);
    }
  };

  // SIGN IN
  const handleSignin = async () => {
    try {
      setError("");

      if (!name.trim() || !phone.trim() || !password.trim()) {
        setError("Tous les champs sont obligatoires");
        return;
      }

      setLoading(true);

      const payload = {
        phone: phone.trim(),
        password: password.trim(),
        name: name.trim(),
      };

      const { data } = await axios.post(
        `${API_URL}/api/mobile/auth/signin`,
        payload,
        {
          timeout: 15000,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      if (data.error) {
        setError(data.message);
        return;
      }

      login({
        token: data.token,
        user: data.user,
      });

      // navigation
      // router.replace("/(protected)");
    } catch (error: any) {
      console.log(error);

      if (isAxiosError(error)) {
        setError(
          error.response?.data?.message ?? "Impossible de faire cette action",
        );
      } else {
        setError("Oops, error inconnue !");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    if (isSignin) {
      handleSignin();
    } else {
      handleLogin();
    }
  };

  if (!API_URL) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.headerContainer}>Pas de API URL</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* HEADER TEXTS */}
          <View style={styles.headerContainer}>
            <Text style={styles.title}>{currentContent.title}</Text>
            <Text style={styles.subTitle}>{currentContent.subtitle}</Text>
          </View>

          {/* FORMULAIRE */}
          <View style={styles.form}>
            {/* INPUT FULL NAME GROUP */}
            {isSignin && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Nom et Prénom</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.inputText}
                    placeholder="Jean Kabeya"
                    placeholderTextColor={COLORS.mutedText}
                    returnKeyType="next"
                    textContentType="name"
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <View style={styles.iconRight}>
                    <Feather name="user" size={18} color={COLORS.mutedText} />
                  </View>
                </View>
              </View>
            )}

            {/* INPUT PHONE GROUP */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Numéro de téléphone(0)</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.inputText}
                  placeholder="083 266 633"
                  placeholderTextColor={COLORS.mutedText}
                  maxLength={10}
                  returnKeyType="next"
                  textContentType="telephoneNumber"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="number-pad"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <View style={styles.iconRight}>
                  <Feather name="phone" size={18} color={COLORS.mutedText} />
                </View>
              </View>
            </View>

            {/* PASSWORD */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Mot de passe</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.inputText}
                  placeholder="••••••••••••"
                  placeholderTextColor={COLORS.mutedText}
                  maxLength={12}
                  returnKeyType="done"
                  textContentType="password"
                  value={password}
                  secureTextEntry={passwordType === "password"}
                  onChangeText={setPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="password"
                />
                <Pressable
                  style={styles.iconRight}
                  onPress={() =>
                    setPasswordType((val) =>
                      val === "password" ? "text" : "password",
                    )
                  }
                >
                  <Feather
                    name={passwordType === "password" ? "eye-off" : "eye"}
                    size={18}
                    color={COLORS.mutedText}
                  />
                </Pressable>
              </View>
            </View>

            {/* FORGOT PASSWORD */}
            {!isSignin && (
              <TouchableOpacity
                style={styles.forgotPasswordContainer}
                activeOpacity={0.7}
              >
                <Text style={styles.forgotPasswordText}>
                  Mot de passe oublié ?
                </Text>
              </TouchableOpacity>
            )}

            {/* MAIN BUTTON */}

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              disabled={loading}
              onPress={handleSubmit}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.buttonText} />
              ) : (
                <Text style={styles.buttonText}>{currentContent.type}</Text>
              )}
            </TouchableOpacity>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>

          {/* FOOTER SWITCH */}
          <View style={styles.footerContainer}>
            <Text style={styles.footerText}>{currentContent.footerText} </Text>
            <Pressable
              onPress={() => {
                setIsSignin((val) => !val);
                setError("");
              }}
              hitSlop={10}
            >
              <Text style={styles.footerActionText}>
                {currentContent.footerAction}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  headerContainer: {
    width: "100%",
    marginBottom: 24,
  },
  title: {
    fontSize: TEXT_SIZE["4xl"],
    fontFamily: "Lato_700Bold",
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  subTitle: {
    fontSize: TEXT_SIZE.base,
    fontFamily: "Lato_400Regular",
    color: COLORS.mutedText,
    marginTop: 6,
  },
  form: {
    width: "100%",
    gap: 20,
    marginBottom: 32,
  },
  inputGroup: {
    width: "100%",
    gap: 8,
  },
  label: {
    fontSize: TEXT_SIZE.sm,
    fontFamily: "Lato_500Medium",
    color: COLORS.text,
    opacity: 0.9,
  },
  inputWrapper: {
    width: "100%",
    position: "relative",
    justifyContent: "center",
  },
  inputText: {
    width: "100%",
    height: 52,
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    paddingLeft: 16,
    paddingRight: 48, // Évite que le texte passe sous l'icône
    borderRadius: 12,
    color: COLORS.text,
    fontSize: TEXT_SIZE.base,
    fontFamily: "Lato_400Regular",
  },
  iconRight: {
    position: "absolute",
    right: 16,
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  forgotPasswordContainer: {
    alignSelf: "flex-end",
    marginTop: -4,
  },
  forgotPasswordText: {
    color: COLORS.mutedText,
    fontSize: TEXT_SIZE.sm,
    fontFamily: "Lato_500Medium",
  },
  button: {
    backgroundColor: COLORS.primary,
    height: 52,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    marginTop: 10,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  buttonDisabled: {
    backgroundColor: COLORS.muted,
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    color: COLORS.buttonText,
    fontSize: TEXT_SIZE.base,
    fontFamily: "Lato_700Bold",
  },
  errorText: {
    color: COLORS.destructive,
    fontSize: TEXT_SIZE.sm,
    textAlign: "center",
    fontFamily: "Lato_500Medium",
  },
  footerContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
  footerText: {
    color: COLORS.mutedText,
    fontSize: TEXT_SIZE.base,
    fontFamily: "Lato_500Medium",
  },
  footerActionText: {
    color: COLORS.primary,
    fontSize: TEXT_SIZE.base,
    fontFamily: "Lato_700Bold",
  },
});
