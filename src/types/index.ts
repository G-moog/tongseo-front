export interface UserProfile {
  id: string
  email: string
  nickname: string | null
  api_key: string | null
  default_manual_category: string | null
  trash_days: number
  notification_enabled: boolean
  ai_classify_enabled: boolean
  created_at: string
}

export interface Category {
  id: string
  user_id: string
  name: string
  emoji: string | null
  color: string | null
  is_default: boolean
  created_at: string
}

export interface Note {
  id: string
  user_id: string
  content: string
  title: string | null
  summary: string | null
  category: string | null
  is_manual: boolean
  manual_category: string | null
  remind_at: string | null
  reminded_at: string | null
  is_deleted: boolean
  deleted_at: string | null
  image_urls: string[] | null
  created_at: string
  updated_at: string
}
