import { eachDayOfInterval, format } from 'date-fns'
import { products } from './products'
import { customers } from './customers'
import { orders } from './orders'
import { purchases } from './purchases'
import { deliveries } from './deliveries'
import { expenses } from './expenses'

const TODAY = '2026-07-17'
const CURRENT_MONTH = '2026-07'
const CURRENT_YEAR = '2026'

const activeOrderStatuses = ['Confirmed', 'Out for Delivery', 'Delivered']
const nonCancelledOrders = orders.filter((order) => order.status !== 'Cancelled')

const todaysSales = orders
  .filter((order) => order.orderDate === TODAY && activeOrderStatuses.includes(order.status))
  .reduce((sum, order) => sum + order.total, 0)

const monthlySales = nonCancelledOrders
  .filter((order) => order.orderDate.startsWith(CURRENT_MONTH))
  .reduce((sum, order) => sum + order.total, 0)

const yearlySales = nonCancelledOrders
  .filter((order) => order.orderDate.startsWith(CURRENT_YEAR))
  .reduce((sum, order) => sum + order.total, 0)

const lowStockProducts = products.filter((product) => product.stock < product.lowStockThreshold)

const pendingDeliveries = deliveries.filter((delivery) =>
  ['Out for Delivery', 'Scheduled', 'Failed'].includes(delivery.status),
).length

const outstandingReceivables = customers.reduce((sum, customer) => sum + customer.outstandingBalance, 0)

const outstandingPayables = purchases.reduce((sum, purchase) => sum + purchase.balance, 0)

const purchasesThisMonth = purchases
  .filter((purchase) => purchase.purchaseDate.startsWith(CURRENT_MONTH))
  .reduce((sum, purchase) => sum + purchase.total, 0)

const pendingOrdersCount = orders.filter((order) => ['Draft', 'Confirmed'].includes(order.status)).length

const overdueInvoicesCount = orders.filter((order) => order.status === 'Delivered' && order.balanceDue > 0).length

const pendingExpensesAmount = expenses
  .filter((expense) => expense.status === 'Pending')
  .reduce((sum, expense) => sum + expense.amount, 0)

const expensesThisMonthTotal = expenses
  .filter((expense) => expense.status !== 'Rejected' && expense.date.startsWith(CURRENT_MONTH))
  .reduce((sum, expense) => sum + expense.amount, 0)

const cashPendingHandover = deliveries
  .filter((delivery) => delivery.status === 'Delivered' && delivery.paymentMode === 'Cash')
  .reduce((sum, delivery) => sum + delivery.amountCollected, 0)

const outputGst = nonCancelledOrders.reduce((sum, order) => sum + order.gstAmount, 0)
const inputGst = purchases.reduce((sum, purchase) => sum + purchase.gstAmount, 0)

const gstSummary = {
  outputGst,
  inputGst,
  netPayable: outputGst - inputGst,
}

const ordersByStatus = orders.reduce((acc, order) => {
  acc[order.status] = (acc[order.status] || 0) + 1
  return acc
}, {})

const orderStatusChartData = Object.entries(ordersByStatus).map(([name, value]) => ({ name, value }))

const paymentStatusCounts = nonCancelledOrders.reduce((acc, order) => {
  acc[order.paymentStatus] = (acc[order.paymentStatus] || 0) + 1
  return acc
}, {})

const paymentStatusChartData = Object.entries(paymentStatusCounts).map(([name, value]) => ({ name, value }))

const monthDays = eachDayOfInterval({ start: new Date('2026-07-01'), end: new Date(TODAY) })
const dailySalesTrend = monthDays.map((day) => {
  const dayKey = format(day, 'yyyy-MM-dd')
  const value = nonCancelledOrders
    .filter((order) => order.orderDate === dayKey)
    .reduce((sum, order) => sum + order.total, 0)
  return { label: format(day, 'd MMM'), value }
})

const productRevenue = new Map()
for (const order of nonCancelledOrders) {
  for (const item of order.items) {
    const key = `${item.name} (${item.variant})`
    productRevenue.set(key, (productRevenue.get(key) || 0) + item.lineTotal)
  }
}
const topProducts = [...productRevenue.entries()]
  .map(([name, value]) => ({ name, value }))
  .sort((a, b) => b.value - a.value)
  .slice(0, 5)

export const dashboardStats = {
  orgId: 'org-1',
  asOf: TODAY,
  todaysSales,
  monthlySales,
  yearlySales,
  lowStockCount: lowStockProducts.length,
  lowStockProducts: lowStockProducts.map((product) => product.fullName),
  pendingDeliveries,
  pendingOrdersCount,
  outstandingReceivables,
  outstandingPayables,
  purchasesThisMonth,
  totalCustomers: customers.length,
  totalProducts: products.length,
  ordersByStatus,
  orderStatusChartData,
  paymentStatusChartData,
  dailySalesTrend,
  topProducts,
  pendingExpensesAmount,
  expensesThisMonthTotal,
  overdueInvoicesCount,
  cashPendingHandover,
  gstSummary,
}
