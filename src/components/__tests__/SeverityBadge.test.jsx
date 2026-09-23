import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import SeverityBadge from '../ui/SeverityBadge'

describe('SeverityBadge', () => {
  it('renders the "sev-mod" class for the backend value "moderate"', () => {
    render(<SeverityBadge severity="moderate" />)
    expect(screen.getByText('Moderate')).toHaveClass('sev-mod')
  })

  it('renders "sev-low" for "low"', () => {
    render(<SeverityBadge severity="low" />)
    expect(screen.getByText('Low')).toHaveClass('sev-low')
  })

  it('renders "sev-high" for "high"', () => {
    render(<SeverityBadge severity="high" />)
    expect(screen.getByText('High')).toHaveClass('sev-high')
  })

  it('renders a neutral badge when severity is missing', () => {
    render(<SeverityBadge severity={null} />)
    expect(screen.getByText('Unknown')).toBeInTheDocument()
  })

  it('renders "None" when severity is "none"', () => {
    render(<SeverityBadge severity="none" />)
    expect(screen.getByText('None')).toBeInTheDocument()
  })
})
