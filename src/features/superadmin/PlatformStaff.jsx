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
import { listPlatformStaff, createPlatformStaff, updatePlatformStaff, changedStaffFields } from '../../api/platform'
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
  const columns = [
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
        actions={row => [{ label: 'Edit', onClick: () => edit(row) }, { label: row.is_active ? 'Deactivate' : 'Activate', onClick: () => { setTarget(row); setFormError('') } }]}
      />
    </Card>
    <Modal isOpen={editor !== null} onClose={() => !saving && setEditor(null)} title={editor?.id ? 'Edit Staff' : 'Add Staff'} footer={<><Button variant="outline" disabled={saving} onClick={() => setEditor(null)}>Cancel</Button><Button type="submit" form="platform-staff-form" loading={saving}>Save Staff</Button></>}>
      <form id="platform-staff-form" onSubmit={save} className="space-y-4"><PlatformError error={formError} /><fieldset disabled={saving} className="space-y-4">{['name', 'email', 'phone', 'password'].map(field => <Input key={field} label={({ name: 'Name', email: 'Email', phone: 'Phone', password: editor?.id ? 'New Password (optional)' : 'Password' })[field]} required={field === 'name' || field === 'email' || (field === 'password' && !editor?.id)} type={field === 'password' ? 'password' : field === 'email' ? 'email' : 'text'} autoComplete={field === 'password' ? 'new-password' : undefined} placeholder={field === 'phone' ? '+91 98765 43210' : undefined} value={draft[field]} error={fields[field]} onChange={event => setDraft(value => ({ ...value, [field]: event.target.value }))} />)}<Input label="Role" value="Sales Manager" readOnly error={fields.role} /></fieldset></form>
    </Modal>
    <Modal isOpen={!!target} onClose={() => !saving && setTarget(null)} title={target?.is_active ? 'Deactivate this staff member?' : 'Activate this staff member?'} footer={<><Button variant="outline" disabled={saving} onClick={() => setTarget(null)}>Cancel</Button><Button loading={saving} onClick={toggle}>Confirm</Button></>}>
      <PlatformError error={formError} /><p>{target?.is_active ? 'They will be signed out and will no longer be able to access Platform Operations.' : 'They will be able to sign in to Platform Operations again.'}</p>
    </Modal>
  </div>
}
