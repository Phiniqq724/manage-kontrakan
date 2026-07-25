import {
  Image,
  Modal,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

/**
 * Full-screen, dark-backdrop image viewer. Renders as a React Native `Modal`,
 * so it layers above any `@expo/ui` sheet it is rendered alongside. Tap the
 * backdrop or the close button to dismiss.
 */
export function ImageViewerModal({
  uri,
  visible,
  onClose,
}: {
  uri: string | null;
  visible: boolean;
  onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();

  return (
    <Modal
      visible={visible && !!uri}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.94)",
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
        }}
      >
        {uri && (
          <Image
            source={{ uri }}
            style={{ width: width - 32, height: height - 160 }}
            resizeMode="contain"
          />
        )}
      </Pressable>

      <Pressable
        onPress={onClose}
        hitSlop={12}
        style={{
          position: "absolute",
          top: 48,
          right: 20,
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: "rgba(255,255,255,0.16)",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: "#fff", fontSize: 20, fontWeight: "700" }}>✕</Text>
      </Pressable>

      <Text
        style={{
          position: "absolute",
          bottom: 40,
          left: 0,
          right: 0,
          textAlign: "center",
          color: "rgba(255,255,255,0.7)",
          fontSize: 13,
        }}
      >
        Ketuk di mana saja untuk menutup
      </Text>
    </Modal>
  );
}
