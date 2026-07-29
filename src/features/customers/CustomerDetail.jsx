import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CreditCard, Edit, ShoppingBag, UsersRound, Wallet } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import StatCard from '../../components/ui/StatCard'
import { ROLES } from '../../auth/roles'
import { customers as seedCustomers } from '../../mockData/customers'
import { orders } from '../../mockData/orders'
import { users } from '../../mockData/users'
import { useAuthStore } from '../../store/authStore'
import { formatCurrency } from '../../utils/format'
import CustomerForm from './CustomerForm'

const statusVariant = {
  Draft: 'neutral',
  Confirmed: 'info',
  'Out for Delivery': 'warning',
  Delivered: 'success',
  Cancelled: 'danger',
}

const paymentVariant = {
  Paid: 'success',
  Partial: 'warning',
  Unpaid: 'danger',
}

export default function CustomerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const currentUser = useAuthStore((state) => state.currentUser)
  const isAdmin = currentUser?.role === ROLES.ADMIN
  const basePath = isAdmin ? '/admin/customers' : '/sales/customers'

  const initialCustomer = useMemo(() => seedCustomers.find((item) => item.id === id), [id])
  const [customer, setCustomer] = useState(initialCustomer)
  const [isFormOpen, setIsFormOpen] = useState(false)

  const customerOrders = useMemo(
    () => (customer ? orders.filter((order) => order.customerId === customer.id) : []),
    [customer],
  )

  const salesOfficers = useMemo(
    () => users.filter((user) => user.role === ROLES.SALES_OFFICER && user.status === 'active'),
    [],
  )

  const assignedSalesOfficer = users.find((user) => user.id === customer?.assignedSalesOfficerId)

  if (!customer) {
    return (
      <Card>
        <EmptyState
          icon={UsersRound}
          title="Customer not found"
          description="This customer may have been deleted or the link is out of date."
          action={{ label: 'Back to Customers', onClick: () => navigate(basePath) }}
        />
      </Card>
    )
  }

  const lifetimeValue = customerOrders.reduce((sum, order) => sum + order.total, 0)

  const handleSaveCustomer = (customerData) => {
    setCustomer((current) => ({ ...current, ...customerData }))
    setIsFormOpen(false)
  }

  if (isFormOpen) {
    return (
      <CustomerForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        customer={customer}
        onSave={handleSaveCustomer}
        salesOfficers={salesOfficers}
        currentUser={currentUser}
      />
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="secondary" size="sm" onClick={() => navigate(basePath)}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold text-neutral-900">{customer.name}</h1>
              <Badge variant={customer.status === 'active' ? 'success' : 'neutral'}>
                {customer.status === 'active' ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Badge variant="primary">{customer.type}</Badge>
              <span className="text-xs text-neutral-400">{customer.city}</span>
            </div>
          </div>
        </div>

        <Button variant="outline" size="sm" onClick={() => setIsFormOpen(true)}>
          <Edit className="size-4" aria-hidden="true" />
          Edit
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={ShoppingBag} iconVariant="primary" label="Total Orders" value={customerOrders.length} />
        <StatCard icon={Wallet} iconVariant="success" label="Lifetime Value" value={formatCurrency(lifetimeValue)} />
        <StatCard icon={CreditCard} iconVariant="info" label="Credit Limit" value={formatCurrency(customer.creditLimit)} />
        <StatCard
          icon={Wallet}
          iconVariant={customer.outstandingBalance > 0 ? 'warning' : 'neutral'}
          label="Outstanding Balance"
          value={formatCurrency(customer.outstandingBalance)}
        />
      </div>

      <Card title="Contact Information">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Phone</p>
            <p className="mt-1 text-sm text-neutral-800">{customer.phone}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Email</p>
            <p className="mt-1 text-sm text-neutral-800">{customer.email || '—'}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">GST Number</p>
            <p className="mt-1 text-sm text-neutral-800">{customer.gstNumber || '—'}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Assigned Sales Officer</p>
            <p className="mt-1 text-sm text-neutral-800">{assignedSalesOfficer?.name || 'Unassigned'}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Billing Address</p>
            <p className="mt-1 text-sm text-neutral-800">{customer.billingAddress || customer.address || '—'}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Delivery Address</p>
            <p className="mt-1 text-sm text-neutral-800">{customer.deliveryAddress || customer.billingAddress || customer.address || '—'}</p>
          </div>
        </div>
      </Card>

      <Card title="Order & Transaction History" subtitle="Every sales order placed by this customer" className="p-0" bodyClassName="p-0">
        {customerOrders.length === 0 ? (
          <div className="p-5">
            <p className="py-8 text-center text-sm text-neutral-500">No orders recorded for this customer yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-3xl text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50/80 text-[0.68rem] font-semibold uppercase tracking-widest text-neutral-400">
                  <th className="whitespace-nowrap px-5 py-3">Order #</th>
                  <th className="whitespace-nowrap px-5 py-3">Date</th>
                  <th className="whitespace-nowrap px-5 py-3">Status</th>
                  <th className="whitespace-nowrap px-5 py-3">Payment</th>
                  <th className="whitespace-nowrap px-5 py-3 text-right">Total</th>
                  <th className="whitespace-nowrap px-5 py-3 text-right">Balance Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {customerOrders.map((order) => (
                  <tr key={order.id} className="transition-colors hover:bg-primary-50/35">
                    <td className="whitespace-nowrap px-5 py-3.5 font-medium text-neutral-800">{order.orderNumber}</td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-neutral-500">{order.orderDate}</td>
                    <td className="whitespace-nowrap px-5 py-3.5">
                      <Badge variant={statusVariant[order.status] || 'neutral'}>{order.status}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5">
                      <Badge variant={paymentVariant[order.paymentStatus] || 'neutral'} dot>
                        {order.paymentStatus}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right font-medium text-neutral-900">
                      {formatCurrency(order.total)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right text-neutral-600">
                      {formatCurrency(order.balanceDue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
