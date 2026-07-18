import { products } from './products'

const findProduct = (id) => products.find((product) => product.id === id)

const buildOrder = ({
  id,
  orderNumber,
  customerId,
  customerName,
  status,
  orderDate,
  expectedDeliveryDate,
  deliveryPartnerId = null,
  amountPaid,
  lines,
}) => {
  const items = lines.map(({ productId, qty }) => {
    const product = findProduct(productId)
    const lineTotal = product.sellingPrice * qty
    const gstAmount = lineTotal * product.gstRate
    return {
      productId,
      name: product.name,
      variant: product.variant,
      qty,
      price: product.sellingPrice,
      gstRate: product.gstRate,
      lineTotal,
      gstAmount,
    }
  })

  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0)
  const gstAmount = items.reduce((sum, item) => sum + item.gstAmount, 0)
  const total = subtotal + gstAmount
  const balanceDue = status === 'Cancelled' ? 0 : total - amountPaid
  const paymentStatus =
    status === 'Cancelled'
      ? 'Unpaid'
      : amountPaid <= 0
        ? 'Unpaid'
        : amountPaid < total
          ? 'Partial'
          : 'Paid'

  return {
    id,
    orderNumber,
    customerId,
    customerName,
    salesOfficerId: 'usr-3',
    deliveryPartnerId,
    status,
    orderDate,
    expectedDeliveryDate,
    items,
    subtotal,
    gstAmount,
    total,
    amountPaid,
    balanceDue,
    paymentStatus,
  }
}

export const orders = [
  buildOrder({
    id: 'ORD-1001',
    orderNumber: 'SO-2026-1001',
    customerId: 'cust-1',
    customerName: 'Hotel Grand Meridian',
    status: 'Delivered',
    orderDate: '2026-07-01',
    expectedDeliveryDate: '2026-07-01',
    deliveryPartnerId: 'usr-4',
    amountPaid: 4600,
    lines: [
      { productId: 'JR-20L-R', qty: 50 },
      { productId: 'PW-1L', qty: 100 },
    ],
  }),
  buildOrder({
    id: 'ORD-1002',
    orderNumber: 'SO-2026-1002',
    customerId: 'cust-2',
    customerName: 'Spice Route Restaurant',
    status: 'Delivered',
    orderDate: '2026-07-02',
    expectedDeliveryDate: '2026-07-02',
    deliveryPartnerId: 'usr-4',
    amountPaid: 1500,
    lines: [
      { productId: 'JR-20L-R', qty: 30 },
      { productId: 'PW-500', qty: 60 },
    ],
  }),
  buildOrder({
    id: 'ORD-1003',
    orderNumber: 'SO-2026-1003',
    customerId: 'cust-3',
    customerName: 'Sunrise Corporate Park',
    status: 'Delivered',
    orderDate: '2026-07-03',
    expectedDeliveryDate: '2026-07-03',
    deliveryPartnerId: 'usr-4',
    amountPaid: 11564,
    lines: [
      { productId: 'DISP-HC', qty: 2 },
      { productId: 'PW-1L', qty: 40 },
    ],
  }),
  buildOrder({
    id: 'ORD-1004',
    orderNumber: 'SO-2026-1004',
    customerId: 'cust-4',
    customerName: 'Mr. Arjun Reddy',
    status: 'Delivered',
    orderDate: '2026-07-04',
    expectedDeliveryDate: '2026-07-04',
    deliveryPartnerId: 'usr-4',
    amountPaid: 413,
    lines: [
      { productId: 'PW-1L', qty: 10 },
      { productId: 'PW-500', qty: 10 },
    ],
  }),
  buildOrder({
    id: 'ORD-1005',
    orderNumber: 'SO-2026-1005',
    customerId: 'cust-5',
    customerName: 'Green Leaf Caterers',
    status: 'Delivered',
    orderDate: '2026-07-05',
    expectedDeliveryDate: '2026-07-05',
    deliveryPartnerId: 'usr-4',
    amountPaid: 0,
    lines: [
      { productId: 'JR-20L-R', qty: 80 },
      { productId: 'FW-LEM-500', qty: 50 },
    ],
  }),
  buildOrder({
    id: 'ORD-1006',
    orderNumber: 'SO-2026-1006',
    customerId: 'cust-9',
    customerName: 'The Coastal Kitchen',
    status: 'Delivered',
    orderDate: '2026-07-06',
    expectedDeliveryDate: '2026-07-06',
    deliveryPartnerId: 'usr-4',
    amountPaid: 1500,
    lines: [
      { productId: 'JR-20L-R', qty: 40 },
      { productId: 'MW-1L', qty: 25 },
    ],
  }),
  buildOrder({
    id: 'ORD-1007',
    orderNumber: 'SO-2026-1007',
    customerId: 'cust-10',
    customerName: 'Om Sai General Store',
    status: 'Delivered',
    orderDate: '2026-07-07',
    expectedDeliveryDate: '2026-07-07',
    deliveryPartnerId: 'usr-4',
    amountPaid: 3658,
    lines: [
      { productId: 'PW-250', qty: 200 },
      { productId: 'PW-500', qty: 100 },
    ],
  }),
  buildOrder({
    id: 'ORD-1008',
    orderNumber: 'SO-2026-1008',
    customerId: 'cust-6',
    customerName: 'Café Mocha',
    status: 'Out for Delivery',
    orderDate: '2026-07-16',
    expectedDeliveryDate: '2026-07-17',
    deliveryPartnerId: 'usr-4',
    amountPaid: 0,
    lines: [
      { productId: 'SW-300', qty: 40 },
      { productId: 'SW-750', qty: 20 },
    ],
  }),
  buildOrder({
    id: 'ORD-1009',
    orderNumber: 'SO-2026-1009',
    customerId: 'cust-12',
    customerName: 'Blue Orchid Banquet Hall',
    status: 'Out for Delivery',
    orderDate: '2026-07-17',
    expectedDeliveryDate: '2026-07-17',
    deliveryPartnerId: 'usr-4',
    amountPaid: 0,
    lines: [
      { productId: 'JR-20L-R', qty: 100 },
      { productId: 'SW-750', qty: 30 },
    ],
  }),
  buildOrder({
    id: 'ORD-1010',
    orderNumber: 'SO-2026-1010',
    customerId: 'cust-15',
    customerName: 'Star Public School',
    status: 'Out for Delivery',
    orderDate: '2026-07-17',
    expectedDeliveryDate: '2026-07-17',
    deliveryPartnerId: 'usr-4',
    amountPaid: 0,
    lines: [
      { productId: 'PW-1L', qty: 150 },
      { productId: 'PW-250', qty: 100 },
    ],
  }),
  buildOrder({
    id: 'ORD-1011',
    orderNumber: 'SO-2026-1011',
    customerId: 'cust-8',
    customerName: 'TechNova Solutions Pvt Ltd',
    status: 'Confirmed',
    orderDate: '2026-07-17',
    expectedDeliveryDate: '2026-07-19',
    amountPaid: 0,
    lines: [
      { productId: 'DISP-N', qty: 3 },
      { productId: 'PW-2L', qty: 30 },
    ],
  }),
  buildOrder({
    id: 'ORD-1012',
    orderNumber: 'SO-2026-1012',
    customerId: 'cust-16',
    customerName: 'Vinayaka Medical Store',
    status: 'Confirmed',
    orderDate: '2026-07-10',
    expectedDeliveryDate: '2026-07-18',
    amountPaid: 700,
    lines: [
      { productId: 'PW-500', qty: 40 },
      { productId: 'MW-500', qty: 25 },
    ],
  }),
  buildOrder({
    id: 'ORD-1013',
    orderNumber: 'SO-2026-1013',
    customerId: 'cust-19',
    customerName: 'Cloud Nine Café',
    status: 'Confirmed',
    orderDate: '2026-07-17',
    expectedDeliveryDate: '2026-07-20',
    amountPaid: 0,
    lines: [
      { productId: 'SW-300', qty: 30 },
      { productId: 'FW-ORG-500', qty: 25 },
    ],
  }),
  buildOrder({
    id: 'ORD-1014',
    orderNumber: 'SO-2026-1014',
    customerId: 'cust-21',
    customerName: 'Prime Legal Associates',
    status: 'Draft',
    orderDate: '2026-07-17',
    expectedDeliveryDate: null,
    amountPaid: 0,
    lines: [
      { productId: 'DISP-N', qty: 1 },
      { productId: 'PW-1L', qty: 20 },
    ],
  }),
  buildOrder({
    id: 'ORD-1015',
    orderNumber: 'SO-2026-1015',
    customerId: 'cust-23',
    customerName: 'Rajdhani Sweets & Snacks',
    status: 'Draft',
    orderDate: '2026-07-17',
    expectedDeliveryDate: null,
    amountPaid: 0,
    lines: [
      { productId: 'PW-250', qty: 150 },
      { productId: 'PW-500', qty: 80 },
    ],
  }),
  buildOrder({
    id: 'ORD-1016',
    orderNumber: 'SO-2026-1016',
    customerId: 'cust-18',
    customerName: 'Silver Oak Apartments',
    status: 'Draft',
    orderDate: '2026-07-17',
    expectedDeliveryDate: null,
    amountPaid: 0,
    lines: [{ productId: 'JR-20L-R', qty: 60 }],
  }),
  buildOrder({
    id: 'ORD-1017',
    orderNumber: 'SO-2026-1017',
    customerId: 'cust-24',
    customerName: 'Horizon Business Center',
    status: 'Cancelled',
    orderDate: '2026-07-12',
    expectedDeliveryDate: null,
    amountPaid: 0,
    lines: [
      { productId: 'MW-1L', qty: 25 },
      { productId: 'AW-1L', qty: 20 },
    ],
  }),
  buildOrder({
    id: 'ORD-1018',
    orderNumber: 'SO-2026-1018',
    customerId: 'cust-7',
    customerName: 'Mrs. Lakshmi Iyer',
    status: 'Cancelled',
    orderDate: '2026-07-13',
    expectedDeliveryDate: null,
    amountPaid: 0,
    lines: [{ productId: 'PW-500', qty: 20 }],
  }),
]
