import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Save, Search, Trash2 } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import { listProducts } from '../../api/products'
import { loadVehicleStock } from '../../api/vehicleStock'
import { useAuthStore } from '../../store/authStore'
import { useToast } from '../../components/ui/toastContext'

export default function VehicleLoading() {
  const { showToast } = useToast()
  const navigate = useNavigate()
  const currentUser = useAuthStore((state) => state.currentUser)

  const [products, setProducts] = useState([])
  const [isLoadingProducts, setIsLoadingProducts] = useState(true)
  const [loadingDate, setLoadingDate] = useState(new Date().toISOString().split('T')[0])
  const [items, setItems] = useState([])
  const [productSearch, setProductSearch] = useState('')
  const [addProductId, setAddProductId] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    listProducts().then((result) => {
      if (result.success) setProducts(result.products)
      setIsLoadingProducts(false)
    })
  }, [])

  const availableProductOptions = useMemo(() => {
    const search = productSearch.trim().toLowerCase()
    return products
      .filter((product) => !items.some((item) => item.productId === product.id))
      .filter((product) => !search || product.name?.toLowerCase().includes(search))
      .map((product) => ({ value: product.id, label: product.name }))
  }, [products, items, productSearch])

  const addProduct = () => {
    const product = products.find((p) => p.id === addProductId)
    if (!product) return
    setItems((current) => [...current, { productId: product.id, productName: product.name, quantity: 1 }])
    setAddProductId('')
    setProductSearch('')
  }

  const updateQuantity = (productId, quantity) => {
    setItems((current) => current.map((item) => (item.productId === productId ? { ...item, quantity: Math.max(0, Number(quantity)) } : item)))
  }

  const removeItem = (productId) => {
    setItems((current) => current.filter((item) => item.productId !== productId))
  }

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0)

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (items.length === 0) {
      setError('Add at least one product to load.')
      return
    }

    setIsSubmitting(true)
    setError('')

    const result = await loadVehicleStock({
      deliveryPartnerId: currentUser?.id,
      date: loadingDate,
      items: items.map((item) => ({ productId: item.productId, loadedQty: item.quantity })),
    })

    if (!result.success) {
      setError(result.error)
      setIsSubmitting(false)
      return
    }

    showToast({ title: 'Opening load recorded', message: 'Opening load recorded successfully.' })
    setIsSubmitting(false)
    navigate('/delivery/vehicle-stock')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Vehicle Loading</h1>
        <p className="mt-1 text-sm text-neutral-500">Record opening stock for your delivery vehicle</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <Card title="Loading Details">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Loading Date"
              type="date"
              value={loadingDate}
              onChange={(e) => setLoadingDate(e.target.value)}
              required
            />
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Total Items Loaded</label>
              <div className="text-lg font-semibold text-primary-700">{totalItems}</div>
            </div>
          </div>
        </Card>

        <Card title="Add Products">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-11 size-4 -translate-y-1/2 text-neutral-400" />
              <label className="text-sm font-medium text-neutral-700">Search product</label>
              <input
                type="search"
                value={productSearch}
                onChange={(event) => setProductSearch(event.target.value)}
                placeholder="Search products..."
                className="mt-1.5 h-11 w-full rounded-xl border border-neutral-200 bg-neutral-50 pl-10 pr-3 text-sm text-neutral-900 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
              />
            </div>
            <Select
              label="Product"
              options={availableProductOptions}
              value={addProductId}
              onChange={(event) => setAddProductId(event.target.value)}
              placeholder={isLoadingProducts ? 'Loading...' : 'Select product'}
              className="sm:w-64"
              disabled={isLoadingProducts}
            />
            <Button type="button" onClick={addProduct} disabled={!addProductId}>
              Add
            </Button>
          </div>
        </Card>

        <Card title="Products to Load">
          {items.length === 0 ? (
            <p className="py-6 text-center text-sm text-neutral-500">No products added yet. Search and add products above.</p>
          ) : (
            <div className="space-y-4">
              {items.map((item) => (
                <div key={item.productId} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center p-3 bg-neutral-50 rounded-lg">
                  <div className="md:col-span-2">
                    <p className="font-medium text-neutral-900">{item.productName}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      label="Quantity"
                      value={item.quantity}
                      onChange={(e) => updateQuantity(item.productId, e.target.value)}
                      min="0"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => removeItem(item.productId)}
                      aria-label={`Remove ${item.productName}`}
                      className="mt-6 rounded-lg p-2 text-red-500 hover:bg-red-50"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="submit" loading={isSubmitting}>
            <Save className="size-4" />
            Save Opening Load
          </Button>
        </div>
      </form>
    </div>
  )
}
