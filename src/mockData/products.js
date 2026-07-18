const rawProducts = [
  { id: 'PW-250', name: 'Packaged Drinking Water', category: 'Packaged Water', variant: '250ml', unit: 'case (24)', costPrice: 5, sellingPrice: 8, gstRate: 0.18, stock: 500, lowStockThreshold: 100 },
  { id: 'PW-500', name: 'Packaged Drinking Water', category: 'Packaged Water', variant: '500ml', unit: 'case (24)', costPrice: 10, sellingPrice: 15, gstRate: 0.18, stock: 400, lowStockThreshold: 100 },
  { id: 'PW-1L', name: 'Packaged Drinking Water', category: 'Packaged Water', variant: '1L', unit: 'case (12)', costPrice: 13, sellingPrice: 20, gstRate: 0.18, stock: 350, lowStockThreshold: 80 },
  { id: 'PW-2L', name: 'Packaged Drinking Water', category: 'Packaged Water', variant: '2L', unit: 'case (9)', costPrice: 22, sellingPrice: 35, gstRate: 0.18, stock: 200, lowStockThreshold: 50 },
  { id: 'MW-500', name: 'Natural Mineral Water', category: 'Mineral Water', variant: '500ml', unit: 'case (24)', costPrice: 12, sellingPrice: 18, gstRate: 0.18, stock: 300, lowStockThreshold: 60 },
  { id: 'MW-1L', name: 'Natural Mineral Water', category: 'Mineral Water', variant: '1L', unit: 'case (12)', costPrice: 18, sellingPrice: 28, gstRate: 0.18, stock: 250, lowStockThreshold: 50 },
  { id: 'SW-300', name: 'Sparkling Water', category: 'Sparkling Water', variant: '300ml', unit: 'case (24)', costPrice: 16, sellingPrice: 25, gstRate: 0.18, stock: 150, lowStockThreshold: 40 },
  { id: 'SW-750', name: 'Sparkling Water', category: 'Sparkling Water', variant: '750ml', unit: 'case (12)', costPrice: 30, sellingPrice: 45, gstRate: 0.18, stock: 25, lowStockThreshold: 30 },
  { id: 'JR-20L-R', name: 'Water Jar Refill', category: 'Water Jar', variant: '20L', unit: 'jar', costPrice: 25, sellingPrice: 40, gstRate: 0.12, stock: 180, lowStockThreshold: 50 },
  { id: 'JR-20L-N', name: 'Water Jar (New, with can)', category: 'Water Jar', variant: '20L', unit: 'jar', costPrice: 220, sellingPrice: 350, gstRate: 0.12, stock: 60, lowStockThreshold: 20 },
  { id: 'FW-LEM-500', name: 'Flavored Water - Lemon', category: 'Flavored Water', variant: '500ml', unit: 'case (24)', costPrice: 14, sellingPrice: 22, gstRate: 0.18, stock: 140, lowStockThreshold: 30 },
  { id: 'FW-ORG-500', name: 'Flavored Water - Orange', category: 'Flavored Water', variant: '500ml', unit: 'case (24)', costPrice: 14, sellingPrice: 22, gstRate: 0.18, stock: 18, lowStockThreshold: 30 },
  { id: 'AW-500', name: 'Alkaline Water', category: 'Alkaline Water', variant: '500ml', unit: 'case (24)', costPrice: 19, sellingPrice: 30, gstRate: 0.18, stock: 100, lowStockThreshold: 25 },
  { id: 'AW-1L', name: 'Alkaline Water', category: 'Alkaline Water', variant: '1L', unit: 'case (12)', costPrice: 32, sellingPrice: 50, gstRate: 0.18, stock: 15, lowStockThreshold: 20 },
  { id: 'DISP-HC', name: 'Water Dispenser - Hot & Cold', category: 'Dispenser', variant: 'Standard', unit: 'unit', costPrice: 3200, sellingPrice: 4500, gstRate: 0.18, stock: 4, lowStockThreshold: 5 },
  { id: 'DISP-N', name: 'Water Dispenser - Normal', category: 'Dispenser', variant: 'Standard', unit: 'unit', costPrice: 2000, sellingPrice: 2800, gstRate: 0.18, stock: 20, lowStockThreshold: 5 },
  { id: 'ACC-TAP', name: 'Dispenser Tap', category: 'Accessories', variant: 'Standard', unit: 'unit', costPrice: 90, sellingPrice: 150, gstRate: 0.18, stock: 80, lowStockThreshold: 20 },
  { id: 'ACC-STAND', name: 'Bottle Stand', category: 'Accessories', variant: 'Standard', unit: 'unit', costPrice: 180, sellingPrice: 300, gstRate: 0.18, stock: 8, lowStockThreshold: 10 },
]

export const products = rawProducts.map((product) => ({
  ...product,
  fullName: `${product.name} (${product.variant})`,
  status: product.stock < product.lowStockThreshold ? 'low_stock' : 'in_stock',
}))
