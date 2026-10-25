import { useFieldSettings } from './FieldSettingsContext'
import { formFieldKey } from './formFieldKeys'

export function useFormFieldSettings(module) {
  const { isFieldVisible, getFieldMeta } = useFieldSettings()
  const visible = (name) => {
    if (!isFieldVisible(module, formFieldKey(module, name))) return false
    // Company Settings has one input for each pair of legacy/canonical backend aliases.
    if (module === 'company' && name === 'phone') return isFieldVisible(module, 'primary_mobile')
    if (module === 'company' && name === 'gstin') return isFieldVisible(module, 'gstin_pan')
    return true
  }
  const required = (name, fallback = false) => {
    const meta = getFieldMeta(module, formFieldKey(module, name))
    return visible(name) && (meta ? meta.classification === 'mandatory' : fallback)
  }
  const visibleErrors = (errors) => Object.fromEntries(Object.entries(errors).filter(([name]) => visible(name.split('.')[0])))
  return { visible, required, visibleErrors }
}
