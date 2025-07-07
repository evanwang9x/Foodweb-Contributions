import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { router } from 'expo-router'

import InvoiceImagesUploader from '@/app/scan/InvoiceImagesUploader'
import { compressImages as mockCompressImages } from '@/components/scan/DocumentCamera/utils'
import { pickImage as mockPickImage } from '@/components/scan/ImageContainer/getImagesFromDevice'
import * as useParseInvoiceModule from '@/hooks/useParseInvoice'

jest.mock('@/components/scan/DocumentCamera/utils', () => ({
    compressImages: jest.fn((images) => Promise.resolve(images)),
}))

jest.mock('@/components/scan/ImageContainer/getImagesFromDevice', () => ({
    pickImage: jest.fn(() => Promise.resolve([])),
}))

jest.mock('expo-router', () => ({
    router: {
        replace: jest.fn(),
    },
}))

jest.mock('react-native-safe-area-context', () => ({
    useSafeAreaInsets: () => ({ bottom: 0 }),
}))

// Mock the camera component to just provide a way to simulate taking photos
jest.mock('@/components/scan/DocumentCamera/DocumentCamera', () => {
    const React = jest.requireActual('react')

    const mockScanDocument = jest.fn(() => Promise.resolve(['camera-image-1.jpg', 'camera-image-2.jpg']))

    return {
        DocumentCamera: React.forwardRef((props: any, ref: any) => {
            React.useImperativeHandle(ref, () => ({
                scanDocument: mockScanDocument,
            }))
            return null
        }),
        mockScanDocument,
    }
})

const { mockScanDocument } = jest.requireMock('@/components/scan/DocumentCamera/DocumentCamera')

jest.mock('@/components/shared/BackButton', () => {
    const React = jest.requireActual('react')
    const { Pressable } = jest.requireActual('react-native')

    return {
        __esModule: true,
        default: ({ onPress }: { onPress: () => void }) => (
            <Pressable onPress={onPress} accessibilityLabel={'BACK_BUTTON'}>
                <></>
            </Pressable>
        ),
    }
})

describe('<InvoiceImagesUploader />', () => {
    const mockParseInvoice = jest.fn()

    beforeEach(() => {
        jest.clearAllMocks()
            ; (mockPickImage as jest.Mock).mockResolvedValue([])
            ; (mockCompressImages as jest.Mock).mockResolvedValue([])
        mockScanDocument.mockResolvedValue(['camera-image-1.jpg', 'camera-image-2.jpg'])

        mockParseInvoice.mockResolvedValue({
            distributorInfo: { name: 'Test Distributor', address: 'Test Address' },
            invoiceItems: [],
            invoiceDate: '2023-01-01',
            rawOCROutput: 'Test OCR',
        })

        jest.spyOn(useParseInvoiceModule, 'useParseInvoice').mockReturnValue({
            mutateAsync: mockParseInvoice,
            isPending: false,
        })
    })

    it('should initialize with empty selectedImages array', () => {
        const { getByText, queryByText } = render(<InvoiceImagesUploader />)
        expect(getByText('Upload')).toBeTruthy()
        expect(queryByText('Processing...')).toBeFalsy()
        expect(queryByText('Analyzing...')).toBeFalsy()
    })

    // ===== STATE MANAGEMENT TESTS =====

    it('should update selectedImages when images are added via gallery', async () => {
        const mockImages = ['image1.jpg', 'image2.jpg']
        mockPickImage.mockResolvedValue(mockImages)

        const { getByText, queryByText } = render(<InvoiceImagesUploader />)

        // Simulate clicking "Choose Gallery" button
        const galleryButton = getByText('Choose Gallery')
        fireEvent.press(galleryButton)

        await waitFor(() => {
            expect(mockPickImage).toHaveBeenCalledTimes(1)
            expect(queryByText('No pages added yet.')).toBeFalsy()
            expect(queryByText('Your invoice pages will appear here')).toBeFalsy()
        })
    })

    it('should say Processing and no upload button show', async () => {
        mockPickImage.mockResolvedValue(['image1.jpg'])

        const { getByText, queryByText } = render(<InvoiceImagesUploader />)

        // Add images first
        const galleryButton = getByText('Choose Gallery')
        fireEvent.press(galleryButton)

        await waitFor(() => {
            expect(mockPickImage).toHaveBeenCalled()
        })

        // Click upload
        const uploadButton = getByText('Upload')
        fireEvent.press(uploadButton)

        // Should show processing state and upload button should be gone
        await waitFor(() => {
            expect(queryByText('Processing...')).toBeTruthy()
            expect(queryByText('Upload')).toBeFalsy()
        })
    })

    // ===== USER INTERACTION TESTS =====

    it('should call pickImage when "Choose Gallery" button is pressed', async () => {
        const { getByText } = render(<InvoiceImagesUploader />)

        const galleryButton = getByText('Choose Gallery')
        fireEvent.press(galleryButton)

        await waitFor(() => {
            expect(mockPickImage).toHaveBeenCalledTimes(1)
        })
    })

    it('should call documentCamera.scanDocument when "Take Photo" button is pressed', async () => {
        const { getByText } = render(<InvoiceImagesUploader />)

        const cameraButton = getByText('Take Photo')
        fireEvent.press(cameraButton)

        await waitFor(() => {
            expect(mockScanDocument).toHaveBeenCalledTimes(1)
        })
    })

    // ===== IMAGE HANDLING TESTS =====

    it('should handle empty image arrays from pickImage gracefully', async () => {
        mockPickImage.mockResolvedValue([])

        const { getByText } = render(<InvoiceImagesUploader />)

        const galleryButton = getByText('Choose Gallery')
        fireEvent.press(galleryButton)

        await waitFor(() => {
            expect(mockPickImage).toHaveBeenCalledTimes(1)
        })

        // Should not crash and should still show empty state
        expect(getByText('No pages added yet.')).toBeTruthy()
    })

    // ===== UPLOAD FLOW TESTS =====

    it('should compress images before uploading', async () => {
        const mockImages = ['image1.jpg', 'image2.jpg']
        mockPickImage.mockResolvedValue(mockImages)
        mockCompressImages.mockResolvedValue(['compressed1.jpg', 'compressed2.jpg'])

        const { getByText } = render(<InvoiceImagesUploader />)

        // Add images
        const galleryButton = getByText('Choose Gallery')
        fireEvent.press(galleryButton)
        await waitFor(() => expect(mockPickImage).toHaveBeenCalled())

        // Upload
        const uploadButton = getByText('Upload')
        fireEvent.press(uploadButton)

        await waitFor(() => {
            expect(mockCompressImages).toHaveBeenCalledWith(mockImages)
        })
    })

    // ===== LOADING STATE TESTS =====

    it('should disable interactions during processing state', async () => {
        const mockImages = ['image1.jpg']
        mockPickImage.mockResolvedValue(mockImages)

        const { getByText, queryByText } = render(<InvoiceImagesUploader />)

        // Add images first
        const galleryButton = getByText('Choose Gallery')
        fireEvent.press(galleryButton)
        await waitFor(() => expect(mockPickImage).toHaveBeenCalled())

        // Start upload process
        const uploadButton = getByText('Upload')
        fireEvent.press(uploadButton)

        // Verify processing state is shown
        await waitFor(() => {
            expect(queryByText('Processing...')).toBeTruthy()
            expect(queryByText('Upload')).toBeFalsy()
        })
    })

    // ===== CANCELLATION TESTS =====

    it('should handle cancellation during upload process', async () => {
        const mockImages = ['image1.jpg']
        mockPickImage.mockResolvedValue(mockImages)

        // Mock a slow parseInvoice that we can cancel
        mockParseInvoice.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 1000)))

        const { getByText, getByLabelText } = render(<InvoiceImagesUploader />)

        // Add images
        const galleryButton = getByText('Choose Gallery')
        fireEvent.press(galleryButton)
        await waitFor(() => expect(mockPickImage).toHaveBeenCalled())

        // Start upload
        const uploadButton = getByText('Upload')
        fireEvent.press(uploadButton)

        // Cancel during processing
        const backButton = getByLabelText('BACK_BUTTON')
        fireEvent.press(backButton)

        expect(router.replace).toHaveBeenCalledWith('/(tabs)')
    })

    it('should navigate to tabs when cancel is pressed and not loading', () => {
        const { getByLabelText } = render(<InvoiceImagesUploader />)

        const backButton = getByLabelText('BACK_BUTTON')
        fireEvent.press(backButton)

        expect(router.replace).toHaveBeenCalledWith('/(tabs)')
    })

    // ===== IMAGE HANDLING EDGE CASES =====

    it('should handle null response from camera scan gracefully', async () => {
        mockScanDocument.mockResolvedValue(null)

        const { getByText } = render(<InvoiceImagesUploader />)

        const cameraButton = getByText('Take Photo')
        fireEvent.press(cameraButton)

        await waitFor(() => {
            expect(mockScanDocument).toHaveBeenCalled()
        })

        // Should not crash and should maintain empty state
        expect(getByText('No pages added yet.')).toBeTruthy()
    })

    it('should handle undefined response from camera scan gracefully', async () => {
        mockScanDocument.mockResolvedValue(undefined)

        const { getByText } = render(<InvoiceImagesUploader />)

        const cameraButton = getByText('Take Photo')
        fireEvent.press(cameraButton)

        await waitFor(() => {
            expect(mockScanDocument).toHaveBeenCalled()
        })

        // Should not crash and should maintain empty state
        expect(getByText('No pages added yet.')).toBeTruthy()
    })

    it('should handle null/undefined response from pickImage gracefully', async () => {
        mockPickImage.mockResolvedValue(null)

        const { getByText } = render(<InvoiceImagesUploader />)

        const galleryButton = getByText('Choose Gallery')
        fireEvent.press(galleryButton)

        await waitFor(() => {
            expect(mockPickImage).toHaveBeenCalled()
        })

        // Should not crash and should maintain empty state
        expect(getByText('No pages added yet.')).toBeTruthy()
    })

    // ===== COMPONENT INTEGRATION TESTS =====

    it('should maintain selected images state when mixing gallery and camera images', async () => {
        const galleryImages = ['gallery1.jpg', 'gallery2.jpg']
        const cameraImages = ['camera1.jpg']

        mockPickImage.mockResolvedValue(galleryImages)
        mockScanDocument.mockResolvedValue(cameraImages)

        const { getByText } = render(<InvoiceImagesUploader />)

        // Add gallery images
        const galleryButton = getByText('Choose Gallery')
        fireEvent.press(galleryButton)
        await waitFor(() => expect(mockPickImage).toHaveBeenCalled())

        // Add camera images
        const cameraButton = getByText('Take Photo')
        fireEvent.press(cameraButton)
        await waitFor(() => expect(mockScanDocument).toHaveBeenCalled())

        const uploadButton = getByText('Upload')
        fireEvent.press(uploadButton)

        await waitFor(() => {
            // The compressImages should be called with all images combined
            expect(mockCompressImages).toHaveBeenCalledWith([...galleryImages, ...cameraImages])
        })
    })

    // ===== ACCESSIBILITY AND RENDERING TESTS =====

    it('should render correct placeholder content when no images selected', () => {
        const { getByText } = render(<InvoiceImagesUploader />)

        expect(getByText('No pages added yet.')).toBeTruthy()
        expect(getByText('Your invoice pages will appear here')).toBeTruthy()
    })

    it('should render AppBar with correct props', () => {
        const { getByLabelText } = render(<InvoiceImagesUploader />)

        // AppBar should be rendered with back button
        expect(getByLabelText('BACK_BUTTON')).toBeTruthy()
    })
})