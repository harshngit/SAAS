export const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024
export const ORG_ASSET_MAX_SIZE_BYTES = 1 * 1024 * 1024

export function getImageFileError(file, maxSizeBytes = MAX_IMAGE_SIZE_BYTES) {
  if (!file.type.startsWith('image/')) {
    return `${file.name} is not an image file.`
  }

  if (file.size > maxSizeBytes) {
    return `${file.name} is larger than ${Math.round(maxSizeBytes / (1024 * 1024))}MB.`
  }

  return null
}

export function readImageAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error(`${file.name} is not an image file.`))
      return
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      reject(new Error(`${file.name} is larger than 2MB.`))
      return
    }

    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error(`Unable to read ${file.name}.`))
    reader.readAsDataURL(file)
  })
}
