import { supabase } from './supabase'

export async function uploadImages(userId: string, files: File[]): Promise<string[]> {
  const urls: string[] = []
  for (const file of files) {
    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
    const { error } = await supabase.storage
      .from('note-images')
      .upload(path, file, { upsert: false })
    if (error) throw error
    const { data } = supabase.storage.from('note-images').getPublicUrl(path)
    urls.push(data.publicUrl)
  }
  return urls
}

export async function deleteImages(urls: string[]): Promise<void> {
  const paths = urls.map(url => {
    // publicUrl 형태에서 버킷 이후 경로 추출
    const match = url.match(/note-images\/(.+)$/)
    return match ? match[1] : null
  }).filter(Boolean) as string[]
  if (paths.length === 0) return
  await supabase.storage.from('note-images').remove(paths)
}
