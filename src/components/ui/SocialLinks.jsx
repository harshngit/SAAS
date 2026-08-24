import { FaFacebook, FaGlobe, FaInstagram, FaLinkedin, FaXTwitter, FaYoutube } from 'react-icons/fa6'

// Shared social-link renderer so every module (Customers, Suppliers, Company, ...) that shows
// website/social fields uses the same real brand icons instead of a generic globe repeated for
// every platform. Pass whichever of these keys the record has - anything missing is just skipped.
// Compact wrapping pills, not a stacked list, so this stays cheap on vertical space.
const PLATFORM_META = {
  website: { icon: FaGlobe, label: (value) => value.replace(/^https?:\/\//i, '') },
  facebook: { icon: FaFacebook, label: () => 'Facebook' },
  instagram: { icon: FaInstagram, label: () => 'Instagram' },
  linkedin: { icon: FaLinkedin, label: () => 'LinkedIn' },
  twitter: { icon: FaXTwitter, label: () => 'X (Twitter)' },
  youtube: { icon: FaYoutube, label: () => 'YouTube' },
}

function toHref(key, value) {
  if (key !== 'website') return value
  return /^https?:\/\//i.test(value) ? value : `https://${value}`
}

export default function SocialLinks({ links, emptyLabel = 'No social links added.' }) {
  const items = Object.entries(PLATFORM_META)
    .map(([key, meta]) => {
      const value = links?.[key]
      if (!value) return null
      return { key, Icon: meta.icon, label: meta.label(value), href: toHref(key, value) }
    })
    .filter(Boolean)

  if (items.length === 0) {
    return <p className="text-sm text-neutral-400">{emptyLabel}</p>
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map(({ key, Icon, label, href }) => (
        <a
          key={key}
          href={href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-full border border-neutral-200 px-3.5 py-1.5 text-sm font-medium text-primary-700 transition-colors hover:bg-primary-50/60"
        >
          <Icon className="size-4 shrink-0 text-neutral-500" aria-hidden="true" />
          {label}
        </a>
      ))}
    </div>
  )
}
