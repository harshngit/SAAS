import { orders } from './orders'

const findOrder = (orderId) => orders.find((order) => order.id === orderId)

const buildDelivery = ({ id, orderId, status, scheduledDate, deliveredAt = null, paymentMode = null, notes = null }) => {
  const order = findOrder(orderId)
  const paymentCollected = order.paymentStatus === 'Paid'
  const amountCollected = status === 'Delivered' ? order.amountPaid : 0
  const amountDue = status === 'Delivered' ? order.balanceDue : order.total

  return {
    id,
    orderId,
    orderNumber: order.orderNumber,
    customerId: order.customerId,
    customerName: order.customerName,
    deliveryPartnerId: 'usr-4',
    status,
    scheduledDate,
    deliveredAt,
    paymentMode,
    paymentCollected,
    amountCollected,
    amountDue,
    notes,
  }
}

export const deliveries = [
  buildDelivery({ id: 'DEL-1', orderId: 'ORD-1001', status: 'Delivered', scheduledDate: '2026-07-01', deliveredAt: '2026-07-01T11:20:00', paymentMode: 'UPI' }),
  buildDelivery({ id: 'DEL-2', orderId: 'ORD-1002', status: 'Delivered', scheduledDate: '2026-07-02', deliveredAt: '2026-07-02T13:45:00', paymentMode: 'Cash' }),
  buildDelivery({ id: 'DEL-3', orderId: 'ORD-1003', status: 'Delivered', scheduledDate: '2026-07-03', deliveredAt: '2026-07-03T10:05:00', paymentMode: 'Card' }),
  buildDelivery({ id: 'DEL-4', orderId: 'ORD-1004', status: 'Delivered', scheduledDate: '2026-07-04', deliveredAt: '2026-07-04T16:30:00', paymentMode: 'UPI' }),
  buildDelivery({ id: 'DEL-5', orderId: 'ORD-1005', status: 'Delivered', scheduledDate: '2026-07-05', deliveredAt: '2026-07-05T12:10:00', paymentMode: 'Credit' }),
  buildDelivery({ id: 'DEL-6', orderId: 'ORD-1006', status: 'Delivered', scheduledDate: '2026-07-06', deliveredAt: '2026-07-06T14:50:00', paymentMode: 'Cash' }),
  buildDelivery({ id: 'DEL-7', orderId: 'ORD-1007', status: 'Delivered', scheduledDate: '2026-07-07', deliveredAt: '2026-07-07T09:40:00', paymentMode: 'UPI' }),
  buildDelivery({ id: 'DEL-8', orderId: 'ORD-1008', status: 'Out for Delivery', scheduledDate: '2026-07-17' }),
  buildDelivery({ id: 'DEL-9', orderId: 'ORD-1009', status: 'Out for Delivery', scheduledDate: '2026-07-17' }),
  buildDelivery({ id: 'DEL-10', orderId: 'ORD-1010', status: 'Out for Delivery', scheduledDate: '2026-07-17' }),
  buildDelivery({ id: 'DEL-11', orderId: 'ORD-1011', status: 'Scheduled', scheduledDate: '2026-07-19' }),
  buildDelivery({ id: 'DEL-12', orderId: 'ORD-1012', status: 'Scheduled', scheduledDate: '2026-07-18' }),
  buildDelivery({ id: 'DEL-13', orderId: 'ORD-1013', status: 'Failed', scheduledDate: '2026-07-16', notes: 'Customer unavailable at delivery address - reattempt scheduled for 2026-07-18' }),
]
