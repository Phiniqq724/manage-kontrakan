import { useAppColors } from "@/components/AppHost";
import { pickPictureSize } from "@/utils/camera";
import { haptics } from "@/utils/haptics";
import { pickLocalImage, type LocalImage } from "@/utils/upload";
import Cameraswitch from "@expo/material-symbols/cameraswitch.xml";
import Close from "@expo/material-symbols/close.xml";
import PhotoLibrary from "@expo/material-symbols/photo_library.xml";
import {
  Box,
  Column,
  Icon,
  IconButton,
  RNHostView,
  Row,
  Text,
} from "@expo/ui/jetpack-compose";
import {
  align,
  alpha,
  animateContentSize,
  background,
  clickable,
  clip,
  fillMaxWidth,
  height,
  matchParentSize,
  padding,
  Shapes,
  size,
  width,
} from "@expo/ui/jetpack-compose/modifiers";
import { CameraView, useCameraPermissions, type CameraType } from "expo-camera";
import { useEffect, useRef, useState } from "react";
import { AppState, Image, useWindowDimensions, type ImageSourcePropType } from "react-native";

const SCRIM = "rgba(0,0,0,0.45)";
/** Wait for the grow animation (and the last camera's teardown) before starting the preview. */
const MOUNT_DELAY_MS = 320;

/** Usable width inside a FormSheet (24dp padding each side, Material's 640dp cap). */
export const useSheetContentWidth = () => Math.min(useWindowDimensions().width, 640) - 48;

/**
 * Photo box that grows into a live camera filling the sheet, then shrinks back
 * with the shot in it. Three states: empty (tap to open), live (shutter,
 * front/back switch, gallery, close) and taken (tap to retake). The owner folds the
 * rest of the sheet away while `live` (see `Collapse` / `FormSheet focused`).
 * The preview only runs while live and in the foreground.
 */
export const CameraSlot = ({
  label,
  icon,
  photo,
  live,
  slotHeight,
  slotWidth,
  liveWidth,
  asButton = false,
  onOpen,
  onClose,
  onCapture,
}: {
  label: string;
  icon: ImageSourcePropType;
  photo: LocalImage | null;
  live: boolean;
  slotHeight: number;
  /** Fixed width when the box shares a row; full width when omitted. */
  slotWidth?: number;
  /** Width while live; pair with `slotWidth`. */
  liveWidth?: number;
  /** Empty state is a tonal button; the photo then gets a box shaped like the shot. */
  asButton?: boolean;
  onOpen: () => void;
  onClose: () => void;
  onCapture: (photo: LocalImage) => void;
}) => {
  const colors = useAppColors();
  const liveHeight = Math.round(useWindowDimensions().height * 0.68);
  const contentWidth = useSheetContentWidth();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [appActive, setAppActive] = useState(AppState.currentState === "active");
  const [mounted, setMounted] = useState(false);
  const [facing, setFacing] = useState<CameraType>("back");
  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [pictureSize, setPictureSize] = useState<string>();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => setAppActive(s === "active"));
    return () => sub.remove();
  }, []);

  // Ask for camera access when the slot goes live; back to the box if refused.
  useEffect(() => {
    if (!live || !permission || permission.granted) return;
    if (!permission.canAskAgain) {
      alert("Izin kamera ditolak. Aktifkan di pengaturan.");
      onCloseRef.current();
      return;
    }
    requestPermission().then((res) => {
      if (!res.granted) onCloseRef.current();
    });
  }, [live, permission, requestPermission]);

  // Start the preview once the box has grown; reset everything when it closes.
  useEffect(() => {
    if (!live) {
      setMounted(false);
      setReady(false);
      setCapturing(false);
      setFacing("back");
      setPictureSize(undefined);
      return;
    }
    const timer = setTimeout(() => setMounted(true), MOUNT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [live]);

  // Fires again after every lens switch; sizes differ per lens.
  const handleReady = async () => {
    setReady(true);
    try {
      const sizes = await cameraRef.current?.getAvailablePictureSizesAsync();
      const best = sizes ? pickPictureSize(sizes) : undefined;
      if (best) setPictureSize((cur) => (cur === best ? cur : best));
    } catch {
      // Keep the camera default.
    }
  };

  const handleShutter = async () => {
    if (!ready || capturing) return;
    setCapturing(true);
    try {
      haptics.shutter();
      const shot = await cameraRef.current?.takePictureAsync({ quality: 0.8 });
      if (shot) onCapture({ uri: shot.uri, width: shot.width, height: shot.height });
    } catch (err: any) {
      haptics.error();
      alert(err.message);
    } finally {
      setCapturing(false);
    }
  };

  const pickFromGallery = async () => {
    const picked = await pickLocalImage();
    if (picked) onCapture(picked);
  };

  // Same view, new lens: remounting would let the old view's teardown unbind the new camera.
  const flip = () => {
    if (!ready) return;
    haptics.tick();
    setReady(false);
    setPictureSize(undefined);
    setFacing((f) => (f === "back" ? "front" : "back"));
  };

  const w = live ? liveWidth : slotWidth;
  const button = asButton && !live && !photo;
  // Button mode sizes the box to the shot (capped), so the whole photo shows uncropped.
  const photoHeight =
    asButton && photo
      ? Math.min(Math.round(((slotWidth ?? contentWidth) * photo.height) / photo.width), liveHeight)
      : slotHeight;
  const box = [
    w ? width(w) : fillMaxWidth(),
    animateContentSize(),
    height(live ? liveHeight : button ? 48 : photoHeight),
    clip(Shapes.RoundedCorner(live ? 24 : button ? 24 : 16)),
    background(
      live ? "#000000" : button ? colors.secondaryContainer : colors.surfaceContainerHigh,
    ),
  ];

  if (live) {
    const showCamera = mounted && appActive && !!permission?.granted;
    return (
      <Box modifiers={box}>
        {/* Own keys: reusing one host for camera then photo kept the camera's last frame on screen. */}
        {showCamera ? (
          <RNHostView key="camera">
            <CameraView
              ref={cameraRef}
              style={{ flex: 1 }}
              facing={facing}
              mirror
              pictureSize={pictureSize}
              onCameraReady={handleReady}
              onMountError={(e) => {
                alert(e.message);
                onClose();
              }}
            />
          </RNHostView>
        ) : null}

        <IconButton
          onClick={onClose}
          colors={{ containerColor: SCRIM }}
          modifiers={[align("topEnd"), padding(0, 12, 12, 0)]}
        >
          <Icon source={Close} tint="#FFFFFF" size={22} />
        </IconButton>

        {/* Gallery, shutter, lens switch. */}
        <Row
          verticalAlignment="center"
          horizontalArrangement={{ spacedBy: 28 }}
          modifiers={[align("bottomCenter"), padding(0, 0, 0, 20)]}
        >
          <IconButton
            onClick={pickFromGallery}
            colors={{ containerColor: SCRIM }}
            modifiers={[size(48, 48)]}
          >
            <Icon source={PhotoLibrary} tint="#FFFFFF" size={24} />
          </IconButton>
          <Box
            contentAlignment="center"
            modifiers={[
              size(72, 72),
              clip(Shapes.Circle),
              background("rgba(255,255,255,0.35)"),
              clickable(handleShutter),
            ]}
          >
            <Box
              modifiers={[
                size(56, 56),
                clip(Shapes.Circle),
                background("#FFFFFF"),
                alpha(ready && !capturing ? 1 : 0.5),
              ]}
            />
          </Box>
          <IconButton
            onClick={flip}
            colors={{ containerColor: SCRIM }}
            modifiers={[size(48, 48)]}
          >
            <Icon source={Cameraswitch} tint="#FFFFFF" size={24} />
          </IconButton>
        </Row>
      </Box>
    );
  }

  if (photo) {
    return (
      <Box modifiers={box}>
        <RNHostView key="photo">
          <Image source={{ uri: photo.uri }} style={{ width: "100%", height: "100%" }} resizeMode="contain" />
        </RNHostView>
        {/* Over the image so the tap reaches Compose: retake. */}
        <Box modifiers={[matchParentSize(), clickable(onOpen)]} />
      </Box>
    );
  }

  if (button) {
    return (
      <Box contentAlignment="center" modifiers={[...box, clickable(onOpen)]}>
        <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 8 }}>
          <Icon source={icon} tint={colors.onSecondaryContainer} size={20} />
          <Text
            style={{ typography: "labelLarge", fontWeight: "bold" }}
            color={colors.onSecondaryContainer}
          >
            {label}
          </Text>
        </Row>
      </Box>
    );
  }

  return (
    <Box contentAlignment="center" modifiers={[...box, clickable(onOpen)]}>
      <Column horizontalAlignment="center" verticalArrangement={{ spacedBy: 8 }}>
        <Icon source={icon} tint={colors.primary} size={32} />
        <Text style={{ typography: "labelLarge" }} color={colors.onSurfaceVariant}>
          {label}
        </Text>
      </Column>
    </Box>
  );
};
