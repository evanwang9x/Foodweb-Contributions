import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useMemo, useState } from 'react'
import { FlatList, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native'
import { SheetManager } from 'react-native-actions-sheet'

import IconButton from '@/components/shared/Button/IconButton'
import { FullScreenLoader } from '@/components/shared/FullScreenLoader'
import { LIST_ACTIONS_SHEET_ID } from '@/components/shared/lists/ListActionsBottomSheet'
import ListItem from '@/components/shared/lists/ListItem'
import { H1 } from '@/components/shared/Typography'
import { SHEET_ID } from '@/components/shopping-lists/NewShoppingListBottomSheet'
import ShareShoppingListModal from '@/components/shopping-lists/ShareShoppingListModal'
import { useRestaurantOwner } from '@/contexts/RestaurantOwnerContext'
import { useDeleteShoppingList } from '@/hooks/queries/mutations/useDeleteShoppingList'
import { useShoppingLists } from '@/hooks/queries/useShoppingLists'

const PageLayout = ({ children }: { children: React.ReactNode }) => (
    <SafeAreaView style= { styles.container } > { children } </SafeAreaView>
)

export default function Lists() {
    const { restaurantOwner } = useRestaurantOwner()
    const { data: lists, error, isLoading } = useShoppingLists(restaurantOwner?.user.id || '')
    const { mutateAsync } = useDeleteShoppingList()
    const [listIdToShare, setListId] = useState<string | null>(null)
    const listsSortedByPlannedOrderDate = useMemo(() => {
        return (
            lists?.sort((a, b) => new Date(b.planned_order_date).getTime() - new Date(a.planned_order_date).getTime()) || []
        )
    }, [lists])
    const modalVisible = listIdToShare !== null
    const handleListActions = (listId: number) => {
        SheetManager.show(LIST_ACTIONS_SHEET_ID, {
            payload: {
                actions: [
                    {
                        label: 'Delete',
                        icon: <Ionicons name='trash-outline' size = { 20} />,
                        onPress: () => {
                            mutateAsync(listId.toString())
                        },
                    },
                    {
                        label: 'Share',
                        icon: <Ionicons name='share-outline' size = { 20} />,
                        onPress: async () => {
                            await SheetManager.hide(LIST_ACTIONS_SHEET_ID)
                            shareShoppingList(listId.toString())
                        },
                    },
                ],
            },
        })
    }

    const handleAddList = () => SheetManager.show(SHEET_ID)

    const shareShoppingList = (listId: string) => {
        setListId(listId)
    }

    const handleShareClose = () => {
        setListId(null)
    }

    const Header = ({ showAddButton = true }) => (
        <View style= { styles.header } >
        <H1 style={ styles.headerTitle }> Shopping Lists </H1>
    {
        showAddButton && (
            <IconButton
          icon={ <Ionicons name='add-circle-outline' />}
        onPress = { handleAddList }
        size = 'large'
        variant = 'secondary'
            />
      )
    }
    </View>
  )
==
  if (isLoading) {
        return <FullScreenLoader />
    }

    if (error) {
        return (
            <PageLayout>
            <Header showAddButton= { false} />
            <View style={ styles.centerContainer }>
                <Ionicons name='alert-circle' size = { 64} color = '#FF6B6B' />
                    <Text style={ styles.errorTitle }> Oops! Something went wrong </Text>
                        < Text style = { styles.errorMessage } > { error.message } </Text>
                            < Text style = { styles.errorSubtext } > Please try again later or contact support if the problem persists </Text>
                                </View>
                                </PageLayout>
    )
    }

    if (!lists?.length) {
        return (
            <PageLayout>
            <Header />
            < View style = { styles.centerContainer } >
                <Ionicons name='list' size = { 64} color = '#CCCCCC' />
                    <Text style={ styles.emptyTitle }> No Shopping Lists Yet </Text>
                        < Text style = { styles.emptyText } > Create your first shopping list to start organizing your purchases </Text>
                            </View>
                            </PageLayout>
    )
    }

    return (
        <PageLayout>
        <ScrollView>
        <Header />
        < FlatList
          scrollEnabled = { false}
    data = { listsSortedByPlannedOrderDate }
    keyExtractor = {(item) => item.id.toString()
}
contentContainerStyle = { styles.listContainer }
renderItem = {({ item, index }) => (
    <ListItem
              title= { item.distributor?.name || 'Distributor Name Unavailable' }
subtitle = { item.planned_order_date }
trailing = {
                < TouchableOpacity
onPress = {(e) => {
    e.stopPropagation() // Prevent triggering the parent onPress
    handleListActions(item.id)
}}
hitSlop = {{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
    <Ionicons name='ellipsis-horizontal' size = { 20} />
        </TouchableOpacity>
              }
onPress = {() =>
router.push({
    pathname: '/lists/[id]',
    params: { id: item.id.toString() },
})
              }
showBottomBorder = { index !== listsSortedByPlannedOrderDate.length - 1}
            />
          )}
        />
    </ScrollView>

    < ShareShoppingListModal
visible = { modalVisible }
onClose = { handleShareClose }
shoppingListId = { listIdToShare? parseInt(listIdToShare): null }
    />
    </PageLayout>
  )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 16,
    },
    headerTitle: {
        fontSize: 28,
    },
    listContainer: {
        paddingHorizontal: 16,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '600',
        marginTop: 16,
        marginBottom: 8,
        color: '#333333',
    },
    emptyText: {
        fontSize: 16,
        color: '#666666',
        textAlign: 'center',
        lineHeight: 24,
    },
    errorTitle: {
        fontSize: 20,
        fontWeight: '600',
        marginTop: 16,
        marginBottom: 8,
        color: '#FF6B6B',
    },
    errorMessage: {
        fontSize: 16,
        color: '#666666',
        textAlign: 'center',
        marginBottom: 8,
    },
    errorSubtext: {
        fontSize: 14,
        color: '#999999',
        textAlign: 'center',
        lineHeight: 20,
        paddingHorizontal: 16,
        paddingVertical: 16,
    },
})