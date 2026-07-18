import { useState } from 'react'
import { Plus, Edit, Trash2, User, Phone, MapPin } from 'lucide-react'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import CustomerForm from './CustomerForm'

const initialCustomers = [
  { id: 1, name: 'Rajesh Kumar', email: 'rajesh@example.com', phone: '+91 9876543210', address: '123 Main St, Mumbai', city: 'Mumbai' },
  { id: 2, name: 'Priya Desai', email: 'priya@example.com', phone: '+91 9876543211', address: '456 High St, Pune', city: 'Pune' },
  { id: 3, name: 'Amit Sharma', email: 'amit@example.com', phone: '+91 9876543212', address: '789 Park Ave, Nagpur', city: 'Nagpur' },
]

export default function CustomerList() {
  const [customers, setCustomers] = useState(initialCustomers)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState(null)

  const handleAddCustomer = () => {
    setEditingCustomer(null)
    setIsFormOpen(true)
  }

  const handleEditCustomer = (customer) => {
    setEditingCustomer(customer)
    setIsFormOpen(true)
  }

  const handleDeleteCustomer = (id) => {
    if (confirm('Are you sure you want to delete this customer?')) {
      setCustomers(customers.filter(c => c.id !== id))
    }
  }

  const handleSaveCustomer = (customerData) => {
    if (editingCustomer) {
      setCustomers(customers.map(c => c.id === editingCustomer.id ? { ...c, ...customerData } : c))
    } else {
      setCustomers([...customers, { ...customerData, id: Date.now() }])
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Customers</h1>
          <p className="text-sm text-neutral-500">Manage your customer list</p>
        </div>
        <Button onClick={handleAddCustomer}>
          <Plus className="size-4 mr-2" />
          Add Customer
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {customers.map((customer) => (
          <Card key={customer.id} className="hover:shadow-lg transition-all">
            <div className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-100 to-primary-200 text-primary-700">
                    <User className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-neutral-900">{customer.name}</h3>
                    <p className="text-xs text-neutral-500">{customer.city}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleEditCustomer(customer)}
                    className="p-2 text-neutral-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg"
                  >
                    <Edit className="size-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteCustomer(customer.id)}
                    className="p-2 text-neutral-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2 text-sm text-neutral-600">
                  <Phone className="size-4 text-neutral-400" />
                  {customer.phone}
                </div>
                <div className="flex items-start gap-2 text-sm text-neutral-600">
                  <MapPin className="size-4 text-neutral-400 mt-0.5" />
                  <span className="line-clamp-2">{customer.address}</span>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <CustomerForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        customer={editingCustomer}
        onSave={handleSaveCustomer}
      />
    </div>
  )
}
