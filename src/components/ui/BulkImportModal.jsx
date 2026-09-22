import { useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Upload, X } from 'lucide-react'
import Modal from './Modal'
import Button from './Button'
import Badge from './Badge'
import { useToast } from './toastContext'
import {
  BULK_IMPORT_MODULES,
  downloadBulkImportTemplate,
  importBulkFile,
} from '../../api/bulkImport'

const ACCEPTED_EXTENSION = '.xlsx'

function formatFileSize(bytes) {
  if (!bytes && bytes !== 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function downloadErrorReportCsv(moduleLabel, errors) {
  const header = 'Row,Field,Error'
  const rows = errors.map(({ row, field, error }) => {
    const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`
    return [row, escape(field), escape(error)].join(',')
  })
  const csv = [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${moduleLabel.replace(/\s+/g, '_').toLowerCase()}_import_errors.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

// STEP flow: pick -> selected -> validating -> result
export default function BulkImportModal({ isOpen, onClose, moduleKey, onImported }) {
  const { showToast } = useToast()
  const moduleConfig = BULK_IMPORT_MODULES[moduleKey] || { label: 'Records', templateFileName: 'import_template.xlsx' }
  const fileInputRef = useRef(null)

  const [selectedFile, setSelectedFile] = useState(null)
  const [fileError, setFileError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false)
  const [result, setResult] = useState(null) // { totalRows, validRows, invalidRows, createdIds, errors }

  const resetState = () => {
    setSelectedFile(null)
    setFileError('')
    setIsSubmitting(false)
    setResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleClose = () => {
    resetState()
    onClose()
  }

  const handleFileChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.name.toLowerCase().endsWith(ACCEPTED_EXTENSION)) {
      setFileError('Please select a .xlsx Excel file.')
      setSelectedFile(null)
      return
    }
    setFileError('')
    setSelectedFile(file)
    setResult(null)
  }

  const handleDownloadTemplate = async () => {
    setIsDownloadingTemplate(true)
    const response = await downloadBulkImportTemplate(moduleKey)
    setIsDownloadingTemplate(false)
    if (!response.success) {
      showToast({ title: 'Template unavailable', message: response.error, variant: 'error' })
    }
  }

  const handleValidateAndImport = async () => {
    if (!selectedFile || isSubmitting) return

    setIsSubmitting(true)
    const response = await importBulkFile(moduleKey, selectedFile)
    setIsSubmitting(false)

    if (!response.success) {
      showToast({ title: 'Import failed', message: response.error, variant: 'error' })
      return
    }

    setResult(response.data)

    if (response.data.validRows > 0) {
      showToast({
        title: 'Import complete',
        message: `${response.data.validRows} of ${response.data.totalRows} rows imported successfully.`,
        variant: 'success',
      })
      onImported?.()
    } else {
      showToast({
        title: 'No rows imported',
        message: 'Every row failed validation — see the errors below.',
        variant: 'error',
      })
    }
  }

  const handleImportAgain = () => {
    resetState()
  }

  return (
    <Modal isOpen={isOpen} onClose={isSubmitting ? () => {} : handleClose} title={`Bulk Import — ${moduleConfig.label}`} size="lg">
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-neutral-100 bg-neutral-50/60 px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-neutral-700">Need the correct format?</p>
            <p className="mt-0.5 text-xs text-neutral-400">Download the {moduleConfig.label.toLowerCase()} import template first.</p>
          </div>
          <Button type="button" variant="outline" size="sm" className="h-8 shrink-0 whitespace-nowrap rounded-lg px-3" loading={isDownloadingTemplate} onClick={handleDownloadTemplate}>
            <Download className="size-3.5" aria-hidden="true" />
            Download Template
          </Button>
        </div>

        {!result && (
          <div>
            <label
              className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors ${
                fileError ? 'border-red-200 bg-red-50/40' : 'border-neutral-200 bg-white hover:border-primary-300 hover:bg-primary-50/30'
              }`}
            >
              <FileSpreadsheet className="size-8 text-neutral-400" aria-hidden="true" />
              <p className="text-sm font-medium text-neutral-700">Drag & drop or click to choose an Excel file</p>
              <p className="text-xs text-neutral-400">Accepts .xlsx files only</p>
              <input ref={fileInputRef} type="file" accept=".xlsx" className="hidden" onChange={handleFileChange} disabled={isSubmitting} />
            </label>

            {fileError && (
              <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-red-600">
                <AlertCircle className="size-3.5" aria-hidden="true" />
                {fileError}
              </p>
            )}

            {selectedFile && !fileError && (
              <div className="mt-3 flex items-center justify-between rounded-lg border border-neutral-100 bg-neutral-50/60 px-3.5 py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <FileSpreadsheet className="size-4 shrink-0 text-primary-600" aria-hidden="true" />
                  <span className="truncate text-xs font-medium text-neutral-700">{selectedFile.name}</span>
                  <span className="shrink-0 text-xs text-neutral-400">{formatFileSize(selectedFile.size)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                  className="shrink-0 rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                  disabled={isSubmitting}
                  aria-label="Remove file"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            )}
          </div>
        )}

        {result && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-neutral-100 bg-neutral-50/60 px-4 py-3 text-center">
                <p className="text-xs font-medium text-neutral-400">Total Rows</p>
                <p className="mt-1 text-xl font-semibold text-neutral-900">{result.totalRows}</p>
              </div>
              <div className="rounded-xl border border-green-100 bg-green-50/60 px-4 py-3 text-center">
                <p className="text-xs font-medium text-green-600">Valid</p>
                <p className="mt-1 text-xl font-semibold text-green-700">{result.validRows}</p>
              </div>
              <div className="rounded-xl border border-red-100 bg-red-50/60 px-4 py-3 text-center">
                <p className="text-xs font-medium text-red-600">Failed</p>
                <p className="mt-1 text-xl font-semibold text-red-700">{result.invalidRows}</p>
              </div>
            </div>

            {result.validRows > 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-green-100 bg-green-50/60 px-3.5 py-2.5 text-xs font-medium text-green-700">
                <CheckCircle2 className="size-4" aria-hidden="true" />
                {result.validRows} row{result.validRows === 1 ? '' : 's'} imported successfully.
              </div>
            )}

            {result.errors?.length > 0 && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold text-neutral-700">Row Errors</p>
                  <Badge variant="danger">{result.errors.length} issue{result.errors.length === 1 ? '' : 's'}</Badge>
                </div>
                <div className="max-h-56 overflow-y-auto rounded-lg border border-neutral-100">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-neutral-50 text-neutral-500">
                      <tr>
                        <th className="px-3 py-2 font-medium">Row</th>
                        <th className="px-3 py-2 font-medium">Field</th>
                        <th className="px-3 py-2 font-medium">Error</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {result.errors.map((err, index) => (
                        <tr key={`${err.row}-${err.field}-${index}`}>
                          <td className="px-3 py-2 text-neutral-700">{err.row}</td>
                          <td className="px-3 py-2 text-neutral-700">{err.field}</td>
                          <td className="px-3 py-2 text-red-600">{err.error}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Button type="button" variant="outline" size="sm" className="mt-2 h-8 rounded-lg px-3" onClick={() => downloadErrorReportCsv(moduleConfig.label, result.errors)}>
                  <Download className="size-3.5" aria-hidden="true" />
                  Download Error Report
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-end gap-2 border-t border-neutral-100 pt-5">
        {!result ? (
          <>
            <Button type="button" variant="outline" size="sm" onClick={handleClose} disabled={isSubmitting}>Close</Button>
            <Button
              type="button"
              size="sm"
              onClick={handleValidateAndImport}
              disabled={!selectedFile || isSubmitting}
              loading={isSubmitting}
            >
              <Upload className="size-4" aria-hidden="true" />
              {isSubmitting ? 'Importing…' : 'Validate & Import'}
            </Button>
          </>
        ) : (
          <>
            <Button type="button" variant="outline" size="sm" onClick={handleImportAgain}>Import Again</Button>
            <Button type="button" size="sm" onClick={handleClose}>Close</Button>
          </>
        )}
      </div>
    </Modal>
  )
}
