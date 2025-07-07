import { fireEvent, render, screen } from '@testing-library/react-native'

import ImagesPageIndicator from '../imagesPageIndicator'

describe('ImagesPageIndicator', () => {
    const mockOnPagePress = jest.fn()

    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('Rendering', () => {
        it('renders with multiple images', () => {
            render(<ImagesPageIndicator totalImages={3} currentIndex={0} onPagePress={mockOnPagePress} />)
            expect(screen.getAllByRole('button')).toHaveLength(3)
        })

        it('renders empty container when totalImages is 0', () => {
            render(<ImagesPageIndicator totalImages={0} currentIndex={0} onPagePress={mockOnPagePress} />)
            expect(screen.queryAllByRole('button')).toHaveLength(0)
        })
    })
    describe('Interaction', () => {
        it('calls onPagePress with correct index for each indicator', () => {
            const totalImages = 4
            render(<ImagesPageIndicator totalImages={totalImages} currentIndex={0} onPagePress={mockOnPagePress} />)

            for (let i = 0; i < totalImages; i++) {
                const indicator = screen.getByRole('button', { name: `Image ${i + 1} of ${totalImages}` })
                fireEvent.press(indicator)
                expect(mockOnPagePress).toHaveBeenCalledWith(i)
            }
        })
    })
    describe('Visual States', () => {
        it('applies active styles to current indicator', () => {
            render(<ImagesPageIndicator totalImages={3} currentIndex={1} onPagePress={mockOnPagePress} />)
            const activeIndicator = screen.getByRole('button', { name: 'Image 2 of 3' })
            const inactiveIndicator = screen.getByRole('button', { name: 'Image 1 of 3' })

            // Check that the active indicator has active styles (flattened object)
            expect(activeIndicator.props.style).toEqual(expect.objectContaining({ backgroundColor: '#FFFFFF', width: 20 }))

            // Check that inactive indicator has default styles
            expect(inactiveIndicator.props.style).toEqual(
                expect.objectContaining({ backgroundColor: 'rgba(255, 255, 255, 0.5)', width: 8 })
            )
        })

        it('updates active indicator when currentIndex changes', () => {
            const { rerender } = render(
                <ImagesPageIndicator totalImages={3} currentIndex={0} onPagePress={mockOnPagePress} />
            )

            const firstIndicator = screen.getByRole('button', { name: 'Image 1 of 3' })
            expect(firstIndicator.props.style).toEqual(expect.objectContaining({ backgroundColor: '#FFFFFF', width: 20 }))

            rerender(<ImagesPageIndicator totalImages={3} currentIndex={1} onPagePress={mockOnPagePress} />)

            const secondIndicator = screen.getByRole('button', { name: 'Image 2 of 3' })
            expect(secondIndicator.props.style).toEqual(expect.objectContaining({ backgroundColor: '#FFFFFF', width: 20 }))
        })
    })
})
