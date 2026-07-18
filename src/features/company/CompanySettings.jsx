import { useState } from 'react'
import { Save } from 'lucide-react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Card from '../../components/ui/Card'

const initialCompanyData = {
  name: 'SAAS Distributors',
  email: 'info@saasdistributors.com',
  phone: '+91 9876543210',
  address: '123 Main Street, Business District',
  city: 'Mumbai',
  state: 'Maharashtra',
  pincode: '400001',
  gstin: '27AABCU9603R1ZX'
}

export default function CompanySettings() {
  const [companyData, setCompanyData] = useState(initialCompanyData)
  const [isSaving, setIsSaving] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setCompanyData(prev => ({ ...prev, [name]: value }))
  }

  const handleSave = async () => {
    setIsSaving(true)
    // Mock save
    await new Promise(resolve => setTimeout(resolve, 1000))
    alert('Company settings saved successfully!')
    setIsSaving(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Company Settings</h1>
          <p className="text-sm text-neutral-500">Manage your company information and preferences</p>
        </div>
      </div>

      <Card>
        <div className="p-6">
          <h2 className="text-lg font-semibold text-neutral-900 mb-6">Company Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input
              label="Company Name"
              name="name"
              value={companyData.name}
              onChange={handleChange}
            />
            <Input
              label="Email"
              name="email"
              type="email"
              value={companyData.email}
              onChange={handleChange}
            />
            <Input
              label="Phone"
              name="phone"
              value={companyData.phone}
              onChange={handleChange}
            />
            <Input
              label="GSTIN"
              name="gstin"
              value={companyData.gstin}
              onChange={handleChange}
            />
            <Input
              label="Address"
              name="address"
              value={companyData.address}
              onChange={handleChange}
            />
            <Input
              label="City"
              name="city"
              value={companyData.city}
              onChange={handleChange}
            />
            <Input
              label="State"
              name="state"
              value={companyData.state}
              onChange={handleChange}
            />
            <Input
              label="Pincode"
              name="pincode"
              value={companyData.pincode}
              onChange={handleChange}
            />
          </div>
          <div className="mt-8 flex justify-end">
            <Button onClick={handleSave} loading={isSaving}>
              <Save className="size-4 mr-2" />
              Save Changes
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
