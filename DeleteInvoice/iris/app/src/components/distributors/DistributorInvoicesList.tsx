import { Ionicons } from '@expo/vector-icons'
import React from 'react'
import { FlatList, StyleSheet, Text, View } from 'react-native'
import { SheetManager } from 'react-native-actions-sheet'

import IconButton from '@/components/shared/Button/IconButton'
import { ACCENT_COLOR } from '@/components/shared/Color'
import { FullScreenLoader } from '@/components/shared/FullScreenLoader'
import { LIST_ACTIONS_SHEET_ID } from '@/components/shared/lists/ListActionsBottomSheet'
import ListItem from '@/components/shared/lists/ListItem'
import { useRestaurantOwner } from '@/contexts/RestaurantOwnerContext'
import { useDeleteUserInvoice } from '@/hooks/queries/mutations/useDeleteUserInvoice'
import { useUserInvoices } from '@/hooks/queries/useUserInvoices'
interface DistributorInvoiceListProps {
    distributorId: number
}

export default function DistributorInvoiceList({ distributorId }: DistributorInvoiceListProps) {
    const { restaurantOwner } = useRestaurantOwner()
    const { data: invoices, isLoading, error } = useUserInvoices(restaurantOwner?.user.id || '', distributorId)
    const deleteListMutation = useDeleteUserInvoice()

    const handleDeleteInvoice = async (invoiceUuid: string) => {
        if (!restaurantOwner?.ownedRestaurantID) {
            console.error('Restaurant ID not available')
            return
        }

        try {
            await deleteListMutation.mutateAsync({
                invoiceId: invoiceUuid,
                restaurantId: restaurantOwner.ownedRestaurantID,
            })
        } catch (error) {
            console.error('Delete invoice error:', error)
        }
    }

    const handleListActions = (invoiceUuid: string) => {
        SheetManager.show(LIST_ACTIONS_SHEET_ID, {
            payload: {
                actions: [
                    {
                        label: 'Delete Invoice',
                        icon: <Ionicons name='trash-outline' size={20} />,
                        onPress: () => {
                            handleDeleteInvoice(invoiceUuid)
                        },
                    },
                ],
            },
        })
    }
    if (isLoading) {
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

    return (
        <View style={styles.container}>
            <FlatList
                data={invoices}
                keyExtractor={(item) => item.invoiceUuid}
                scrollEnabled={true}
                renderItem={({ item, index }) => (
                    <ListItem
                        title={item.invoiceDate}
                        showBottomBorder={index !== invoices.length - 1}
                        trailing={
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Text style={styles.invoiceTotal}>${(item.totalPriceCents / 100).toFixed(2)}</Text>
                                <View style={{ marginLeft: 12 }}>
                                    <IconButton
                                        icon={<Ionicons name='ellipsis-horizontal' />}
                                        variant='secondary'
                                        onPress={(e) => {
                                            e.stopPropagation()
                                            handleListActions(item.invoiceUuid)
                                        }}
                                    />
                                </View>
                            </View>
                        }
                    />
                )}
                showsVerticalScrollIndicator={true}
            />
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        flex: 1,
        paddingRight: 8,
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
    invoiceTotal: {
        fontSize: 16,
        fontWeight: '600',
        color: ACCENT_COLOR,
    },
})