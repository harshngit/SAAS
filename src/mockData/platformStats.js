import { eachMonthOfInterval, endOfMonth, format, isBefore } from 'date-fns'
import { organizations } from './organizations'
import { planPricing } from './plans'

const NOW = new Date('2026-07-17')

const statusCounts = organizations.reduce((acc, org) => {
  acc[org.status] = (acc[org.status] || 0) + 1
  return acc
}, {})

const planCounts = organizations.reduce((acc, org) => {
  acc[org.plan] = (acc[org.plan] || 0) + 1
  return acc
}, {})

const mrr = organizations
  .filter((org) => org.status === 'active')
  .reduce((sum, org) => sum + (planPricing[org.plan] || 0), 0)

const earliestCreatedAt = organizations.reduce(
  (earliest, org) => (org.createdAt < earliest ? org.createdAt : earliest),
  organizations[0].createdAt,
)

const orgGrowthSeries = eachMonthOfInterval({ start: new Date(earliestCreatedAt), end: NOW }).map((monthDate) => {
  const monthEnd = endOfMonth(monthDate)
  const total = organizations.filter((org) => !isBefore(monthEnd, new Date(org.createdAt))).length
  return { label: format(monthDate, 'MMM yy'), total }
})

export const platformStats = {
  asOf: format(NOW, 'yyyy-MM-dd'),
  totalOrgs: organizations.length,
  activeCount: statusCounts.active || 0,
  trialCount: statusCounts.trial || 0,
  suspendedCount: statusCounts.suspended || 0,
  mrr,
  planCounts,
  orgGrowthSeries,
}
