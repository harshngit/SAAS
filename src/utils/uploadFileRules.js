import { MAX_IMAGE_SIZE_BYTES } from './imageFile'

// What each upload field accepts. Checked in JavaScript before anything is sent - the <input accept=""> hint
// alone is not enough (it can be bypassed with "All files", drag and drop or a renamed file).
// A file passes when its extension is allowed AND, when the browser reports a MIME type, that type is allowed too.
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

const RULES = {
  pdf: { extensions: ['pdf'], mimes: ['application/pdf'], message: 'Please upload a valid PDF file.' },
  image: {
    extensions: ['png', 'jpg', 'jpeg', 'webp'],
    mimes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
    message: 'Please upload a PNG, JPG, JPEG or WebP image.',
    maxBytes: MAX_IMAGE_SIZE_BYTES,
  },
  attachment: {
    extensions: ['pdf', 'docx', 'png', 'jpg', 'jpeg'],
    mimes: ['application/pdf', DOCX_MIME, 'image/png', 'image/jpeg', 'image/jpg'],
    message: 'Please upload a PDF, DOCX, PNG or JPG file.',
  },
  download: {
    extensions: ['zip', 'pdf', 'png', 'jpg', 'jpeg', 'webp', 'gif'],
    mimes: ['application/zip', 'application/x-zip-compressed', 'application/x-zip', 'application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'],
    message: 'Please upload a ZIP, PDF or image file.',
  },
  video: {
    extensions: ['mp4', 'webm', 'ogg', 'ogv', 'mov'],
    mimePrefix: 'video/',
    message: 'Please upload a valid video file (MP4, WebM or OGG).',
  },
}

// product form field -> rule
export const PRODUCT_FIELD_FILE_KIND = {
  catalogBrochure: 'pdf',
  productManual: 'pdf',
  productDatasheet: 'pdf',
  complianceCertificate: 'pdf',
  warrantyDocument: 'pdf',
  otherAttachmentsName: 'attachment',
  downloadFile: 'download',
  videoUrl: 'video',
  coverImage: 'image',
  images: 'image',
}

// Returns an error message, or null when the file is fine.
export function getUploadFileError(file, kind) {
  const rule = RULES[kind]
  if (!file || !rule) return null
  const extension = String(file.name || '').split('.').pop().toLowerCase()
  const extensionOk = rule.extensions.includes(extension)
  const type = String(file.type || '').toLowerCase()
  const typeOk = !type || (rule.mimePrefix ? type.startsWith(rule.mimePrefix) : rule.mimes.includes(type))
  if (!extensionOk || !typeOk) return rule.message
  if (rule.maxBytes && file.size > rule.maxBytes) return `${file.name} is larger than ${Math.round(rule.maxBytes / (1024 * 1024))}MB.`
  return null
}

// "PDF, JPG or PNG" style text built from the SAME extension list the check above uses, so the hint shown next to an
// upload field can never drift from what is really accepted.
export function getAcceptedTypesLabel(kind) {
  const rule = RULES[kind]
  if (!rule || !rule.extensions) return ''
  const shown = []
  for (const extension of rule.extensions) {
    const label = extension.toUpperCase()
    if (!shown.includes(label)) shown.push(label)
  }
  return shown.join(', ')
}
