import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowUpRight, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronRight, CreditCard, FileText, Info, Link2, Mail, MapPin, MoreVertical, Package, Phone, Plus, Search, Send, Tags, Truck, UserRound, Warehouse } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import { getFileUrl } from '../../api/files'
import { formatCurrency } from '../../utils/format'
import { ORDER_STATUS_VARIANT, PAYMENT_STATUS_VARIANT, formatOrderStatus, formatPaymentStatus } from './orderHelpers'
import './orderDetail.css'

const shown = (value) => value == null || value === '' ? '—' : value
const date = (value, time = false) => {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '—'
  return time ? parsed.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}
const dateTime = (value) => value ? `${date(value)}, ${date(value, true)}` : '—'

function Panel({ title, extra, children, className = '' }) {
  return <section className={`od-card ${className}`}><div className="od-card-head"><h2>{title}</h2>{extra}</div>{children}</section>
}
function Field({ icon: Icon, label, children }) {
  return <div className="od-field">{Icon && <Icon size={15} />}<div><small>{label}</small><div>{children || '—'}</div></div></div>
}
function MapAction({ href, children }) {
  return href ? <a className="od-button" href={href} target="_blank" rel="noreferrer">{children}</a> : <button className="od-button" disabled>{children}</button>
}

// All data and actions come from OrderDetail's existing integrations. No requests here.
export default function OrderDetailView({ order, creator, delivery, progress, timeline, source, fulfilmentLabel, isPickupOrder, isDemo, productMeta, invoicedByProduct, primaryActions, moreActions, alerts, returns, onBack, onQuotation }) {
  const [search, setSearch] = useState('')
  const [showAllActivity, setShowAllActivity] = useState(false)
  const address = order.deliveryAddress
  const mapsHref = address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : ''
  const sourceNode = source.isQuotation ? <button className="od-link" onClick={onQuotation}>{order.quotationNumber || 'Quotation'}</button> : 'Direct'
  const paymentBadge = order.paymentStatus ? <Badge variant={PAYMENT_STATUS_VARIANT[order.paymentStatus] || 'neutral'}>{formatPaymentStatus(order.paymentStatus)}</Badge> : null
  const filteredItems = order.items.filter((item) => `${item.productName} ${item.sku || productMeta[item.productId]?.sku || ''}`.toLowerCase().includes(search.toLowerCase()))
  const completed = progress.length > 0 && progress.every((step) => step.status === 'done')
  const progressLabels = ['Order Confirmed', 'Stock Reserved', 'Delivery Assigned', 'Picking', 'Vehicle Loaded', 'In Transit', 'Delivered']
  const displayProgress = progressLabels.map((label) => {
    const existing = progress.find((step) => step.label === label)
    if (existing) return existing
    if (isPickupOrder && label === 'Picking') {
      return { label, status: ['ready', 'collected'].includes(order.pickupStatus) ? 'done' : order.pickupStatus === 'picking' ? 'current' : 'pending' }
    }
    return { label, status: isPickupOrder ? 'not-applicable' : 'pending' }
  })
  // New milestone timestamps must not be guessed from updatedAt or the current date.
  const milestoneTimes = { 'Order Confirmed': order.approvedAt, 'Picked Up': order.collectedAt }

  return <div className="order-detail-view">
    <nav className="od-breadcrumb" aria-label="Breadcrumb"><button onClick={onBack}><ArrowLeft size={13} />Orders</button><ChevronRight size={12} /><span>{order.orderNumber}</span></nav>
    <header className="od-header"><div className="od-heading"><div className="od-title"><h1>{order.orderNumber}</h1><Badge className={order.status === 'completed' ? 'od-order-status od-completed' : 'od-order-status'} variant={ORDER_STATUS_VARIANT[order.status] || 'neutral'}>{order.status === 'completed' && <CheckCircle2 size={14} />}{formatOrderStatus(order.status)}</Badge>{isDemo && <Badge variant="warning">Demo</Badge>}{order.demoErrorState && <Badge variant="danger">Demo Error State</Badge>}</div><div className="od-subtitle"><span>Created on {dateTime(order.createdAt)}</span><Badge className="od-fulfilment-badge" variant="info">{fulfilmentLabel}</Badge><Badge className="od-fulfilment-status" variant={delivery.variant}>{['delivered', 'picked_up'].includes(delivery.key) && <Check size={14} />}{delivery.label}</Badge><span className="od-source-badge">{sourceNode}</span>{order.paymentStatus && <Badge className="od-header-payment" variant={PAYMENT_STATUS_VARIANT[order.paymentStatus] || 'neutral'}>Payment {formatPaymentStatus(order.paymentStatus)}</Badge>}</div></div>
      <div className="od-header-actions">{primaryActions}<button className="od-button od-send" disabled title="Invoice sending will be available after integration"><Send size={14} />Send Invoice</button><details className="od-more"><summary className="od-button"><MoreVertical size={14} />More Actions<ChevronDown size={12} /></summary><div className="od-more-menu">{moreActions}</div></details></div>
    </header>
    {alerts}
    <section className="od-card od-overview"><div className="od-customer"><h2>Customer</h2><div className="od-customer-content"><div className="od-avatar"><UserRound size={49} strokeWidth={1.4} /></div><div><Link className="od-customer-name" to={`/admin/customers/${order.customerId}`}>{order.customerName}</Link><p><Phone size={13} />{shown(order.customerPhone)}</p><p><Mail size={13} />{shown(order.customerEmail)}</p><p><MapPin size={14} />{shown(address)}</p><div className="od-contact-actions">{order.customerPhone ? <a href={`tel:${order.customerPhone}`} className="od-button od-green"><Phone size={13} />Call Customer</a> : <button className="od-button od-green" disabled><Phone size={13} />Call Customer</button>}<MapAction href={mapsHref}><MapPin size={13} />Open Location</MapAction></div></div></div></div>
      <div className="od-map"><div className="od-map-roads" aria-hidden="true" /><MapPin className="od-map-marker" size={35} fill="#08783d" color="white" /><span className="od-map-preview">Map preview</span><MapAction href={mapsHref}>View on Map<ArrowUpRight size={12} /></MapAction></div>
      <div className="od-overview-fields"><Field icon={CalendarDays} label="Order Date"><strong>{date(order.orderDate)}</strong><small>{date(order.orderDate, true)}</small></Field><Field icon={Link2} label="Order Source">{sourceNode}</Field><Field icon={CreditCard} label="Payment Type"><span className="od-capitalize">{shown(order.paymentType)}</span>{order.paymentTermsDays > 0 && <small>{order.paymentTermsDays} Days</small>}</Field><Field icon={Warehouse} label="Warehouse">{shown(order.warehouseName)}</Field><Field icon={Package} label="Total Amount"><strong>{formatCurrency(order.total)}</strong></Field></div>
    </section>
    {progress.length > 0 && order.status !== 'cancelled' && (
      <Panel
        title="Order Progress"
        className="od-progress-card"
        extra={
          <Badge className="od-progress-status" variant={delivery.variant}>
            {completed && <CheckCircle2 size={15} fill="currentColor" className="od-progress-status-icon" />}
            {delivery.label}
          </Badge>
        }
      >
        <p className="od-progress-caption">
          {isPickupOrder ? (completed ? 'Pickup completed · Delivery-only stages are not applicable' : 'Pickup order · Delivery-only stages are not applicable') : completed ? 'All stages completed successfully' : 'Track order fulfilment'}
        </p>
        <ol
          className="od-progress"
          aria-label={isPickupOrder ? 'Pickup order progress' : 'Home delivery order progress'}
        >
          {displayProgress.map((step, index) => (
            <li
              key={step.label}
              className={'od-step-' + step.status}
              aria-current={step.status === 'current' ? 'step' : undefined}
            >
              <span className="od-step-dot">
                {step.status === 'done' ? <Check size={17} strokeWidth={2.5} /> : step.status === 'not-applicable' ? '—' : index + 1}
              </span>
              <strong>{step.label}</strong>
              <span className="od-step-date">{step.status === 'not-applicable' ? 'Not applicable' : date(milestoneTimes[step.label])}</span>
              <span className="od-step-time">
                {step.status === 'not-applicable' ? '' : milestoneTimes[step.label] ? date(milestoneTimes[step.label], true).toUpperCase() : '—'}
              </span>
            </li>
          ))}
        </ol>
      </Panel>
    )}
    <div className="od-columns"><div className="od-main">
      <Panel title={`Ordered Products (${order.items.length} ${order.items.length === 1 ? 'item' : 'items'})`} className="od-products-card" extra={<label className="od-search"><Search size={13} /><input aria-label="Search products" placeholder="Search products..." value={search} onChange={(event) => setSearch(event.target.value)} /></label>}><div className="od-table-scroll"><table className="od-products"><thead><tr>{['#', 'Product', 'SKU', 'Unit Price', 'Ordered', 'Reserved', 'Delivered', 'Invoiced', 'Remaining', 'Discount', 'Tax', 'Line Total'].map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>{filteredItems.map((item) => {
        const meta = productMeta[item.productId] || {}
        const image = meta.image || getFileUrl(item.productImage || '')
        const sku = item.sku || meta.sku || ''
        return <tr key={item.id || item.productId}><td>{order.items.indexOf(item) + 1}</td><td><div className="od-product"><div className="od-product-image"><Package size={22} />{image && <img src={image} alt="" onError={(event) => { event.currentTarget.style.display = 'none' }} />}</div><div><strong>{item.productName}</strong>{sku && <small>SKU: {sku}</small>}</div></div></td><td className="od-sku">{shown(sku)}</td><td>{formatCurrency(item.unitPrice)}{item.costPrice != null && <small>Cost: {formatCurrency(item.costPrice)}</small>}</td><td>{item.quantity}</td><td>{item.reservedQuantity}</td><td>{item.deliveredQuantity}</td><td>{invoicedByProduct[item.productId || item.id] || 0}</td><td>{item.remainingQuantity}</td><td>{item.discountPercent > 0 ? `${item.discountPercent}%` : '—'}</td><td>{item.taxRate != null ? `${item.taxRate}%` : '—'}</td><td><strong>{formatCurrency(item.lineTotal)}</strong></td></tr>
      })}</tbody></table>{!filteredItems.length && <p className="od-empty">No products found.</p>}</div></Panel>
      <Panel
        title="Delivery Summary"
        className="od-delivery-summary"
        extra={
          <Badge className="od-delivery-badge" variant={delivery.variant}>
            {['delivered', 'picked_up'].includes(delivery.key) && <CheckCircle2 size={14} fill="currentColor" className="od-summary-check" />}
            {delivery.label}
          </Badge>
        }
      >
        <div className="od-delivery-grid">
          <div className="od-delivery-column">
            <Field icon={Truck} label="Delivery Partner">
              {order.assignedDeliveryPartnerName || (isPickupOrder ? 'Not applicable' : 'Not assigned')}
            </Field>
            <Field icon={CalendarDays} label="Expected Delivery">
              {isPickupOrder ? 'Not applicable' : date(order.deliveryDate)}
            </Field>
            <div className={delivery.key === 'delivered' ? 'od-actual-delivered' : ''}>
              <Field icon={CheckCircle2} label="Actual Delivery">
                {isPickupOrder ? 'Not applicable' : order.deliveredAt ? date(order.deliveredAt) + ', ' + date(order.deliveredAt, true).toUpperCase() : '—'}
              </Field>
            </div>
          </div>
          <div className="od-delivery-column">
            <Field icon={Tags} label="Delivery ID">{shown(order.deliveryNumber)}</Field>
            <Field icon={MapPin} label="Delivery Address">
              <p>{shown(address)}</p>
              <MapAction href={mapsHref}><MapPin size={12} />Open in Maps<ArrowUpRight size={12} /></MapAction>
            </Field>
          </div>
          <div className="od-delivery-outcome-column">
            <div className={'od-delivery-outcome ' + (['delivered', 'picked_up'].includes(delivery.key) ? 'od-outcome-done' : '')}>
              <span><Truck size={28} fill="currentColor" strokeWidth={1.5} /></span>
              <div>
                <strong>{delivery.key === 'delivered' ? 'Delivered Successfully' : delivery.label}</strong>
                <p>{delivery.key === 'delivered' ? 'Goods reached the customer' : isPickupOrder ? 'Order collected by the customer' : 'Order delivery status'}</p>
                {(isPickupOrder ? order.collectedAt : order.deliveredAt) && (
                  <p>on {date(isPickupOrder ? order.collectedAt : order.deliveredAt)}, {date(isPickupOrder ? order.collectedAt : order.deliveredAt, true).toUpperCase()}.</p>
                )}
              </div>
            </div>
          </div>
        </div>
        {isPickupOrder && (
          <details className="od-pickup-record">
            <summary>Pickup details</summary>
            <div>
              <Field label="Fulfilment Method">Takeaway / Self Pickup</Field>
              <Field label="Expected Pickup">{date(order.deliveryDate)}</Field>
              <Field label="Collected By">{shown(order.collectedBy)}</Field>
              <Field label="Collected At">{dateTime(order.collectedAt)}</Field>
              <Field label="Pickup Notes">{shown(order.pickupNotes)}</Field>
            </div>
          </details>
        )}
      </Panel>
      <Panel title={<><FileText size={16} />Notes</>} extra={<button className="od-button" disabled title="Adding notes will be available after integration"><Plus size={13} />Add Note</button>}><div className="od-notes"><p>{order.notes || 'No notes added.'}</p><div><time>{dateTime(order.createdAt)}</time><span>By {creator?.name || '—'}</span></div></div></Panel>
      {returns}
    </div><aside className="od-side"><Panel title="Order Summary"><dl className="od-totals"><div><dt>Subtotal</dt><dd>{formatCurrency(order.subtotal)}</dd></div><div><dt>Discount</dt><dd>-{formatCurrency(order.discount)}</dd></div><div><dt>Tax</dt><dd>{formatCurrency(order.tax)}</dd></div><div className="od-total"><dt>Total Amount</dt><dd>{formatCurrency(order.total)}</dd></div></dl></Panel>
      <Panel title="Payment Summary" extra={paymentBadge}><dl className="od-totals"><div><dt>Payment Method</dt><dd className="od-capitalize">{shown(order.paymentMethod || order.paymentType)}</dd></div>{order.paymentStatus && <><div><dt>Paid Amount</dt><dd>{formatCurrency(order.paidAmount || 0)}</dd></div><div><dt>Remaining Amount</dt><dd>{formatCurrency(order.remainingAmount || 0)}</dd></div></>}{order.demoPayment && <><div><dt>Previous Balance</dt><dd>{formatCurrency(order.demoPayment.previousBalance)}</dd></div><div><dt>Total Due</dt><dd>{formatCurrency(order.demoPayment.totalDue)}</dd></div><div><dt>Paid</dt><dd>{formatCurrency(order.demoPayment.paid)}</dd></div><div><dt>Remaining Balance</dt><dd>{formatCurrency(order.demoPayment.remaining)}</dd></div></>}</dl><p className="od-payment-note"><Info size={17} />{order.demoPayment ? 'Demo payment figures for manual testing — not persisted.' : order.paymentStatus ? ((order.remainingAmount || 0) > 0 ? 'Payment is pending. Invoice and payment records determine the remaining balance.' : 'Payment amounts reflect the invoice and recorded payments.') : 'Receivables are created once this order is invoiced, not at placement.'}</p></Panel>
      <Panel
        title="Activity Timeline"
        className="od-activity-card"
        extra={
          <button
            className="od-view-all"
            onClick={() => setShowAllActivity(!showAllActivity)}
            aria-expanded={showAllActivity}
            aria-controls="order-activity-timeline"
          >
            {showAllActivity ? 'Show Less' : 'View All'}<ChevronRight size={13} />
          </button>
        }
      >
        <ol className="od-timeline" id="order-activity-timeline">
          {(showAllActivity ? timeline : timeline.slice(0, 8)).map((event) => {
            const isCancelled = event.id === 'cancelled'
            const EventIcon = isCancelled ? event.icon : Check
            return (
              <li key={event.id} className={isCancelled ? 'od-event-cancelled' : undefined}>
                <span className="od-event-icon"><EventIcon size={11} strokeWidth={2.8} /></span>
                <div className="od-event-copy">
                  <strong>{event.title}</strong>
                  {event.subtitle && (
                    <p>{event.subtitle}{event.id === 'created' && creator?.name ? ' created by ' + creator.name : ''}</p>
                  )}
                </div>
                <time dateTime={event.timestamp || undefined}>
                  {event.timestamp ? date(event.timestamp) + ', ' + date(event.timestamp, true).toUpperCase() : '—'}
                </time>
              </li>
            )
          })}
        </ol>
        {!timeline.length && <p className="od-empty">No activity recorded yet.</p>}
      </Panel>
    </aside></div>
  </div>
}
