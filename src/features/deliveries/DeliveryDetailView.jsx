import { useState } from 'react'
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, CheckCircle2, ChevronRight, Clock3, CreditCard, FileText, Image, Mail, MapPin, MoreHorizontal, Package, Phone, Printer, RefreshCw, Search, Truck, UserRound, Warehouse } from 'lucide-react'
import { deliveryStageIndex, DELIVERY_STAGES, getDeliveryStage } from './deliveryStage'
import { formatCurrency } from '../../utils/format'
import './deliveryDetail.css'

const display = (value) => value == null || value === '' ? '—' : value
const money = (value) => value == null ? '—' : formatCurrency(value)
const date = (value, time = false) => {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '—'
  return time ? parsed.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}
const stamp = (value) => value ? `${date(value)}, ${date(value, true)}` : '—'
const eventTime = (event) => event?.created_at || event?.at || event?.timestamp || event?.time
const eventLabel = (event) => String(event?.event_type || event?.label || event?.event || event?.title || event?.status || event?.action || 'Delivery updated').replace(/_/g, ' ')

function Panel({ icon: Icon, title, extra, className = '', children }) {
  return <section className={`dd-card ${className}`}><div className="dd-card-heading"><h2><Icon size={19} aria-hidden="true" />{title}</h2>{extra}</div>{children}</section>
}
function Status({ stage }) {
  return <span className={`dd-status dd-status-${stage.variant}`}><CheckCircle2 size={13} />{stage.label}</span>
}
function Fields({ rows }) {
  return <dl className="dd-fields">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{display(value)}</dd></div>)}</dl>
}
function MapLink({ href, children, className = '' }) {
  return href ? <a className={`dd-button ${className}`} href={href} target="_blank" rel="noreferrer">{children}</a> : <button className={`dd-button ${className}`} disabled>{children}</button>
}

// Presentation only: missing fields stay empty until their API integration is supplied.
export default function DeliveryDetailView({ delivery, paidAmount, warehouseName, customerLabel, customerPhone, mapsHref, podFiles, signatureUrl, onBack, onOrder, onManage, onPrint }) {
  const [query, setQuery] = useState('')
  const [allActivity, setAllActivity] = useState(false)
  const stage = getDeliveryStage(delivery)
  const stageIndex = deliveryStageIndex(delivery)
  const address = delivery.customerDeliveryAddress || delivery.deliveryAddress
  const events = delivery.timeline || []
  const items = delivery.items.filter((item) => `${item.productName} ${item.sku || ''}`.toLowerCase().includes(query.toLowerCase()))
  const labels = ['Delivery Created', 'Accepted', 'Picking Started', 'Packed', 'Vehicle Loaded', 'Out for Delivery', 'Delivered']
  const total = delivery.orderTotal ?? delivery.order?.total
  const paid = paidAmount // Preserve the existing reconciled-payment calculation.
  const milestones = ['planned', 'accepted', 'picking', 'ready', 'loaded', 'in_transit', 'delivered']
  const stepTime = (index) => {
    const event = events.find((entry) => entry.new_status === milestones[index])
    return eventTime(event) || (index === 0 ? delivery.createdAt : index === 5 ? delivery.dispatchedAt : index === 6 ? delivery.confirmedAt : null)
  }
  return <div className="delivery-detail-view">
    <nav className="dd-breadcrumb" aria-label="Breadcrumb"><button onClick={onBack} aria-label="Back to deliveries"><ArrowLeft size={14} /></button><button onClick={onOrder} disabled={!delivery.orderId || !onOrder}>Orders</button><ChevronRight size={13} /><button onClick={onBack}>Deliveries</button><ChevronRight size={13} /><span>{delivery.deliveryNumber}</span></nav>
    <header className="dd-header"><div><div className="dd-title"><h1>Delivery Detail</h1><Status stage={stage} /></div><p>Delivery ID: {delivery.deliveryNumber}</p></div><div className="dd-actions">
      {delivery.deliveryPartnerPhone ? <a className="dd-button dd-button-solid" href={`tel:${delivery.deliveryPartnerPhone}`}><Phone size={15} />Call Driver</a> : <button className="dd-button dd-button-solid" disabled><Phone size={15} />Call Driver</button>}
      <button className="dd-button dd-button-green" onClick={() => document.getElementById('delivery-status-tracker')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}><MapPin size={16} />Track Delivery</button>
      <button className="dd-button" onClick={onManage}><RefreshCw size={15} />Update Status</button>
      <button className="dd-button" onClick={onPrint}><Printer size={16} />Print Delivery Note</button>
      <button className="dd-button dd-more" onClick={onManage} aria-label="More delivery actions"><MoreHorizontal size={18} /></button>
    </div></header>
    <div className="dd-layout"><div className="dd-main">
      <Panel icon={Truck} title="Delivery Overview" className="dd-overview"><div className="dd-overview-grid"><div className="dd-customer"><div className="dd-contact"><div className="dd-avatar"><UserRound size={62} strokeWidth={1.3} /></div><div><h3>{customerLabel}</h3><p><Phone size={16} />{display(customerPhone)}</p><p><Mail size={16} />{display(delivery.customerEmail)}</p><p><MapPin size={17} />{display(address)}</p></div></div><div className="dd-contact-actions"><MapLink href={customerPhone ? `tel:${customerPhone}` : null} className="dd-button-green"><Phone size={16} />Call Customer</MapLink><MapLink href={mapsHref}><MapPin size={17} />View on Map</MapLink></div></div>
        <div className="dd-map"><div className="dd-map-grid" aria-hidden="true"><i /><i /><i /><i /><i /></div><div className="dd-map-pin"><MapPin size={39} fill="#087a3c" color="white" /><span>{address ? 'Delivery location' : 'Location unavailable'}</span></div><span className="dd-map-caption">Map preview</span><MapLink href={mapsHref}>View Larger Map<ArrowUpRight size={15} /></MapLink></div>
      </div></Panel>
      <div id="delivery-status-tracker"><Panel icon={Truck} title="Delivery Status Tracker" extra={<Status stage={stage} />}><ol className="dd-tracker">{DELIVERY_STAGES.map((step, index) => <li key={step.key} className={index <= stageIndex ? 'is-complete' : ''} aria-current={index === stageIndex ? 'step' : undefined}><span className="dd-step-dot">{index < stageIndex || (index === stageIndex && stage.key === 'delivered') ? <Check size={16} /> : index + 1}</span><strong>{labels[index]}</strong><span>{date(stepTime(index))}</span><span>{stepTime(index) ? date(stepTime(index), true) : ''}</span></li>)}</ol>{stage.offFlow && <p className="dd-muted">{stage.label}</p>}</Panel></div>
      <Panel icon={Package} title={`Packages & Products (${delivery.items.length} ${delivery.items.length === 1 ? 'item' : 'items'})`} extra={<label className="dd-search"><Search size={14} /><input aria-label="Search products" placeholder="Search products..." value={query} onChange={(event) => setQuery(event.target.value)} /></label>}>
        <div className="dd-table-scroll"><table className="dd-products"><thead><tr>{['#', 'Product', 'SKU', 'Qty', 'Unit Price', 'Weight', 'Package Count', 'Delivery Status', 'Line Total'].map((heading) => <th key={heading}>{heading}</th>)}</tr></thead><tbody>{items.map((item, index) => <tr key={item.id}><td>{index + 1}</td><td><div className="dd-product"><span className="dd-product-image"><Package size={22} /></span><span><strong>{item.productName}</strong><small>SKU: {display(item.sku)}</small><details className="dd-item-details"><summary>Quantity &amp; tracking</summary><Fields rows={[[ 'Variant', item.variantId ], ['Planned', item.plannedQuantity], ['Picked', item.pickedQuantity], ['Loaded', item.loadedQuantity], ['Delivered', item.deliveredQuantity], ['Pending', item.pendingQuantity], ...(item.batchNumber || item.expiryDate ? [['Batch', item.batchNumber], ['Expiry', date(item.expiryDate)]] : []), ...(item.serialNumbers?.length ? [['Serial Numbers', item.serialNumbers.join(', ')]] : [])]} /></details></span></div></td><td>{display(item.sku)}</td><td>{item.plannedQuantity}</td><td>{money(item.unitPrice)}</td><td>{item.weight != null ? `${item.weight} kg` : '—'}</td><td>{display(item.packageCount)}</td><td><Status stage={Number(item.deliveredQuantity) >= Number(item.plannedQuantity) && Number(item.plannedQuantity) > 0 ? { label: 'Delivered', variant: 'success' } : stage.key === 'delivered' ? { label: 'Pending', variant: 'warning' } : stage} /></td><td>{item.unitPrice != null ? money(Number(item.unitPrice) * Number(item.plannedQuantity)) : '—'}</td></tr>)}</tbody></table>{!items.length && <p className="dd-empty">No products found.</p>}</div>
      </Panel>
      <Panel icon={MapPin} title="Route / Address Information"><div className="dd-route"><div><span className="dd-route-icon"><Warehouse size={24} /></span><div><small>Pickup Address</small><p>{warehouseName || 'Warehouse not assigned'}</p><p>{display(delivery.warehouseAddress)}</p></div></div><ArrowRight className="dd-route-arrow" size={23} /><div><span className="dd-route-icon"><MapPin size={23} /></span><div><small>Delivery Address</small><p>{display(address)}</p><MapLink href={mapsHref}><MapPin size={13} />Open in Maps<ArrowUpRight size={13} /></MapLink></div></div></div></Panel>
      <Panel icon={FileText} title="Delivery Notes"><p className="dd-notes">{delivery.notes || 'No delivery notes added.'}</p></Panel>
    </div><aside className="dd-side">
      <Panel icon={FileText} title="Delivery Summary"><Fields rows={[
        ['Delivery ID', delivery.deliveryNumber], ['Linked Order ID', delivery.orderId && onOrder ? <button key="order" className="dd-link" onClick={onOrder}>{delivery.orderNumber || delivery.orderId}</button> : display(delivery.orderNumber)], ['Delivery Status', <Status key="status" stage={stage} />], ['Delivery Type', delivery.deliveryType], ['Delivery Partner', delivery.deliveryPartnerName || 'Unassigned'], ['Driver Name', delivery.driverName || delivery.deliveryPartnerName], ['Driver Phone', delivery.deliveryPartnerPhone], ['Vehicle Number', delivery.vehicleNumber], ['Order Created By', delivery.orderCreatedByName], ['Scheduled Delivery', stamp(delivery.scheduledDate)], ['Actual Delivery Time', stamp(delivery.confirmedAt)], ['Previous Balance', money(delivery.previousPendingBalance)], ['Total Amount', money(total)],
      ]} /><details className="dd-item-details"><summary>Additional delivery details</summary><Fields rows={[[ 'Order Status', delivery.order?.status || delivery.orderStatus ], ['Fulfilment Status', delivery.order?.fulfilmentStatus || delivery.fulfilmentStatus], ['Vehicle Type', delivery.vehicleType], ['Vehicle Capacity', delivery.vehicleCapacityKg != null ? delivery.vehicleCapacityKg + ' kg' : null], ['Warehouse', warehouseName], ['Dispatched At', stamp(delivery.dispatchedAt)], ['Partner Email', delivery.deliveryPartnerEmail], ['Employee ID', /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(delivery.deliveryPartnerEmployeeId || '') ? null : delivery.deliveryPartnerEmployeeId], ...(delivery.failureReason ? [['Failure Reason', delivery.failureReason]] : [])]} /></details></Panel>
      <Panel icon={CreditCard} title="Payment Summary"><Fields rows={[[ 'Payment Method', delivery.paymentMethod ], ['Paid Amount', money(paid)], ['Remaining Amount', money(delivery.amountDue)]]} /><div className="dd-payment-state"><strong>Payment Status</strong><span><Clock3 size={14} />{delivery.paymentStatus || (Number(delivery.amountDue) > 0 ? 'Pending' : '—')}</span></div></Panel>
      <Panel icon={Image} title="Proof of Delivery"><div className={`dd-proof ${stage.key === 'delivered' ? 'dd-proof-success' : ''}`}><div className="dd-proof-image">{podFiles[0]?.url ? <a href={podFiles[0].url} target="_blank" rel="noreferrer"><img src={podFiles[0].url} alt="Proof of delivery" /></a> : <Image size={28} />}</div><div><strong><CheckCircle2 size={14} />{stage.key === 'delivered' ? 'Delivered Successfully' : stage.label}</strong><small>Recipient</small><p>{display(delivery.receiverName)}</p><small>Delivered at</small><p>{stamp(delivery.confirmedAt)}</p></div></div>{podFiles.length > 1 && <div className="dd-proof-links">{podFiles.slice(1).map((file, index) => <a key={file.url} href={file.url} target="_blank" rel="noreferrer">Photo {index + 2}</a>)}</div>}{signatureUrl && <a className="dd-link" href={signatureUrl} target="_blank" rel="noreferrer">View signature</a>}</Panel>
      <Panel icon={Clock3} title="Activity Timeline" extra={events.length > 6 && <button className="dd-view-all" onClick={() => setAllActivity(!allActivity)}>{allActivity ? 'Show Less' : 'View All'}<ChevronRight size={13} /></button>}><ol className="dd-activity">{(allActivity ? events : events.slice(0, 6)).map((event, index) => <li key={event.id || index}><span className="dd-activity-dot"><Check size={10} /></span><div><strong>{eventLabel(event)}</strong><p>{event.actor?.name || event.actor_name || ''}</p><p>{event.previous_status && event.new_status ? event.previous_status.replace(/_/g, ' ') + ' → ' + event.new_status.replace(/_/g, ' ') : ''}</p><p>{event.notes || event.note || event.description || event.detail || event.reason || ''}</p></div><time>{stamp(eventTime(event))}</time></li>)}</ol>{!events.length && <p className="dd-empty">No activity recorded yet.</p>}</Panel>
    </aside></div>
  </div>
}
