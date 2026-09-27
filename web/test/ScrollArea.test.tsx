import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ScrollArea from '../src/components/ScrollArea'

function setMetrics(el: HTMLElement, { scrollHeight, clientHeight, scrollTop }: { scrollHeight: number; clientHeight: number; scrollTop: number }) {
  Object.defineProperty(el, 'scrollHeight', { configurable: true, value: scrollHeight })
  Object.defineProperty(el, 'clientHeight', { configurable: true, value: clientHeight })
  Object.defineProperty(el, 'scrollTop', { configurable: true, writable: true, value: scrollTop })
}

const pill = () => screen.getByText(/scroll for more/i).closest('button') as HTMLButtonElement

describe('ScrollArea', () => {
  it('shows "Scroll for more" only while there is more content below', () => {
    render(<ScrollArea><p>content</p></ScrollArea>)
    const area = screen.getByTestId('scroll-area')

    setMetrics(area, { scrollHeight: 1200, clientHeight: 500, scrollTop: 0 })
    act(() => { fireEvent.scroll(area) })
    expect(pill().className).toContain('opacity-100')
    expect(pill()).toHaveAttribute('aria-hidden', 'false')

    setMetrics(area, { scrollHeight: 1200, clientHeight: 500, scrollTop: 700 })
    act(() => { fireEvent.scroll(area) })
    expect(pill().className).toContain('opacity-0')
    expect(pill()).toHaveAttribute('aria-hidden', 'true')
  })

  it('stays hidden when everything fits', () => {
    render(<ScrollArea><p>short</p></ScrollArea>)
    const area = screen.getByTestId('scroll-area')
    setMetrics(area, { scrollHeight: 400, clientHeight: 500, scrollTop: 0 })
    act(() => { fireEvent.scroll(area) })
    expect(pill().className).toContain('opacity-0')
  })

  it('scrolls down most of a screenful when tapped', () => {
    render(<ScrollArea><p>content</p></ScrollArea>)
    const area = screen.getByTestId('scroll-area')
    setMetrics(area, { scrollHeight: 1200, clientHeight: 500, scrollTop: 0 })
    const scrollBy = vi.fn()
    area.scrollBy = scrollBy as unknown as typeof area.scrollBy
    act(() => { fireEvent.scroll(area) })
    fireEvent.click(pill())
    expect(scrollBy).toHaveBeenCalledWith({ top: 400, behavior: 'smooth' })
  })
})
