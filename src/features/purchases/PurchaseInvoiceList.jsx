import { useState } from 'react'
import { Plus, Edit, Trash2, FileText } from 'lucide-react'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import PurchaseInvoiceForm from './PurchaseInvoiceForm'

const initialInvoices = [
  {
    id: 1,
    supplier: 'Prime Manufacturing',
    invoiceNumber: 'PO-2024-001',
    date: '2024-07-15',
    total: 25000,
    items: [
      { product: '250ml Bottles', quantity: 1000, price: 8, total: 8000 },
      { product: '500ml Bottles', quantity: 500, price: 15, total: 7500 },
      { product: '1L Bottles', quantity: 400, price: 25, total: 10000 },
    ]
  },
  {
    id: 2,
    supplier: 'Bottle Suppliers Inc',
    invoiceNumber: 'PO-2024-002',
    date: '2024-07-10',
    total: 18000,
    items: [
      { product: 'Bottle Caps', quantity: 5000, price: 1.5, total: 7500 },
      { product: 'Labels', quantity: 5000, price: 2.1, total: 10500 },
    ]
  }
]

export default function PurchaseInvoiceList() {
  const [invoices, setInvoices] = useState(initialInvoices)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingInvoice, setEditingInvoice] = useState(null)

  const handleAddInvoice = () => {
    setEditingInvoice(null)
    setIsFormOpen(true)
  }

  const handleEditInvoice = (invoice) => {
    setEditingInvoice(invoice)
    setIsFormOpen(true)
  }

  const handleDeleteInvoice = (id) => {
    if (confirm('Are you sure you want to delete this invoice?')) {
      setInvoices(invoices.filter(i => i.id !== id))
    }
  }

  const handleSaveInvoice = (invoiceData) => {
    if (editingInvoice) {
      setInvoices(invoices.map(i => i.id === editingInvoice.id ? { ...i, ...invoiceData, id: editingInvoice.id } : i))
    } else {
      setInvoices([{ ...invoiceData, id: Date.now() }, ...invoices])
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Purchase Invoices</h1>
          <p className="text-sm text-neutral-500">Manage all your purchase invoices</p>
        </div>
        <Button onClick={handleAddInvoice}>
          <Plus className="size-4 mr-2" />
          Add Invoice
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {invoices.map((invoice) => (
          <Card key={invoice.id} className="hover:shadow-lg transition-shadow">
            <div className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                    <FileText className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-neutral-900">{invoice.invoiceNumber}</h3>
                    <span className="text-xs text-neutral-500">{invoice.date}</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleEditInvoice(invoice)}
                    className="p-2 text-neutral-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg"
                  >
                    <Edit className="size-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteInvoice(invoice.id)}
                    className="p-2 text-neutral-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
              <p className="mt-3 text-sm text-neutral-600">{invoice.supplier}</p>
              <div className="mt-4 pt-4 border-t border-neutral-100">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-neutral-500">Total Amount</span>
                  <span className="text-xl font-bold text-neutral-900">₹{invoice.total.toLocaleString()}</span>
                </div>
                <div className="mt-2">
                  <p className="text-xs text-neutral-500">{invoice.items.length} items</p>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <PurchaseInvoiceForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        invoice={editingInvoice}
        onSave={handleSaveInvoice}
      />
    </div>
  )
}
