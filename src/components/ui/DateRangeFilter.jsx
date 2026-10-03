import Select from './Select'
import DatePicker from './DatePicker'
import { DATE_RANGE_PRESETS } from '../../utils/dateRange'

// One consistent Date filter control for every list/table page - a preset dropdown that reveals
// two DatePicker fields only for "Custom Range". Callers own the actual filtering (server-side
// params or isWithinDateRange over an already-loaded list) - this component only resolves user
// intent into { preset, customFrom, customTo }.
// Always stacks vertically - this sits inside narrow drawers/dropdowns (ListFilterPanel is
// max-w-sm; several callers use an even narrower inline menu), and a row layout driven by a
// `sm:` breakpoint reacts to the VIEWPORT, not the container, so it would overflow those on any
// normal-width desktop screen regardless of how much room the container actually has.
export default function DateRangeFilter({ preset, onPresetChange, customFrom, customTo, onCustomChange, className = '' }) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <Select
        options={DATE_RANGE_PRESETS}
        value={preset}
        onChange={(event) => onPresetChange(event.target.value)}
        triggerClassName="h-9 bg-neutral-50 py-1.5 text-xs"
      />
      {preset === 'custom' && (
        <div className="flex flex-col gap-2">
          <DatePicker
            value={customFrom}
            onChange={(value) => onCustomChange({ from: value, to: customTo })}
            placeholder="From date"
          />
          <DatePicker
            value={customTo}
            onChange={(value) => onCustomChange({ from: customFrom, to: value })}
            placeholder="To date"
          />
        </div>
      )}
    </div>
  )
}
