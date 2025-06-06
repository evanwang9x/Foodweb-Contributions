import { format } from 'date-fns'
import React from 'react'
import { FlatList, StyleSheet, Text, View } from 'react-native'
import { TouchableOpacity } from 'react-native'
import { ACCENT_COLOR } from '@/components/shared/Color'
import { FullScreenLoader } from '@/components/shared/FullScreenLoader'
import { useRestaurantOwner } from '@/contexts/RestaurantOwnerContext'
import { useUserInvoices } from '@/hooks/queries/useUserInvoices'
import DocumentCarousel from '../../components/scan/ImageCarousel'
import { usePastInvoices } from '@/hooks/queries/usePastInvoices'


interface DistributorInvoiceListProps {
  distributorId: number
}

export default function DistributorInvoiceList({ distributorId }: DistributorInvoiceListProps) {
  const { restaurantOwner } = useRestaurantOwner()
  const { data: invoices, isLoading, error } = useUserInvoices(
    restaurantOwner?.user.id || '', 
    distributorId
  )
  
  const {
    modalVisible,
    selectedInvoiceImages,
    handleInvoiceClick,
    handleModalClose,
    isDownloading
  } = usePastInvoices({ 
    restaurantId: restaurantOwner?.ownedRestaurantID 
  })

  if (isLoading || isDownloading) {
    return <FullScreenLoader />
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Error loading invoices: {error.message}</Text>
      </View>
    )
  }

  if (!invoices || invoices.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyStateText}>No invoices available</Text>
      </View>
    )
  }

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM d, yyyy')
    } catch (error) {
      console.error(error)
      return 'Invalid date'
    }
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={invoices}
        keyExtractor={(item) => item.invoiceUuid}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => handleInvoiceClick(item.invoiceUuid)}>
            <View style={styles.invoiceItem}>
              <View style={styles.invoiceContent}>
                <Text style={styles.invoiceDate}>{formatDate(item.invoiceDate)}</Text>
                <Text style={styles.invoiceTotal}>${(item.totalPriceCents / 100).toFixed(2)}</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
        showsVerticalScrollIndicator={false}
      />

      <DocumentCarousel 
        scannedDocs={selectedInvoiceImages} 
        visible={modalVisible} 
        onClose={handleModalClose} 
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#757575',
    textAlign: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: '#d32f2f',
    textAlign: 'center',
    padding: 24,
  },
  invoiceItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  invoiceContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  invoiceDate: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333333',
  },
  invoiceTotal: {
    fontSize: 16,
    fontWeight: '600',
    color: ACCENT_COLOR,
  },
})