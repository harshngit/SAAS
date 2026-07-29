export const productCatalog = [
  {
    id: 1,
    name: 'Water',
    brand: 'AquaPure',
    category: 'Water',
    status: 'active',
    description: 'Packaged drinking water range',
    variants: [
      { size: '250 ml', sku: 'WTR-250', hsn: '2201', unit: 'Bottle', gstRate: 18, purchasePrice: 6, sellingPrice: 10 },
      { size: '500 ml', sku: 'WTR-500', hsn: '2201', unit: 'Bottle', gstRate: 18, purchasePrice: 11, sellingPrice: 18 },
      { size: '1 Litre', sku: 'WTR-1L', hsn: '2201', unit: 'Bottle', gstRate: 18, purchasePrice: 20, sellingPrice: 35 },
    ],
  },
  {
    id: 2,
    name: 'Thums Up',
    brand: 'Thums Up',
    category: 'Soft Drinks',
    status: 'active',
    description: 'Strong, fizzy cola soft drink',
    variants: [
      { size: '200 ml', sku: 'THM-200', hsn: '2202', unit: 'Bottle', gstRate: 40, purchasePrice: 12, sellingPrice: 20 },
      { size: '500 ml', sku: 'THM-500', hsn: '2202', unit: 'Bottle', gstRate: 40, purchasePrice: 22, sellingPrice: 35 },
      { size: '1 Litre', sku: 'THM-1L', hsn: '2202', unit: 'Bottle', gstRate: 40, purchasePrice: 35, sellingPrice: 55 },
      { size: '2 Litres', sku: 'THM-2L', hsn: '2202', unit: 'Bottle', gstRate: 40, purchasePrice: 60, sellingPrice: 95 },
    ],
  },
]
