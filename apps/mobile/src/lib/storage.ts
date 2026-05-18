import { createClient } from "@supabase/supabase-js"
import * as FileSystem from "expo-file-system"

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

let supabaseClient: ReturnType<typeof createClient> | null = null

function getSupabase() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Supabase env vars not configured (EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY)")
  }
  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    })
  }
  return supabaseClient
}

/**
 * Uploads a local image (file:// URI) to a Supabase Storage bucket.
 * Returns the public URL of the uploaded file.
 *
 * Buckets must be created with public read access:
 *   - receipts (receipt photos)
 *   - checkins (venue check-in photos)
 */
async function uploadImage(bucket: string, localUri: string, userId: string): Promise<string> {
  const supabase = getSupabase()

  // Read file as base64, convert to byte array (RN-friendly: avoid Blob)
  const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 })
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    const ch = binary.charCodeAt(i)
    bytes[i] = ch
  }

  const path = `${userId}/${Date.now()}.jpg`

  const { error } = await supabase.storage.from(bucket).upload(path, bytes, {
    contentType: "image/jpeg",
    upsert: false,
  })
  if (error) throw new Error(`Upload failed: ${error.message}`)

  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}

export const uploadReceiptImage = (localUri: string, userId: string) => uploadImage("receipts", localUri, userId)
export const uploadCheckinImage = (localUri: string, userId: string) => uploadImage("checkins", localUri, userId)

/** Web-only: upload a File object (from <input type="file">) to the avatars bucket. */
export async function uploadAvatarFile(file: File, ownerKey: string): Promise<string> {
  const supabase = getSupabase()
  const ext = file.type.includes("png") ? "png" : "jpg"
  const path = `${ownerKey}/avatar.${ext}`
  const { error } = await supabase.storage.from("avatars").upload(path, file, {
    contentType: file.type || "image/jpeg",
    upsert: true,
  })
  if (error) throw new Error(`Avatar upload failed: ${error.message}`)
  const { data } = supabase.storage.from("avatars").getPublicUrl(path)
  return data.publicUrl
}
