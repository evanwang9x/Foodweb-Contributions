import * as ImagePicker from 'expo-image-picker'

import { pickImage } from './../getImagesFromDevice'

// Mock the entire expo-image-picker module
jest.mock('expo-image-picker', () => ({
    requestMediaLibraryPermissionsAsync: jest.fn(),
    launchImageLibraryAsync: jest.fn(),
}))

// Create typed mocks for better TypeScript support
const mockedImagePicker = ImagePicker as jest.Mocked<typeof ImagePicker>

// Mock alert function
global.alert = jest.fn()

describe('pickImage', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('Permission handling', () => {
        it('should return empty array when permission is denied', async () => {
            // Mock permission denied
            mockedImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({
                status: 'denied',
                granted: false,
                canAskAgain: true,
                expires: 'never',
            })

            const result = await pickImage()

            expect(result).toEqual([])
            expect(global.alert).toHaveBeenCalledWith('Permission needed to access photos')
            expect(mockedImagePicker.launchImageLibraryAsync).not.toHaveBeenCalled()
        })

        describe('Configuration verification', () => {
            it('should call launchImageLibraryAsync with correct configuration', async () => {
                mockedImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({
                    status: 'granted',
                    granted: true,
                    canAskAgain: true,
                    expires: 'never',
                })

                mockedImagePicker.launchImageLibraryAsync.mockResolvedValue({
                    canceled: true,
                    assets: [],
                })

                await pickImage()

                expect(mockedImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith({
                    mediaTypes: ['images'],
                    allowsEditing: false,
                    allowsMultipleSelection: true,
                    quality: 1,
                    orderedSelection: true,
                })
            })
        })
        it('should proceed to image picker when permission is granted', async () => {
            // Mock permission granted
            mockedImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({
                status: 'granted',
                granted: true,
                canAskAgain: true,
                expires: 'never',
            })

            // Mock user canceling image picker
            mockedImagePicker.launchImageLibraryAsync.mockResolvedValue({
                canceled: true,
                assets: [],
            })

            await pickImage()

            expect(global.alert).not.toHaveBeenCalled()
            expect(mockedImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith({
                mediaTypes: ['images'],
                allowsEditing: false,
                allowsMultipleSelection: true,
                quality: 1,
                orderedSelection: true,
            })
        })
    })

    describe('Image selection', () => {
        beforeEach(() => {
            // Mock permission granted for all image selection tests
            mockedImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({
                status: 'granted',
                granted: true,
                canAskAgain: true,
                expires: 'never',
            })
        })

        it('should return empty array when user cancels image selection', async () => {
            mockedImagePicker.launchImageLibraryAsync.mockResolvedValue({
                canceled: true,
                assets: [],
            })

            const result = await pickImage()

            expect(result).toEqual([])
        })

        it('should return single image URI when user selects one image', async () => {
            const mockImageUri = 'file://path/to/image1.jpg'

            mockedImagePicker.launchImageLibraryAsync.mockResolvedValue({
                canceled: false,
                assets: [
                    {
                        uri: mockImageUri,
                        width: 1920,
                        height: 1080,
                        type: 'image',
                        fileName: 'image1.jpg',
                        fileSize: 500000,
                    },
                ],
            })

            const result = await pickImage()

            expect(result).toEqual([mockImageUri])
        })

        it('should return multiple image URIs when user selects multiple images', async () => {
            const mockImageUris = ['file://path/to/image1.jpg', 'file://path/to/image2.png', 'file://path/to/image3.jpeg']

            mockedImagePicker.launchImageLibraryAsync.mockResolvedValue({
                canceled: false,
                assets: [
                    {
                        uri: mockImageUris[0],
                        width: 1920,
                        height: 1080,
                        type: 'image',
                        fileName: 'image1.jpg',
                        fileSize: 500000,
                    },
                    {
                        uri: mockImageUris[1],
                        width: 1280,
                        height: 720,
                        type: 'image',
                        fileName: 'image2.png',
                        fileSize: 300000,
                    },
                    {
                        uri: mockImageUris[2],
                        width: 800,
                        height: 600,
                        type: 'image',
                        fileName: 'image3.jpeg',
                        fileSize: 200000,
                    },
                ],
            })

            const result = await pickImage()

            expect(result).toEqual(mockImageUris)
        })

        it('should handle empty assets array correctly', async () => {
            mockedImagePicker.launchImageLibraryAsync.mockResolvedValue({
                canceled: false,
                assets: [],
            })

            const result = await pickImage()

            expect(result).toEqual([])
        })
    })

    describe('Error handling', () => {
        it('should handle permission request error', async () => {
            mockedImagePicker.requestMediaLibraryPermissionsAsync.mockRejectedValue(new Error('Permission request failed'))

            await expect(pickImage()).rejects.toThrow('Permission request failed')
        })

        it('should handle image picker launch error', async () => {
            mockedImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({
                status: 'granted',
                granted: true,
                canAskAgain: true,
                expires: 'never',
            })

            mockedImagePicker.launchImageLibraryAsync.mockRejectedValue(new Error('Image picker failed'))

            await expect(pickImage()).rejects.toThrow('Image picker failed')
        })
    })
})
