import { useState } from 'react'
import { Plus, Edit, Trash2, Package } from 'lucide-react'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import ProductForm from './ProductForm'

const initialProducts = [
  {
    id: 1,
    name: 'AquaPure Mineral Water',
    description: 'Pure mineral water with essential minerals',
    category: 'Water',
    variants: [
      { size: '250ml', price: 10, mrp: 15, sku: 'WTR-250' },
      { size: '500ml', price: 18, mrp: 25, sku: 'WTR-500' },
      { size: '1L', price: 35, mrp: 45, sku: 'WTR-1L' },
    ]
  },
  {
    id: 2,
    name: 'AquaPure Sparkling Water',
    description: 'Refreshing sparkling water',
    category: 'Soda',
    variants: [
      { size: '500ml', price: 40, mrp: 55, sku: 'SPK-500' },
      { size: '1L', price: 70, mrp: 90, sku: 'SPK-1L' },
    ]
  }
]

export default function ProductList() {
  const [products, setProducts] = useState(initialProducts)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)

  const handleAddProduct = () => {
    setEditingProduct(null)
    setIsFormOpen(true)
  }

  const handleEditProduct = (product) => {
    setEditingProduct(product)
    setIsFormOpen(true)
  }

  const handleDeleteProduct = (id) => {
    if (confirm('Are you sure you want to delete this product?')) {
      setProducts(products.filter(p => p.id !== id))
    }
  }

  const handleSaveProduct = (productData) => {
    if (editingProduct) {
      setProducts(products.map(p => p.id === editingProduct.id ? { ...p, ...productData, id: editingProduct.id } : p))
    } else {
      setProducts([...products, { ...productData, id: Date.now() }])
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Products</h1>
          <p className="text-sm text-neutral-500">Manage your product catalog and variants</p>
        </div>
        <Button onClick={handleAddProduct}>
          <Plus className="size-4 mr-2" />
          Add Product
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((product) => (
          <Card key={product.id} className="hover:shadow-lg transition-shadow">
            <div className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
                    <Package className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-neutral-900">{product.name}</h3>
                    <span className="text-xs text-neutral-500">{product.category}</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleEditProduct(product)}
                    className="p-2 text-neutral-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg"
                  >
                    <Edit className="size-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteProduct(product.id)}
                    className="p-2 text-neutral-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
              <p className="mt-3 text-sm text-neutral-600 line-clamp-2">{product.description}</p>
              <div className="mt-4 pt-4 border-t border-neutral-100">
                <h4 className="text-xs font-medium text-neutral-500 mb-2">Variants</h4>
                <div className="space-y-2">
                  {product.variants.map((variant, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-neutral-700">{variant.size}</span>
                        <span className="text-neutral-400 text-xs">{variant.sku}</span>
                      </div>
                      <div className="text-neutral-600">
                        ₹{variant.price} <span className="text-neutral-400 line-through">₹{variant.mrp}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <ProductForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        product={editingProduct}
        onSave={handleSaveProduct}
      />
    </div>
  )
}
