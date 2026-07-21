import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "./supabase";

const MAX_DIMENSION = 1080;

/** Decodes a base64 string to ArrayBuffer — avoids the Hermes blob limitation. */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Downscales an image to at most MAX_DIMENSION on its longest side and
 * re-encodes it as compressed JPEG, so uploads stay small and load quickly
 * on the phones viewing them later. Never upscales a smaller source image.
 */
async function resizeAndCompress(asset: ImagePicker.ImagePickerAsset) {
  const longestSide = Math.max(asset.width, asset.height);
  const context = ImageManipulator.ImageManipulator.manipulate(asset.uri);
  if (longestSide > MAX_DIMENSION) {
    const scale = MAX_DIMENSION / longestSide;
    context.resize({
      width: Math.round(asset.width * scale),
      height: Math.round(asset.height * scale),
    });
  }
  const rendered = await context.renderAsync();
  return rendered.saveAsync({
    compress: 0.7,
    format: ImageManipulator.SaveFormat.JPEG,
    base64: true,
  });
}

async function uploadResizedAsset(
  asset: ImagePicker.ImagePickerAsset,
  bucket: string,
  folder: string,
): Promise<string> {
  const resized = await resizeAndCompress(asset);
  if (!resized.base64) throw new Error("Gagal memproses gambar.");

  const fileName = `${Date.now()}.jpg`;
  const path = `${folder}/${fileName}`;
  const arrayBuffer = base64ToArrayBuffer(resized.base64);

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, arrayBuffer, { contentType: "image/jpeg" });

  if (error) throw error;

  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(data.path);

  return publicUrl;
}

/** Open the camera, capture a photo, and upload it to Supabase Storage. Returns the public URL. */
export async function captureAndUploadImage(
  bucket: string,
  folder: string,
): Promise<string | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== "granted") {
    alert("Izin akses kamera diperlukan untuk mengambil foto.");
    return null;
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ["images"],
    quality: 1,
  });

  if (result.canceled || !result.assets[0]) return null;

  return uploadResizedAsset(result.assets[0], bucket, folder);
}

/** Pick an image from the gallery and upload it to Supabase Storage. Returns the public URL. */
export async function pickAndUploadImage(
  bucket: string,
  folder: string,
): Promise<string | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== "granted") {
    alert("Izin akses galeri diperlukan untuk mengunggah foto.");
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 1,
  });

  if (result.canceled || !result.assets[0]) return null;

  return uploadResizedAsset(result.assets[0], bucket, folder);
}
