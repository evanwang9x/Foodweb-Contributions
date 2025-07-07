import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'

import ImageCarousel from '../ImageCarousel'

jest.mock('@expo/vector-icons', () => ({
    Ionicons: 'Ionicons',
}))

describe('ImageCarousel', () => {
    const mockImages = [
        'https://example.com/image1.jpg',
        'https://example.com/image2.jpg',
        'https://example.com/image3.jpg',
    ]

    const mockOnImageChange = jest.fn()

    beforeEach(() => {
        jest.clearAllMocks()
    })

    afterEach(async () => {
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 0))
        })
    })

    describe('Rendering', () => {
        it('renders without crashing with valid images', () => {
            render(<ImageCarousel images={mockImages} onImageChange={mockOnImageChange} />)
            expect(screen.getByLabelText('Image carousel')).toBeTruthy()
        })

        it('renders null when images array is empty', () => {
            const { toJSON } = render(<ImageCarousel images={[]} onImageChange={mockOnImageChange} />)
            expect(toJSON()).toBeNull()
        })

        it('renders correct number of images', () => {
            render(<ImageCarousel images={mockImages} onImageChange={mockOnImageChange} />)
            expect(screen.getByLabelText('Image 1 of 3')).toBeTruthy()
            expect(screen.getByLabelText('Image 2 of 3')).toBeTruthy()
            expect(screen.getByLabelText('Image 3 of 3')).toBeTruthy()
        })

        it('renders navigation buttons when there are multiple images', () => {
            render(<ImageCarousel images={mockImages} onImageChange={mockOnImageChange} />)
            // The left button should not be visible initially (currentImageIndex = 0)
            expect(screen.queryByLabelText('Previous image')).toBeNull()
            expect(screen.getByLabelText('Next image')).toBeTruthy()
        })

        it('does not render navigation buttons when there is only one image', () => {
            render(<ImageCarousel images={[mockImages[0]]} onImageChange={mockOnImageChange} />)
            expect(screen.queryByLabelText('Previous image')).toBeNull()
            expect(screen.queryByLabelText('Next image')).toBeNull()
        })
    })

    describe('Navigation', () => {
        it('calls onImageChange when navigating to next image', async () => {
            render(<ImageCarousel images={mockImages} onImageChange={mockOnImageChange} />)

            await act(async () => {
                const nextButton = screen.getByLabelText('Next image')
                fireEvent.press(nextButton)
            })

            await waitFor(() => {
                expect(mockOnImageChange).toHaveBeenCalledWith(1)
            })
        })

        it('calls onImageChange when navigating to previous image', async () => {
            render(<ImageCarousel images={mockImages} onImageChange={mockOnImageChange} />)

            // First navigate to second image by simulating scroll
            await act(async () => {
                const scrollView = screen.getByLabelText('Image carousel')
                const scrollEvent = {
                    nativeEvent: {
                        contentOffset: { x: 375, y: 0 },
                        contentSize: { width: 1125, height: 400 },
                        layoutMeasurement: { width: 375, height: 400 },
                    },
                }
                fireEvent.scroll(scrollView, scrollEvent)
            })

            await waitFor(() => {
                expect(mockOnImageChange).toHaveBeenCalledWith(1)
            })

            mockOnImageChange.mockClear()

            // Now test the previous button (should be visible after navigating)
            await act(async () => {
                const prevButton = screen.getByLabelText('Previous image')
                fireEvent.press(prevButton)
            })

            await waitFor(() => {
                expect(mockOnImageChange).toHaveBeenCalledWith(0)
            })
        })

        it('handles scroll events correctly', async () => {
            render(<ImageCarousel images={mockImages} onImageChange={mockOnImageChange} />)

            await act(async () => {
                const scrollView = screen.getByLabelText('Image carousel')
                const scrollEvent = {
                    nativeEvent: {
                        contentOffset: { x: 375, y: 0 },
                        contentSize: { width: 1125, height: 400 },
                        layoutMeasurement: { width: 375, height: 400 },
                    },
                }
                fireEvent.scroll(scrollView, scrollEvent)
            })

            await waitFor(() => {
                expect(mockOnImageChange).toHaveBeenCalledWith(1)
            })
        })
    })

    describe('Layout handling', () => {
        it('updates container width on layout change', async () => {
            const { root } = render(<ImageCarousel images={mockImages} onImageChange={mockOnImageChange} />)

            await act(async () => {
                const layoutEvent = {
                    nativeEvent: {
                        layout: { width: 400, height: 600 },
                    },
                }
                fireEvent(root, 'layout', layoutEvent)
            })

            expect(screen.getByLabelText('Image carousel')).toBeTruthy()
        })
    })

    describe('Edge cases', () => {
        it('clamps page numbers within valid range', async () => {
            render(<ImageCarousel images={mockImages} onImageChange={mockOnImageChange} />)

            await act(async () => {
                const scrollView = screen.getByLabelText('Image carousel')
                const scrollEvent = {
                    nativeEvent: {
                        contentOffset: { x: 1500, y: 0 },
                        contentSize: { width: 1125, height: 400 },
                        layoutMeasurement: { width: 375, height: 400 },
                    },
                }
                fireEvent.scroll(scrollView, scrollEvent)
            })

            await waitFor(() => {
                expect(mockOnImageChange).toHaveBeenCalledWith(2)
            })
        })

        it('handles onImageChange callback being undefined', () => {
            expect(() => {
                render(<ImageCarousel images={mockImages} />)
            }).not.toThrow()
        })
    })

    describe('Performance', () => {
        it('throttles scroll events appropriately', () => {
            render(<ImageCarousel images={mockImages} onImageChange={mockOnImageChange} />)
            const scrollView = screen.getByLabelText('Image carousel')
            expect(scrollView.props.scrollEventThrottle).toBe(16)
        })
    })
})