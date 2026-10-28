import Select from './Select'
import DatePicker from './DatePicker'
import { DATE_RANGE_PRESETS } from '../../utils/dateRange'

// One consistent Date filter control for every list/table page - a preset dropdown that reveals
// two DatePicker fields only for "Custom Range". Callers own the actual filtering (server-side
// params or isWithinDateRange over an already-loaded list) - this component only resolves user
// intent into { preset, customFrom, customTo }.
// Default (inline=false): always stacks vertically - this sits inside narrow drawers/dropdowns
// (ListFilterPanel is max-w-sm; several callers use an even narrower inline menu), and a row
// layout driven by a `sm:` breakpoint reacts to the VIEWPORT, not the container, so it would
// overflow those on any normal-width desktop screen regardless of how much room the container
// actually has.
// inline=true: for callers that place this directly in a wide horizontal toolbar/page header
// (not a narrow drawer) - the preset dropdown and, once "Custom Range" is picked, the two date
// fields sit side by side instead of stacking a 3-row-tall column next to whatever else shares
// that header row.
export default function DateRangeFilter({ preset, onPresetChange, customFrom, customTo, onCustomChange, className = '', inline = false }) {
  return (
    <div className={`flex gap-2 ${inline ? 'flex-row flex-wrap items-center' : 'flex-col'} ${className}`}>
      <Select
        options={DATE_RANGE_PRESETS}
        value={preset}
        onChange={(event) => onPresetChange(event.target.value)}
        triggerClassName="h-9 bg-neutral-50 py-1.5 text-xs"
        className={inline ? 'w-44 shrink-0' : undefined}
      />
      {preset === 'custom' && (
        <div className={`flex gap-2 ${inline ? 'flex-row flex-wrap items-center' : 'flex-col'}`}>
          <DatePicker
            value={customFrom}
            onChange={(value) => onCustomChange({ from: value, to: customTo })}
            placeholder="From date"
            className={inline ? 'w-40 shrink-0' : undefined}
          />
          <DatePicker
            value={customTo}
            onChange={(value) => onCustomChange({ from: customFrom, to: value })}
            placeholder="To date"
            className={inline ? 'w-40 shrink-0' : undefined}
          />
        </div>
      )}
    </div>
  )
}
