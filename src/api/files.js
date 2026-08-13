import { useAuthStore } from '../store/authStore'
import { API_BASE_URL, apiClient } from './client'

function isAbsoluteUrl(value) {
  return /^https?:\/\//i.test(String(value || '').trim())
}

export function getFileUrl(fileOrId) {
  if (!fileOrId) return ''

  if (typeof fileOrId === 'object') {
    return getFileUrl(fileOrId.url || fileOrId.file_url || fileOrId.fileUrl || fileOrId.file_id || fileOrId.fileId)
  }

  const value = String(fileOrId).trim()
  if (!value) return ''
  if (isAbsoluteUrl(value)) return value
  if (value.startsWith('/files/')) return `${API_BASE_URL.replace(/\/$/, '')}${value}`

  return `${API_BASE_URL.replace(/\/$/, '')}/files/${encodeURIComponent(value)}`
}

export async function getFile(fileId) {
  try {
    const { data } = await apiClient.get(`/files/${encodeURIComponent(fileId)}`)
    return { success: true, file: data, url: getFileUrl(fileId) }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to load file. Please try again.',
    )

    return { success: false, error: message }
  }
}

function formatApiError(errorData, fallbackMessage = 'Unable to upload file. Please try again.') {
  if (!errorData) return fallbackMessage
  if (typeof errorData === 'string') return errorData

  if (Array.isArray(errorData)) {
    return errorData.map((error) => formatApiError(error)).filter(Boolean).join(', ')
  }

  if (typeof errorData === 'object') {
    if (errorData.msg) {
      const field = Array.isArray(errorData.loc) ? errorData.loc.filter((part) => part !== 'body').join('.') : ''
      return field ? `${field}: ${errorData.msg}` : errorData.msg
    }

    if (errorData.message || errorData.error) {
      return formatApiError(errorData.message || errorData.error, fallbackMessage)
    }
  }

  return String(errorData)
}

function authHeader() {
  const accessToken = useAuthStore.getState().authTokens?.access_token
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
}

export async function uploadFile(file) {
  try {
    const formData = new FormData()
    formData.append('file', file)

    const { data } = await apiClient.post('/files/upload', formData, {
      headers: {
        ...authHeader(),
        'Content-Type': 'multipart/form-data',
      },
    })

    return { success: true, file: { ...data, url: getFileUrl(data?.url || data?.file_id) } }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to upload file. Please try again.',
    )

    return { success: false, error: message }
  }
}

// Discards an upload that was never attached to a record (e.g. the user picked a file then
// cancelled/reset the form before saving) - DELETE /files/{file_id}.
export async function deleteFile(fileId) {
  try {
    await apiClient.delete(`/files/${encodeURIComponent(fileId)}`, {
      headers: authHeader(),
    })

    return { success: true }
  } catch (error) {
    const errorData = error.response?.data
    const message = formatApiError(
      errorData?.detail || errorData?.message || errorData?.error || errorData,
      'Unable to remove the uploaded file. Please try again.',
    )

    return { success: false, error: message }
  }
}

export async function uploadFiles(files) {
  const uploadedFiles = []

  for (const file of files) {
    const result = await uploadFile(file)

    if (!result.success) {
      return { success: false, error: result.error, uploadedFiles }
    }

    uploadedFiles.push(result.file)
  }

  return { success: true, files: uploadedFiles }
}
