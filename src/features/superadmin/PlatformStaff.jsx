import { useCallback, useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Modal from '../../components/ui/Modal'
import Badge from '../../components/ui/Badge'
import DataTable from '../../components/ui/DataTable'
import { useToast } from '../../components/ui/toastContext'
import { listPlatformStaff, createPlatformStaff, updatePlatformStaff, deletePlatformStaff, bulkDeletePlatformStaff, changedStaffFields } from '../../api/platform'
import SuperAdminPageHeader from './SuperAdminPageHeader'
import { dateLabel } from './platformHelpers'
import { PlatformError } from './platformPresentation'

const blank = { name: '', email: '', phone: '', password: '', role: 'sales_manager' }
export default function PlatformStaff() {
  const { showToast } = useToast()
  const [rows, setRows] = useState([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [tick, setTick] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editor, setEditor] = useState(null)
  const [draft, setDraft] = useState(blank)
  const [fields, setFields] = useState({})
  const [saving, setSaving] = useState(false)
  const [target, setTarget] = useState(null)
  const [formError, setFormError] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [deleteConfirm, setDeleteConfirm] = useState(null) // { mode: 'single', row } | { mode: 'bulk', ids }
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const refresh = useCallback(() => setTick(value => value + 1), [])
  useEffect(() => {
    let active = true
    setLoading(true)
    const timer = setTimeout(async () => {
      const result = await listPlatformStaff({ search, is_active: status === '' ? undefined : status === 'true' })
      if (!active) return
      setLoading(false)
      setError(result.success ? '' : result.error)
      setRows(result.success ? result.staff : [])
    }, 250)
    return () => { active = false; clearTimeout(timer) }
  }, [search, status, tick])
  useEffect(() => { setSelectedIds([]) }, [search, status])
  function edit(row) {
    setEditor(row || {})
    setDraft(row ? { name: row.name || '', email: row.email || '', phone: row.phone || '', role: 'sales_manager', password: '' } : { ...blank })
    setFields({}); setFormError('')
  }
  async function save(event) {
    event.preventDefault()
    const errors = {}
    if (!draft.name.trim()) errors.name = 'Name is required.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) errors.email = 'Enter a valid email.'
    if ((!editor.id || draft.password) && draft.password.length < 8) errors.password = 'Use at least 8 characters.'
    setFields(errors)
    if (Object.keys(errors).length) return
    setSaving(true); setFormError('')
    const values = { ...draft, name: draft.name.trim(), email: draft.email.trim(), phone: draft.phone.trim(), role: 'sales_manager' }
    const original = { ...editor, phone: editor.phone || '', role: 'sales_manager' }
    const createValues = { ...values }
    if (!createValues.phone) delete createValues.phone
    const result = editor.id ? await updatePlatformStaff(editor.id, changedStaffFields(original, values)) : await createPlatformStaff(createValues)
    setSaving(false)
    if (!result.success) { setFields(result.fieldErrors || {}); setFormError(result.error); return }
    setEditor(null); refresh(); showToast({ title: editor.id ? 'Staff updated' : 'Staff added' })
  }
  async function toggle() {
    setSaving(true); setFormError('')
    const result = await updatePlatformStaff(target.id, { is_active: !target.is_active })
    setSaving(false)
    if (!result.success) { setFormError(result.error); return }
    setTarget(null); refresh(); showToast({ title: 'Staff status updated' })
  }
  async function confirmDelete() {
    setDeleting(true); setDeleteError('')
    const result = deleteConfirm.mode === 'bulk'
      ? await bulkDeletePlatformStaff(deleteConfirm.ids)
      : await deletePlatformStaff(deleteConfirm.row.id)
    setDeleting(false)
    if (!result.success) {
      // 404 means the row(s) were already gone (someone else deleted them, or - for bulk - one id
      // in the batch wasn't platform staff, which rolls back the WHOLE request) - refresh so the
      // list matches reality instead of leaving stale rows on screen.
      if (result.status === 404) {
        setDeleteConfirm(null); setSelectedIds([]); refresh()
        showToast({ title: deleteConfirm.mode === 'bulk' ? 'Some selected staff no longer exist' : 'Already removed', message: 'The list has been refreshed.', variant: 'error' })
        return
      }
      setDeleteError(result.error)
      return
    }
    const count = deleteConfirm.mode === 'bulk' ? deleteConfirm.ids.length : 1
    setDeleteConfirm(null); setSelectedIds([]); refresh()
    showToast({ title: count === 1 ? 'Staff member deleted' : `${count} staff members deleted` })
  }
  const allSelected = rows.length > 0 && selectedIds.length === rows.length
  const columns = [
    {
      key: '_select',
      header: (
        <input
          type="checkbox"
          checked={allSelected}
          ref={el => { if (el) el.indeterminate = selectedIds.length > 0 && !allSelected }}
          onChange={() => setSelectedIds(allSelected ? [] : rows.map(row => row.id))}
          aria-label="Select all staff"
          className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500/20"
        />
      ),
      render: row => (
        <input
          type="checkbox"
          checked={selectedIds.includes(row.id)}
          onChange={() => setSelectedIds(current => current.includes(row.id) ? current.filter(id => id !== row.id) : [...current, row.id])}
          onClick={event => event.stopPropagation()}
          aria-label={`Select ${row.name}`}
          className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500/20"
        />
      ),
    },
    { key: 'name', header: 'Name', sortable: true },
    { key: 'email', header: 'Email', sortable: true },
    { key: 'phone', header: 'Phone', sortable: true, render: row => row.phone || 'Not provided' },
    { key: 'role', header: 'Role', render: () => 'Sales Manager' },
    { key: 'is_active', header: 'Status', sortable: true, render: row => <Badge variant={row.is_active ? 'success' : 'neutral'} dot>{row.is_active ? 'Active' : 'Inactive'}</Badge> },
    { key: 'last_login', header: 'Last Login', sortable: true, render: row => dateLabel(row.last_login) },
  ]
  return <div className="listing-page space-y-4">
    <SuperAdminPageHeader title="Platform Staff" subtitle="Manage internal staff who can assist with organizations and customer requests." actions={<Button onClick={() => edit(null)}>+ Add Staff</Button>} />
    <Card>
      <PlatformError error={error} retry={refresh} />
      {selectedIds.length > 0 && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl bg-primary-50 px-4 py-2.5">
          <p className="text-sm font-medium text-primary-900">{selectedIds.length} selected</p>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              className="border-red-200 text-red-600 hover:bg-red-50"
              onClick={() => { setDeleteConfirm({ mode: 'bulk', ids: selectedIds }); setDeleteError('') }}
            >
              Delete selected
            </Button>
            <button type="button" onClick={() => setSelectedIds([])} className="text-sm font-medium text-neutral-500 hover:text-neutral-900">
              Clear
            </button>
          </div>
        </div>
      )}
      <DataTable
        columns={columns}
        data={rows}
        loading={loading}
        searchable={false}
        emptyTitle="No staff found"
        renderToolbar={({ resultCount }) => (
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="font-(--font-display) text-base font-semibold tracking-tight text-fg">Platform Staff Accounts</h3>
              <p className="mt-2 text-xs font-medium text-neutral-400">{resultCount} {resultCount === 1 ? 'result' : 'results'}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
                <input
                  type="text"
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  placeholder="Search staff..."
                  className="w-full rounded-full border border-neutral-100 bg-neutral-50 py-2.5 pl-10 pr-4 text-sm text-neutral-700 shadow-(--shadow-xs) transition-all placeholder:text-neutral-400 focus:border-primary-400 focus:bg-(--modal-bg) focus:outline-none focus:ring-4 focus:ring-primary-500/12"
                />
              </div>
              <Select
                value={status}
                onChange={event => setStatus(event.target.value)}
                options={[{ value: '', label: 'All staff' }, { value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }]}
                className="w-36"
                triggerClassName="h-9 rounded-xl bg-surface py-1.5 text-xs"
              />
            </div>
          </div>
        )}
        actions={row => [
          { label: 'Edit', onClick: () => edit(row) },
          { label: row.is_active ? 'Deactivate' : 'Activate', onClick: () => { setTarget(row); setFormError('') } },
          { label: 'Delete', danger: true, onClick: () => { setDeleteConfirm({ mode: 'single', row }); setDeleteError('') } },
        ]}
      />
    </Card>
    <Modal isOpen={editor !== null} onClose={() => !saving && setEditor(null)} title={editor?.id ? 'Edit Staff' : 'Add Staff'} footer={<><Button variant="outline" disabled={saving} onClick={() => setEditor(null)}>Cancel</Button><Button type="submit" form="platform-staff-form" loading={saving}>Save Staff</Button></>}>
      <form id="platform-staff-form" onSubmit={save} className="space-y-4"><PlatformError error={formError} /><fieldset disabled={saving} className="space-y-4">{['name', 'email', 'phone', 'password'].map(field => <Input key={field} label={({ name: 'Name', email: 'Email', phone: 'Phone', password: editor?.id ? 'New Password (optional)' : 'Password' })[field]} required={field === 'name' || field === 'email' || (field === 'password' && !editor?.id)} type={field === 'password' ? 'password' : field === 'email' ? 'email' : 'text'} autoComplete={field === 'password' ? 'new-password' : undefined} placeholder={field === 'phone' ? '+91 98765 43210' : undefined} value={draft[field]} error={fields[field]} onChange={event => setDraft(value => ({ ...value, [field]: event.target.value }))} />)}<Input label="Role" value="Sales Manager" readOnly error={fields.role} /></fieldset></form>
    </Modal>
    <Modal isOpen={!!target} onClose={() => !saving && setTarget(null)} title={target?.is_active ? 'Deactivate this staff member?' : 'Activate this staff member?'} footer={<><Button variant="outline" disabled={saving} onClick={() => setTarget(null)}>Cancel</Button><Button loading={saving} onClick={toggle}>Confirm</Button></>}>
      <PlatformError error={formError} /><p>{target?.is_active ? 'They will be signed out and will no longer be able to access Platform Operations.' : 'They will be able to sign in to Platform Operations again.'}</p>
    </Modal>
    <Modal
      isOpen={!!deleteConfirm}
      onClose={() => !deleting && setDeleteConfirm(null)}
      title={deleteConfirm?.mode === 'bulk' ? `Permanently delete ${deleteConfirm.ids.length} staff members?` : `Permanently delete ${deleteConfirm?.row?.name}?`}
      footer={<><Button variant="outline" disabled={deleting} onClick={() => setDeleteConfirm(null)}>Cancel</Button><Button variant="danger" loading={deleting} onClick={confirmDelete}>Delete permanently</Button></>}
    >
      <PlatformError error={deleteError} />
      <p>They are signed out immediately and this can&apos;t be undone. Upgrade and feature requests they raised are kept, shown as "Deleted user".</p>
    </Modal>
  </div>
}
