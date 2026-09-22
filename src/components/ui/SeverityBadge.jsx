import { cn } from '../../lib/utils'
import { sevClass, sevLabel } from '../../lib/severity'

// The single owner of the backend `severity` value -> `.sev-*` CSS class
// mapping (see src/lib/severity.js). Every severity pill in the app should
// render through this component.
export default function SeverityBadge({ severity, className }) {
  if (!severity) {
    return (
      <span className={cn('sev', 'bg-[rgba(148,163,184,0.12)] text-muted', className)}>
        <i className="bg-muted" />
        Unknown
      </span>
    )
  }
  return (
    <span className={cn('sev', sevClass(severity), className)}>
      <i />
      {sevLabel(severity)}
    </span>
  )
}
