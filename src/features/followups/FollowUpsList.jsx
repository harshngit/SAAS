import { useState } from 'react'
import { Plus, Edit, Trash2, Calendar, CheckCircle, Clock, User } from 'lucide-react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Card from '../../components/ui/Card'
import Modal from '../../components/ui/Modal'

const initialFollowUps = [
  { id: 1, customerName: 'Rajesh Kumar', date: '2024-07-19', time: '11:00 AM', notes: 'Follow-up on new order', status: 'pending' },
  { id: 2, customerName: 'Priya Desai', date: '2024-07-18', time: '03:00 PM', notes: 'Collect payment', status: 'completed' },
  { id: 3, customerName: 'Amit Sharma', date: '2024-07-20', time: '10:00 AM', notes: 'Discuss bulk pricing', status: 'pending' },
]

export default function FollowUpsList() {
  const [followUps, setFollowUps] = useState(initialFollowUps)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingFollowUp, setEditingFollowUp] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [formData, setFormData] = useState({
    customerName: '',
    date: new Date().toISOString().split('T')[0],
    time: '10:00',
    notes: '',
    status: 'pending',
  })

  const handleAddFollowUp = () => {
    setEditingFollowUp(null)
    setFormData({
      customerName: '',
      date: new Date().toISOString().split('T')[0],
      time: '10:00',
      notes: '',
      status: 'pending',
    })
    setIsModalOpen(true)
  }

  const handleEditFollowUp = (followUp) => {
    setEditingFollowUp(followUp)
    setFormData(followUp)
    setIsModalOpen(true)
  }

  const handleConfirmDelete = () => {
    if (!deleteTarget) return
    setFollowUps(followUps.filter(f => f.id !== deleteTarget.id))
    setDeleteTarget(null)
  }

  const handleSaveFollowUp = (e) => {
    e.preventDefault()
    if (editingFollowUp) {
      setFollowUps(followUps.map(f => f.id === editingFollowUp.id ? { ...f, ...formData } : f))
    } else {
      setFollowUps([...followUps, { ...formData, id: Date.now() }])
    }
    setIsModalOpen(false)
  }

  const toggleStatus = (id) => {
    setFollowUps(followUps.map(f => f.id === id ? { ...f, status: f.status === 'pending' ? 'completed' : 'pending' } : f))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Follow-ups</h1>
          <p className="text-sm text-neutral-500">Track and manage your customer follow-ups</p>
        </div>
        <Button onClick={handleAddFollowUp}>
          <Plus className="size-4 mr-2" />
          Add Follow-up
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {followUps.map((followUp) => (
          <Card key={followUp.id} className={`hover:shadow-lg transition-all ${followUp.status === 'completed' ? 'opacity-75' : ''}`}>
            <div className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`flex size-10 items-center justify-center rounded-xl ${followUp.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                    {followUp.status === 'completed' ? <CheckCircle className="size-5" /> : <Calendar className="size-5" />}
                  </div>
                  <div>
                    <h3 className="font-semibold text-neutral-900">{followUp.customerName}</h3>
                    <p className="text-xs text-neutral-500">{followUp.date} at {followUp.time}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => toggleStatus(followUp.id)}
                    className="p-2 text-neutral-500 hover:text-green-600 hover:bg-green-50 rounded-lg"
                  >
                    <CheckCircle className="size-4" />
                  </button>
                  <button
                    onClick={() => handleEditFollowUp(followUp)}
                    className="p-2 text-neutral-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg"
                  >
                    <Edit className="size-4" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(followUp)}
                    className="p-2 text-neutral-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
              <p className="mt-4 text-sm text-neutral-600">{followUp.notes}</p>
              <div className="mt-4 flex items-center justify-between">
                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${followUp.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                  {followUp.status === 'completed' ? 'Completed' : 'Pending'}
                </span>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingFollowUp ? 'Edit Follow-up' : 'Add Follow-up'}>
        <form onSubmit={handleSaveFollowUp} className="space-y-4">
          <Input
            label="Customer Name"
            value={formData.customerName}
            onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Date"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
            <Input
              label="Time"
              type="time"
              value={formData.time}
              onChange={(e) => setFormData({ ...formData, time: e.target.value })}
              required
            />
          </div>
          <Input
            label="Notes"
            as="textarea"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit">{editingFollowUp ? 'Update' : 'Add'} Follow-up</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} title="Delete Follow-up">
        <div className="space-y-5">
          <p className="text-sm leading-6 text-neutral-600">
            Delete the follow-up for {deleteTarget?.customerName || 'this customer'}? This cannot be undone.
          </p>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button type="button" variant="danger" onClick={handleConfirmDelete}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
