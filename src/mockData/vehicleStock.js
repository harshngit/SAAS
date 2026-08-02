import { products } from './products'

const loadedQuantities = {
  'PW-250': 40,
  'PW-500': 35,
  'PW-1L': 25,
  'MW-500': 20,
  'JR-20L-R': 15,
  'FW-LEM-500': 10,
}

export const vehicleStock = Object.entries(loadedQuantities).map(([productId, quantity]) => {
  const product = products.find((item) => item.id === productId)
  return {
    productId,
    productName: product?.fullName || productId,
    quantity,
  }
})
