import { Ionicons } from '@expo/vector-icons'
import { useCallback, useRef, useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import ActionSheet, { ActionSheetRef } from 'react-native-actions-sheet'
import { SheetProps } from 'react-native-actions-sheet'

import { LIGHT_MODE_BACKGROUND_COLOR } from '@/components/shared/Color'

// Custom toggle/switch component for view selection
import ToggleButton from '@/components/shared/ToggleButton'
// Custom hook for fetching distributor product data
import { useDistributorProducts } from '@/hooks/queries/useDistributorProducts'
// Custom hooks for shopping list mutations and queries
import { useUpdateShoppingListItem } from '@/hooks/queries/useShoppingLists'

// Get a single shopping list
import { useShoppingList } from '@/hooks/queries/useShoppingLists'

// Custom hook for fuzzy search functionality with filtering
import { useFuzzySearch } from '../shared/Input/FuzzySearch'
// Component for displaying custom product creation interface
import CustomProductsView from './CustomProductsView'
// Component for displaying product catalog with search results
import ProductCatalogView from './ProductCatalogView'

export interface AddItemsBottomSheetProps {
  listId: string
  distributorId: number
}

enum ViewType {
  productCatalog = 'Product Catalog',
  customProducts = 'Custom Products',
}

export default function AddItemsBottomSheet({ payload }: SheetProps<typeof ADD_ITEMS_SHEET_ID>) {
  if (!payload) return null
  const { listId, distributorId } = payload
  const actionSheetRef = useRef<ActionSheetRef>(null)
  const { data: allProducts = [], isLoading: isLoadingProducts } = useDistributorProducts(distributorId)
  const { data: shoppingList, isLoading: isLoadingList } = useShoppingList(listId)
  const updateItemMutation = useUpdateShoppingListItem(listId)

  const [activeView, setActiveView] = useState<ViewType>(ViewType.productCatalog)

  // Use the fuzzy search hook
  const { searchInput, filteredData } = useFuzzySearch({
    data: allProducts,
    searchKeys: ['description'],
    threshold: 0.5,
    placeholder: 'Search products...',
  })

  const handleProductQuantityChange = useCallback(
    (productId: number, quantity: number) => {
      updateItemMutation.mutate({
        distributorProductId: productId,
        quantity: quantity,
        itemType: 'distributor',
      })
    },
    [updateItemMutation]
  )

  const handleDismiss = useCallback(() => {
    actionSheetRef.current?.hide()
  }, [])

  const saveCustomProduct = useCallback(
    (name: string, quantity: number) => {
      updateItemMutation.mutate({
        customItemName: name,
        quantity: quantity,
        itemType: 'custom',
      })

      setActiveView(ViewType.productCatalog)
    },
    [updateItemMutation]
  )

  const handleToggleChange = useCallback((viewType: string) => {
    setActiveView(viewType as ViewType)
  }, [])

  // Get the count of items in shopping list
  const itemCount = shoppingList?.items?.length || 0
  const itemCountText = itemCount === 0 ? 'No products in list' : `${itemCount} products now in list`

  return (
    <ActionSheet ref={actionSheetRef} containerStyle={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleDismiss} style={styles.dismissButton}>
            <Ionicons name='close' size={24} color='#000' />
          </TouchableOpacity>
          <Text style={styles.title}>Add to list</Text>
          <View style={styles.placeholder}></View>
        </View>

        <Text style={styles.itemCountText}>{itemCountText}</Text>

        <View style={styles.toggleContainer}>
          <ToggleButton
            leftOption={ViewType.productCatalog}
            rightOption={ViewType.customProducts}
            activeOption={activeView}
            onToggle={handleToggleChange}
            style={styles.toggle}
          />
        </View>

        {activeView === ViewType.productCatalog ? (
          <View style={styles.productCatalogContainer}>
            {searchInput}
            <ProductCatalogView
              products={filteredData}
              isLoading={isLoadingProducts || isLoadingList}
              shoppingListItems={shoppingList?.items}
              onUpdateItem={handleProductQuantityChange}
            />
          </View>
        ) : (
          <CustomProductsView onSave={saveCustomProduct} />
        )}
      </View>
    </ActionSheet>
  )
}

const styles = StyleSheet.create({
  container: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    backgroundColor: LIGHT_MODE_BACKGROUND_COLOR,
    height: '90%',
  },
  indicator: {
    backgroundColor: '#DDDDDD',
    width: 60,
  },
  content: {
    paddingVertical: 16,
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    flex: 1,
  },
  dismissButton: {
    padding: 0,
  },
  placeholder: {
    width: 24,
  },
  itemCountText: {
    fontSize: 12,
    color: '#777777',
    textAlign: 'center',
    marginBottom: 8,
  },
  toggleContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  toggle: {
    width: 280,
  },
  productCatalogContainer: {
    flex: 1,
  },
})
