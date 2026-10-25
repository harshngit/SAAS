import { useFormFieldSettings } from './useFormFieldSettings'

// Unmount hidden inputs so browser required validation cannot block an invisible field.
// Existing form state is retained; visibility never clears a saved value.
export default function ConfiguredField({ module, name, children }) {
  const { visible } = useFormFieldSettings(module)
  return visible(name) ? children : null
}
