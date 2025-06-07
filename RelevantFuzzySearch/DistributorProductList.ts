import { router } from 'expo-router'
import { useCallback } from 'react'
import { FlatList, StyleSheet, Text, View } from 'react-native'

import { ACCENT_COLOR } from '@/components/shared/Color'

// Reusable list item component for consistent UI
import ListItem from '@/components/shared/lists/ListItem'
// Custom hook and TypeScript interface for fetching distributor product data
import { DistributorProduct, useDistributorProducts } from '@/hooks/queries/useDistributorProducts'
// Custom hook for fetching the latest product pricing information
import { useLatestPrices } from '@/hooks/queries/useLatestPrices'

// Custom hook for fuzzy search functionality with filtering
import { useFuzzySearch } from '../shared/Input/FuzzySearch'


interface DistributorProductListProps {
  distributorId: number
}

function DistributorProductList({ distributorId }: DistributorProductListProps) {
  const { data: productsData, isLoading: isLoadingProducts } = useDistributorProducts(distributorId)

  // Extract product IDs for the latest prices query
  const productIds = productsData?.map((product) => product.id) || []
  const { data: pricesData, isLoading: isLoadingPrices } = useLatestPrices(productIds)

  // Combine product data with prices
  const allProducts =
    productsData?.map((product) => {
      const priceInfo = pricesData?.find((price) => price.productId === product.id)
      return {
        ...product,
        unitPriceCents: priceInfo?.unitPriceCents || 0,
      }
    }) || []

  // Use fuzzy search hook
  const { searchInput, filteredData } = useFuzzySearch({
    data: allProducts,
    searchKeys: ['description'],
    threshold: 0.5,
    placeholder: 'Search products...',
  })

  const handlePress = useCallback(
    (item: DistributorProduct & { unitPriceCents: number }) => {
      router.push({
        pathname: '/(tabs)/(home)/distributors/[distributorId]/products/[productId]',
        params: {
          productId: item.id,
          distributorId,
          itemDescription: item.description,
        },
      })
    },
    [distributorId]
  )

  const renderItem = useCallback(
    ({ item, index }: { item: DistributorProduct & { unitPriceCents: number }; index: number }) => {
      return (
        <ListItem
          title={item.description || 'No description'}
          trailing={<Text style={styles.price}>${(item.unitPriceCents / 100).toFixed(2)}</Text>}
          onPress={() => handlePress(item)}
          showBottomBorder={index !== filteredData.length - 1}
        />
      )
    },
    [handlePress, filteredData.length]
  )

  return (
    <View style={styles.container}>
      {searchInput}

      <FlatList
        style={styles.list}
        keyboardShouldPersistTaps='always'
        data={filteredData}
        renderItem={renderItem}
        scrollEnabled={true}
        keyExtractor={(item) => item.id.toString()}
        ListEmptyComponent={
          isLoadingProducts || isLoadingPrices ? (
            <Text style={styles.emptyText}>Loading products...</Text>
          ) : (
            <Text style={styles.emptyText}>No products found</Text>
          )
        }
        showsVerticalScrollIndicator={true}
      />
    </View>
  )
}

export default DistributorProductList

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  price: {
    fontSize: 16,
    fontWeight: '500',
    color: ACCENT_COLOR,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
    color: '#666',
  },
  container: {
    flex: 1,
  },
})
