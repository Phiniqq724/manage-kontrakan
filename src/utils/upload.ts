import * as ImagePicker from "expo-image-picker";
import { supabase } from "./supabase";

/** Decodes a base64 string to ArrayBuffer — avoids the Hermes blob limitation. */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
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
    quality: 0.7,
    base64: true,
  });

  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  if (!asset.base64) throw new Error("Gagal membaca data gambar.");

  const ext = (asset.uri.split(".").pop() ?? "jpg").toLowerCase();
  const fileName = `${Date.now()}.${ext}`;
  const path = `${folder}/${fileName}`;
  const contentType = `image/${ext === "jpg" ? "jpeg" : ext}`;

  const arrayBuffer = base64ToArrayBuffer(asset.base64);

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, arrayBuffer, { contentType });

  if (error) throw error;

  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(data.path);

  return publicUrl;
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
    quality: 0.7,
    base64: true,
  });

  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  if (!asset.base64) throw new Error("Gagal membaca data gambar.");

  const ext = (asset.uri.split(".").pop() ?? "jpg").toLowerCase();
  const fileName = `${Date.now()}.${ext}`;
  const path = `${folder}/${fileName}`;
  const contentType = `image/${ext === "jpg" ? "jpeg" : ext}`;

  const arrayBuffer = base64ToArrayBuffer(asset.base64);

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, arrayBuffer, { contentType });

  if (error) throw error;

  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(data.path);

  return publicUrl;
}
