import { PageSkeleton } from './Skeleton'

export default function LoadingSpinner({ size = 'md', label, className = '' }) {
  const rowsBySize = {
    sm: 1,
    md: 2,
    lg: 3,
  }

  return (
    <PageSkeleton label={label} rows={rowsBySize[size] || rowsBySize.md} className={`py-2 ${className}`} />
  )
}
