import { useState } from 'react'
import { MapPin, CheckCircle, Clock, Calendar, Plus } from 'lucide-react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Card from '../../components/ui/Card'

const initialVisits = [
  { id: 1, customerName: 'Rajesh Kumar', checkIn: '2024-07-17 10:30 AM', checkOut: '2024-07-17 11:15 AM', notes: 'Discussed new product range, placed order for 100 units' },
  { id: 2, customerName: 'Priya Desai', checkIn: '2024-07-16 02:00 PM', checkOut: '2024-07-16 02:45 PM', notes: 'Follow-up on previous order, collected payment' },
]

export default function VisitCheckIn() {
  const [visits, setVisits] = useState(initialVisits)
  const [isCheckIn, setIsCheckIn] = useState(true)
  const [checkInData, setCheckInData] = useState({ customerName: '', notes: '' })
  const [activeVisitId, setActiveVisitId] = useState(null)

  const handleCheckIn = (e) => {
    e.preventDefault()
    const newVisit = {
      id: Date.now(),
      customerName: checkInData.customerName,
      checkIn: new Date().toLocaleString(),
      checkOut: null,
      notes: checkInData.notes,
    }
    setVisits([newVisit, ...visits])
    setActiveVisitId(newVisit.id)
    setIsCheckIn(false)
    setCheckInData({ customerName: '', notes: '' })
  }

  const handleCheckOut = (visitId, notes) => {
    setVisits(visits.map(v => v.id === visitId ? { ...v, checkOut: new Date().toLocaleString(), notes: notes || v.notes } : v))
    setActiveVisitId(null)
    setIsCheckIn(true)
  }

  const activeVisit = visits.find(v => v.id === activeVisitId)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Visits</h1>
          <p className="text-sm text-neutral-500">Check in/out of customer visits</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <Card>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-neutral-900 mb-6">
                {isCheckIn ? 'Check In' : 'Check Out'}
              </h3>

              {isCheckIn ? (
                <form onSubmit={handleCheckIn} className="space-y-4">
                  <Input
                    label="Customer Name"
                    value={checkInData.customerName}
                    onChange={(e) => setCheckInData({ ...checkInData, customerName: e.target.value })}
                    required
                  />
                  <Input
                    label="Notes (optional)"
                    as="textarea"
                    value={checkInData.notes}
                    onChange={(e) => setCheckInData({ ...checkInData, notes: e.target.value })}
                  />
                  <Button type="submit" className="w-full">
                    <MapPin className="size-4 mr-2" />
                    Check In
                  </Button>
                </form>
              ) : (
                activeVisit && (
                  <div className="space-y-4">
                    <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="size-5 text-green-700" />
                        <span className="font-semibold text-green-800">Checked In</span>
                      </div>
                      <p className="text-sm text-green-700 mb-1">{activeVisit.customerName}</p>
                      <p className="text-xs text-green-600">{activeVisit.checkIn}</p>
                    </div>
                    <Input
                      label="Check Out Notes"
                      as="textarea"
                      value={activeVisit.notes}
                      onChange={(e) => setVisits(visits.map(v => v.id === activeVisitId ? { ...v, notes: e.target.value } : v))}
                    />
                    <Button onClick={() => handleCheckOut(activeVisit.id)} className="w-full">
                      <CheckCircle className="size-4 mr-2" />
                      Check Out
                    </Button>
                  </div>
                )
              )}
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-lg font-semibold text-neutral-900">Visit History</h3>
          {visits.map((visit) => (
            <Card key={visit.id}>
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold text-neutral-900">{visit.customerName}</h4>
                    <div className="flex items-center gap-4 mt-2 text-xs text-neutral-500">
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" />
                        In: {visit.checkIn}
                      </span>
                      {visit.checkOut && (
                        <span className="flex items-center gap-1">
                          <Clock className="size-3" />
                          Out: {visit.checkOut}
                        </span>
                      )}
                    </div>
                  </div>
                  {visit.checkOut ? (
                    <span className="inline-flex items-center rounded-full bg-green-100 text-green-700 px-3 py-1 text-xs font-medium">
                      Completed
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-700 px-3 py-1 text-xs font-medium">
                      Active
                    </span>
                  )}
                </div>
                {visit.notes && (
                  <p className="mt-4 text-sm text-neutral-600 border-t border-neutral-100 pt-4">{visit.notes}</p>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
