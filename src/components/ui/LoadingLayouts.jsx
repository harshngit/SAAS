import { Skeleton, SkeletonText, TableSkeleton } from './Skeleton'

const panelClass = 'min-w-0 rounded-2xl border border-neutral-100 bg-surface p-5 shadow-(--shadow-card)'

function Heading({ actions = true }) {
  return <div className="flex flex-wrap items-center justify-between gap-3">
    <div className="space-y-2">
      <Skeleton className="h-6 w-44 max-w-full rounded-lg" />
      <Skeleton className="h-3 w-64 max-w-full" />
    </div>{actions && <Skeleton className="h-9 w-28 rounded-xl" />}</div>
}

function Panel({ children, className = '' }) {
  return <div className={`${panelClass} ${className}`}>{children}</div>
}

export function FieldsLoading({ count = 6 }) {
  return <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">{Array.from({ length: count }, (_, i) => <div key={i} className="min-w-0 space-y-2">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-11 w-full rounded-xl" />
    </div>)}</div>
}

const Fields = FieldsLoading

export function StatsLoading({ count = 4, className = 'grid-cols-2 lg:grid-cols-4', divided = true }) {
  return <div aria-hidden="true" className={`grid ${divided ? 'gap-px overflow-hidden rounded-2xl border border-neutral-100 bg-neutral-100' : 'gap-4'} ${className}`}>{Array.from({ length: count }, (_, i) => <div key={i} className={`${divided ? 'bg-surface' : panelClass} min-h-32 px-5 py-4`}>
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="size-9 shrink-0" />
      </div>
      <Skeleton className="mt-4 h-8 w-20 rounded-lg" />
      <Skeleton className="mt-2 h-3 w-28" />
    </div>)}</div>
}

export function TableLoading({ columns = 5, rows = 6, avatarColumn = -1, checkboxColumn = -1, minWidth = 'min-w-180', cellClassName = 'px-5 py-5' }) {
  const cells = Array.isArray(columns) ? columns : Array.from({ length: columns }, () => ({}))
  return <div className="overflow-x-auto" aria-hidden="true">
    <table className={`listing-table w-full text-left text-sm ${minWidth}`}>
      <thead>
        <tr className="border-b border-neutral-100 bg-surface-muted">{cells.map((column, i) => <th key={i} className="whitespace-nowrap px-5 py-4 text-xs font-semibold text-fg-muted">{i === checkboxColumn ? <Skeleton className="size-4 rounded" /> : typeof column === 'string' && column ? column : column.header || <Skeleton className="h-3 w-16" />}</th>)}</tr>
      </thead>
      <tbody className="divide-y divide-neutral-100">
        <TableSkeleton columns={cells} rows={rows} avatarColumn={avatarColumn} checkboxColumn={checkboxColumn} cellClassName={cellClassName} />
      </tbody>
    </table>
  </div>
}

function Chart({ donut = false, height = 'h-72' }) {
  return <Panel>
    <div className="mb-6">
      <Skeleton className="h-4 w-36" />
      <Skeleton className="mt-2 h-3 w-28" />
    </div>{donut ? <div className={`flex flex-col items-center justify-center gap-6 ${height}`}>
      <div className="size-36 rounded-full border-20 border-neutral-200/60" />
      <SkeletonText lines={3} className="w-3/4" />
    </div> : <div className={`flex items-end gap-3 border-b border-l border-neutral-100 px-4 pt-5 ${height}`}>{[28, 48, 36, 70, 45, 85, 62, 42, 58].map((height, i) => <Skeleton key={i} className="flex-1 rounded-t-md rounded-b-none" style={{ height: `${height}%` }} />)}</div>}</Panel>
}

function FilterBar({ count = 5 }) {
  return <Panel className="!p-3">
    <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">{Array.from({ length: count }, (_, i) => <div key={i} className="space-y-2">
        <Skeleton className="h-2 w-16" />
        <Skeleton className="h-10 rounded-xl" />
      </div>)}<Skeleton className="mt-auto h-10 rounded-xl" />
    </div>
  </Panel>
}

export function DashboardLoading({ layout = 'admin' }) {
  if (layout === 'admin') return <div className="space-y-4">
    <FilterBar />
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
      <div className="space-y-4">
        <Panel className="h-80">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="mt-3 h-10 w-32 rounded-lg" />
          <div className="mt-10 grid grid-cols-2 gap-6">
            <SkeletonText lines={2} />
            <SkeletonText lines={2} />
          </div>
          <div className="mt-12 grid grid-cols-3 gap-4">
            <SkeletonText lines={2} />
            <SkeletonText lines={2} />
            <SkeletonText lines={2} />
          </div>
        </Panel>
        <div className="grid grid-cols-4 gap-2">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
        <Chart height="h-36" />
      </div>
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">{Array.from({ length: 6 }, (_, i) => <Panel key={i} className="flex h-56 flex-col !p-4">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="mt-8 h-7 w-3/4 rounded-lg" />
            <Skeleton className="mt-3 h-3 w-full" />
            <Skeleton className="mt-auto h-3 w-full" />
          </Panel>)}</div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          <Chart height="h-80" />
          <Chart height="h-80" donut />
        </div>
        <Panel>
          <TableLoading columns={6} rows={4} />
        </Panel>
      </div>
    </div>
  </div>
  if (layout === 'superadmin') {
    const panelHeading = (withAction = true) => <div className="mb-5 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Skeleton className="size-5 shrink-0 rounded-lg" />
        <Skeleton className="h-4 w-36 rounded-lg" />
      </div>{withAction && <Skeleton className="h-8 w-20 shrink-0 rounded-lg" />}</div>
    return <div className="space-y-4">
      <StatsLoading count={6} divided={false} className="grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6" />
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.65fr_1fr]">
        <Chart height="h-56" />
        <Chart height="h-56" donut />
      </div>
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.18fr_1fr_0.8fr]">
        <Panel>
          {panelHeading()}
          <TableLoading columns={5} rows={4} minWidth="min-w-0" cellClassName="px-3 py-3" />
        </Panel>
        <Panel>
          {panelHeading()}
          <TableLoading columns={4} rows={4} minWidth="min-w-0" cellClassName="px-3 py-3" />
        </Panel>
        <Panel>
          {panelHeading(false)}
          <div className="space-y-3">{Array.from({ length: 4 }, (_, i) => <div key={i} className="flex items-center justify-between gap-3 border-b border-neutral-100 pb-3 last:border-b-0 last:pb-0">
              <div className="flex min-w-0 items-center gap-3">
                <Skeleton className="size-7 shrink-0 rounded-lg" />
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="h-3.5 w-8 shrink-0" />
            </div>)}</div>
        </Panel>
      </div>
    </div>
  }
  const count = layout === 'accounts' ? 5 : 4
  return <div className="space-y-5">
    <Panel>
      <Heading />
    </Panel>
    <StatsLoading count={count} divided={false} className={count === 5 ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-5' : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4'} />
    <div className={`grid grid-cols-1 gap-4 ${layout === 'delivery' ? 'xl:grid-cols-3' : 'xl:grid-cols-2'}`}>
      <Chart />
      <Chart donut />{layout === 'delivery' && <Panel>
        <ActivityLoading rows={4} />
      </Panel>}</div>
    <Panel>
      <TableLoading columns={6} rows={5} />
    </Panel>
  </div>
}

export function FormLoading({ fields = 6, sections = 2, sidebar = false }) {
  const form = <div className="space-y-4">{Array.from({ length: sections }, (_, i) => <Panel key={i}>
      <Skeleton className="mb-6 h-5 w-40 rounded-lg" />
      <Fields count={fields} />
    </Panel>)}</div>
  return <div className="space-y-5">
    <Heading />
    <div className={sidebar ? 'grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]' : ''}>{form}{sidebar && <Panel className="self-start">
        <Skeleton className="mb-6 h-5 w-36" />
        <SkeletonText lines={8} />
        <Skeleton className="mt-8 h-11 rounded-xl" />
      </Panel>}</div>
  </div>
}

export function DetailLoading({ layout = 'profile', columns = 6 }) {
  if (layout === 'product') return <div className="space-y-5">
    <Heading />
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <Panel>
        <Skeleton className="aspect-square max-h-72 w-full rounded-xl" />
      </Panel>
      <Panel>
        <Heading actions={false} />
        <div className="mt-6">
          <Fields count={8} />
        </div>
      </Panel>
    </div>
    <Panel>
      <Skeleton className="mb-5 h-5 w-40" />
      <TableLoading columns={8} rows={3} />
    </Panel>
  </div>
  if (layout === 'invoice') return <div className="space-y-5">
    <Heading />
    <StatsLoading count={3} className="grid-cols-1 sm:grid-cols-3" />
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <div className="space-y-5">
        <Panel>
          <Fields count={4} />
        </Panel>
        <Panel>
          <Skeleton className="mb-6 h-5 w-36" />
          <SkeletonText lines={4} />
        </Panel>
        <Panel>
          <TableLoading columns={columns} rows={5} />
        </Panel>
      </div>
      <Panel>
        <Heading />
        <Skeleton className="mt-5 aspect-[1/1.414] w-full rounded-none" />
      </Panel>
    </div>
  </div>
  return <div className="space-y-5">
    <Heading />
    <Panel>
      <div className="flex flex-wrap items-center gap-5">
        <Skeleton className="size-20 shrink-0 rounded-2xl" />
        <div className="min-w-0 flex-1">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="mt-3 h-3 w-64 max-w-full" />
        </div>
        <Skeleton className="h-9 w-28 rounded-xl" />
      </div>
    </Panel>{layout === 'order' && <Panel>
      <div className="flex justify-between gap-4">{Array.from({ length: 7 }, (_, i) => <div key={i} className="flex flex-col items-center gap-3">
          <Skeleton className="size-7" />
          <Skeleton className="h-2 w-12" />
        </div>)}</div>
    </Panel>}<div className="flex flex-wrap gap-3">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-9 w-28 rounded-lg" />)}</div>
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <Panel>
        <Skeleton className="mb-5 h-5 w-40" />{layout === 'order' ? <TableLoading columns={columns} rows={4} /> : <Fields count={8} />}</Panel>
      <div className="space-y-5">
        <Panel>
          <SkeletonText lines={6} />
        </Panel>
        <Panel>
          <SkeletonText lines={4} />
        </Panel>
      </div>
    </div>
  </div>
}

export function SettingsLoading({ preview = false }) {
  return <div className="grid grid-cols-1 gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
    <Panel>
      <Skeleton className="mb-6 h-5 w-36" />
      <div className="space-y-4">{Array.from({ length: 7 }, (_, i) => <Skeleton key={i} className="h-10 rounded-xl" />)}</div>
    </Panel>
    <div className={preview ? 'grid grid-cols-1 gap-5 xl:grid-cols-2' : ''}>
      <Panel>
        <Skeleton className="mb-6 h-6 w-44" />
        <Fields count={8} />
        <Skeleton className="mt-6 h-24 rounded-xl" />
      </Panel>{preview && <Panel>
        <Skeleton className="aspect-[1/1.414] w-full rounded-none" />
      </Panel>}</div>
  </div>
}

export function ActivityLoading({ rows = 5 }) {
  return <div className="divide-y divide-neutral-100">{Array.from({ length: rows }, (_, i) => <div key={i} className="flex items-start gap-3 py-4">
      <Skeleton className="size-9 shrink-0" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-3.5 w-2/3" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-2.5 w-20" />
      </div>
    </div>)}</div>
}

export function CardsLoading({ count = 3 }) {
  return <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: count }, (_, i) => <Panel key={i}>
      <Skeleton className="h-5 w-32" />
      <Skeleton className="my-6 h-9 w-24 rounded-lg" />
      <SkeletonText lines={5} />
      <Skeleton className="mt-6 h-10 rounded-xl" />
    </Panel>)}</div>
}

export function ReportLoading({ columns = 6, stats = 3, chart = false }) {
  return <div className="space-y-4">{stats > 0 && <StatsLoading count={stats} className="grid-cols-1 sm:grid-cols-3" />}{chart && <Chart />}<TableLoading columns={columns} rows={8} />
  </div>
}

export function VehicleStockLoading({ count = 2 }) {
  return <div className="space-y-5">{Array.from({ length: count }, (_, i) => <Panel key={i}>
      <Heading />
      <div className="my-5">
        <StatsLoading count={4} />
      </div>
      <TableLoading columns={['Product', 'SKU', 'Loaded', 'Sold', 'Remaining', 'Status']} rows={4} />
    </Panel>)}</div>
}

export function MapLoading() {
  return <div className="relative h-40 overflow-hidden rounded-xl border border-neutral-100 bg-neutral-100">
    <Skeleton className="absolute left-0 top-12 h-3 w-full -rotate-12 rounded-none" />
    <Skeleton className="absolute left-1/3 top-0 h-full w-4 rotate-12 rounded-none" />
    <Skeleton className="absolute left-1/2 top-1/2 size-8 -translate-x-1/2 -translate-y-1/2" />
  </div>
}

export function ListLoading({ rows = 4 }) {
  return <div className="space-y-2">{Array.from({ length: rows }, (_, i) => <div key={i} className="flex items-center justify-between gap-4 rounded-xl border border-neutral-100 bg-neutral-50 px-3.5 py-3">
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-3.5 w-36 max-w-full" />
        <Skeleton className="h-2.5 w-52 max-w-full" />
      </div>
      <Skeleton className="h-5 w-16 shrink-0" />
    </div>)}</div>
}

export function PaymentLoading() {
  return <div className="space-y-6">
    <Fields count={8} />
    <TableLoading columns={['Supplier Invoice', 'Allocated Amount', '']} rows={3} minWidth="min-w-0" />
  </div>
}
