import { useState } from 'react'
import StorageService from '@/services/storage'

interface UsePastInvoicesProps {
  restaurantId?: number
}

interface UsePastInvoicesReturn {
  isDownloading: boolean
  modalVisible: boolean
  selectedInvoiceImages: string[]
  handleInvoiceClick: (invoiceUuid: string) => Promise<void>
  handleModalClose: () => void
}

export function usePastInvoices({ restaurantId }: UsePastInvoicesProps): UsePastInvoicesReturn {
  const [isDownloading, setIsDownloading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [selectedInvoiceImages, setSelectedInvoiceImages] = useState<string[]>([])

  const storageService = restaurantId ? new StorageService(restaurantId) : null

  const handleInvoiceClick = async (invoiceUuid: string) => {
    if (!storageService) {
      console.error('Storage service not initialized')
      return
    }

    try {
      setIsDownloading(true)
      const images = await storageService.downloadAllInvoicePages(invoiceUuid)

      if (images.length > 0) {
        setSelectedInvoiceImages(images)
        setModalVisible(true)
      } else {
        console.log('No images found for this invoice')
      }
    } catch (error) {
      console.error('Error downloading invoice:', error)
    } finally {
      setIsDownloading(false)
    }
  }

  const handleModalClose = () => {
    setModalVisible(false)
    setSelectedInvoiceImages([])
  }

  return {
    isDownloading,
    modalVisible,
    selectedInvoiceImages,
    handleInvoiceClick,
    handleModalClose
  }
}