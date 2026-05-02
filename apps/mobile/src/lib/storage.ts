import { createClient } from "@supabase/supabase-js"
import * as FileSystem from "expo-file-system"

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

const RECEIPTS_BUCKET = "receipts"

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
 * Uploads a local image (file:// URI) to Supabase Storage.
 * Returns the public URL of the uploaded file.
 */
export async function uploadReceiptImage(localUri: string, userId: string): Promise<string> {
  const supabase = getSupabase()

  // Read file as base64, convert to ArrayBuffer
  const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 })
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    const ch = binary.charCodeAt(i)
    bytes[i] = ch
  }

  const path = `${userId}/${Date.now()}.jpg`

  const { error } = await supabase.storage.from(RECEIPTS_BUCKET).upload(path, bytes, {
    contentType: "image/jpeg",
    upsert: false,
  })
  if (error) throw new Error(`Upload failed: ${error.message}`)

  const { data } = supabase.storage.from(RECEIPTS_BUCKET).getPublicUrl(path)
  return data.publicUrl
}
