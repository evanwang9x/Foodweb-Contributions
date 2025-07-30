import { Ionicons } from '@expo/vector-icons'
import { useState } from 'react'
import { Modal, StyleSheet, Text, View } from 'react-native'

import Button from '@/components/shared/Button/Button'
import TextInput from '@/components/shared/Input/TextInput'
import { useShareShoppingList } from '@/hooks/queries/mutations/useShareShoppingList'

interface ShareShoppingListModalProps {
    visible: boolean
    onClose: () => void
    shoppingListId: number | null
}

export default function ShareShoppingListModal({ visible, onClose, shoppingListId }: ShareShoppingListModalProps) {
    const [email, setEmail] = useState('')
    const [modalContent, setModalContent] = useState<'form' | 'success'>('form')
    const [errorMessage, setErrorMessage] = useState('')

    const shareListMutation = useShareShoppingList()

    const NUM_MILLISECONDS_TO_SHOW_SUCCESS_MODAL = 2000

    if (!shoppingListId) {
        return null
    }

    const handleSubmit = async () => {
        // Clear any previous error message
        setErrorMessage('')

        try {
            await shareListMutation.mutateAsync({
                shoppingListId,
                email,
                permissions: 'editor', // Default to editor permissions
            })

            setModalContent('success')
            setTimeout(() => {
                setModalContent('form')
                setEmail('')
                onClose()
            }, NUM_MILLISECONDS_TO_SHOW_SUCCESS_MODAL)
        } catch (error) {
            console.error('Share shopping list error:', error)
            let errorMessage = 'Failed to share shopping list'

            if (error instanceof Error) {
                errorMessage = error.message
            } else if (typeof error === 'string') {
                errorMessage = error
            } else if (error && typeof error === 'object' && 'message' in error) {
                errorMessage = String(error.message)
            }

            setErrorMessage(errorMessage)
        }
    }

    const handleClose = () => {
        setEmail('')
        setModalContent('form')
        setErrorMessage('')
        onClose()
    }

    function renderSuccessView() {
        return (
            <>
                <View style={styles.modalHeader}>
                    <Text style={styles.title}>Share Shopping List</Text>
                    <Button
                        variant='text'
                        size='small'
                        onPress={handleClose}
                        icon={<Ionicons name='close' size={24} color='#666' />}
                    />
                </View>
                <Text style={styles.label}>Enter email address:</Text>
                <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder='colleague@example.com'
                    keyboardType='email-address'
                />
                {errorMessage && <Text style={styles.inlineError}>{errorMessage}</Text>}
                <View style={styles.buttonContainer}>
                    <Button label='Cancel' variant='text' onPress={handleClose} size='default' />
                    <Button
                        label='Share'
                        variant='primary'
                        onPress={handleSubmit}
                        size='default'
                        disabled={!email || shareListMutation.isPending}
                    />
                </View>
            </>
        )
    }
    function renderSuccessSubmission() {
        return (
            <>
                <Ionicons name='checkmark-circle' size={64} color='#4CAF50' />
                <Text style={styles.successTitle}>Submitted!</Text>
                <Text style={styles.successMessage}>The shopping list has been shared successfully.</Text>
            </>
        )
    }

    return (
        <Modal visible={visible} transparent animationType='fade'>
            <View style={styles.overlay}>
                <View style={modalContent === 'form' ? styles.popup : styles.successPopup}>
                    {modalContent === 'form' && renderSuccessView()}
                    {modalContent === 'success' && renderSuccessSubmission()}
                </View>
            </View>
        </Modal>
    )
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    popup: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 20,
        width: '100%',
        maxWidth: 400,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
    },
    closeButton: {
        padding: 4,
    },
    label: {
        fontSize: 16,
        color: '#333',
        marginBottom: 8,
    },
    textInput: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        marginBottom: 20,
        backgroundColor: '#f9f9f9',
    },
    inlineError: {
        fontSize: 14,
        color: '#F44336',
        marginTop: 8,
        marginBottom: 12,
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
    },
    cancelButton: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#ddd',
    },
    cancelButtonText: {
        color: '#666',
        fontSize: 16,
        fontWeight: '500',
    },
    submitButton: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
        backgroundColor: 'black',
    },
    submitButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '500',
    },
    successPopup: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 32,
        width: '100%',
        maxWidth: 300,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    successTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#4CAF50',
        marginTop: 16,
        marginBottom: 8,
    },
    successMessage: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        lineHeight: 22,
    },
})