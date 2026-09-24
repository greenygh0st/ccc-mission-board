import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import UpdateCard from '../src/components/UpdateCard'
import { mis, upd } from './fixtures'

describe('UpdateCard', () => {
  it('renders user-submitted text as text, never HTML', () => {
    const body = '<img src=x onerror="alert(1)"><b>bold</b>\nline two'
    const { container } = render(<UpdateCard update={upd('u', 'a', 1, { body })} missionary={mis('a')} />)
    expect(container.querySelector('img[src="x"]')).toBeNull()
    expect(container.querySelector('b')).toBeNull()
    expect(screen.getByText(/<b>bold<\/b>/)).toBeInTheDocument()
  })
})
