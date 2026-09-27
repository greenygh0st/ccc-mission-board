import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Board, groupForStrip, spotlightOrder } from '../src/App'
import type { PlacedMissionary } from '../src/globe/geo'
import { boardFixture } from './fixtures'

// WebGL doesn't exist in jsdom — stand the globe in with a list of dots.
vi.mock('../src/globe/MissionGlobe', () => ({
  default: (p: { placed: PlacedMissionary[]; focusId: string | null; autoRotate: boolean; onSelect: (id: string) => void }) => (
    <div data-testid="globe" data-focus={p.focusId ?? ''} data-rotate={String(p.autoRotate)}>
      {p.placed.map((d) => (
        <button key={d.missionary.id} data-testid={`dot-${d.missionary.id}`} onClick={() => p.onSelect(d.missionary.id)} />
      ))}
    </div>
  ),
}))

const rail = () => document.querySelector('aside') as HTMLElement

describe('Board', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }))
  afterEach(() => vi.useRealTimers())

  it('shows the latest 3 updates overall by default', async () => {
    render(<Board data={boardFixture()} />)
    expect(await within(rail()).findByText('Title a1')).toBeInTheDocument()
    expect(rail().querySelectorAll('article')).toHaveLength(3)
    expect(within(rail()).getByText('Title a1')).toBeInTheDocument()
    expect(within(rail()).getByText('Title b1')).toBeInTheDocument()
    expect(within(rail()).getByText('Title s1')).toBeInTheDocument() // sensitive updates appear, under the alias
  })

  it('switches the rail to the selected missionary\'s latest 3 and back', async () => {
    render(<Board data={boardFixture()} />)
    fireEvent.click(await screen.findByTestId('dot-a'))

    expect(await within(rail()).findByRole('heading', { name: 'The Okafor Family' })).toBeInTheDocument()
    expect(within(rail()).getByText('Title a3')).toBeInTheDocument()
    expect(within(rail()).queryByText('Title a4')).toBeNull()
    expect(within(rail()).queryByText('Title b1')).toBeNull()
    expect(screen.getByTestId('globe').dataset.focus).toBe('a')

    fireEvent.click(within(rail()).getByRole('button', { name: /all updates/i }))
    expect(await within(rail()).findByText('Title b1')).toBeInTheDocument()
  })

  it('a sensitive missionary opens from the strip without flying the globe and without a website QR', async () => {
    render(<Board data={boardFixture()} />)
    fireEvent.click(document.querySelector('[data-id="s"]')!) // strip chip
    expect(await within(rail()).findByText(/kept private/)).toBeInTheDocument()
    expect(screen.getByTestId('globe').dataset.focus).toBe('')
    expect(screen.queryByTestId('dot-s')).toBeNull()
  })

  it('enters attract mode after the idle timeout and leaves it on touch', async () => {
    render(<Board data={boardFixture()} />)
    fireEvent.click(await screen.findByTestId('dot-a'))
    await act(async () => { vi.advanceTimersByTime(61_000) })

    expect(await within(rail()).findByText(/touch to explore/i)).toBeInTheDocument()
    expect(screen.getByTestId('globe').dataset.focus).toBe('a') // newest news spotlighted first

    await act(async () => { vi.advanceTimersByTime(10_000) })
    expect(screen.getByTestId('globe').dataset.focus).toBe('b')

    act(() => { window.dispatchEvent(new Event('pointerdown')) })
    expect(await within(rail()).findByText(/latest from the field/i)).toBeInTheDocument()
    expect(screen.getByTestId('globe').dataset.focus).toBe('')
  })
})

describe('church logo', () => {
  const img = { thumb: '/media/l/thumb', full: '/media/l/full' }

  it('shows the square logo as a circle, preferring it over a wordmark', () => {
    const data = boardFixture()
    data.church.logo = img
    data.church.wordmark = { thumb: '/media/w/thumb', full: '/media/w/full' }
    render(<Board data={data} />)
    const logo = screen.getByRole('img', { name: 'Test Church' })
    expect(logo).toHaveAttribute('src', '/media/l/full')
    expect(logo.className).toContain('rounded-full')
  })

  it('falls back to an uncropped wordmark when there is no logo', () => {
    const data = boardFixture()
    data.church.wordmark = img
    render(<Board data={data} />)
    expect(screen.getByRole('img', { name: 'Test Church' }).className).not.toContain('rounded-full')
  })
})

describe('helpers', () => {
  it('groups the strip by region in display order with sensitive last', () => {
    const groups = groupForStrip(boardFixture().missionaries)
    expect(groups.map((g) => g.label)).toEqual(['East Africa', 'South America', 'South Asia', 'Serving in sensitive locations'])
  })

  it('orders the spotlight by newest update', () => {
    expect(spotlightOrder(boardFixture().missionaries)).toEqual(['a', 'b', 's', 'c'])
  })
})
