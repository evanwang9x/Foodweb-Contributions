import Fuse from 'fuse.js'
import { useCallback, useMemo, useState } from 'react'
import { StyleSheet } from 'react-native'

import TextInput from '@/components/shared/Input/TextInput'

interface FuzzySearchProps<T> {
  data: T[]
  searchKeys: string[]
  threshold?: number
  placeholder?: string
  style?: any
}

export function useFuzzySearch<T>({
  data,
  searchKeys,
  threshold = 0.7,
  placeholder = 'Search...',
  style,
}: FuzzySearchProps<T>) {
  const [queryText, setQueryText] = useState('')

  // Memoize Fuse instance to avoid recreating it on every render
  const fuse = useMemo(() => {
    return new Fuse(data, {
      keys: searchKeys,
      threshold,
      includeScore: true,
      shouldSort: true,
    })
  }, [data, searchKeys, threshold])

  // Memoize filtered results
  const filteredData = useMemo(() => {
    if (!queryText.trim()) {
      return data
    }
    return fuse.search(queryText).map((result) => result.item)
  }, [queryText, fuse, data])

  // Use callback to prevent unnecessary re-renders
  const handleTextChange = useCallback((text: string) => {
    setQueryText(text)
  }, [])

  const searchInput = useMemo(
    () => (
      <TextInput
        style={[styles.searchInput, style]}
        placeholder={placeholder}
        value={queryText}
        onChangeText={handleTextChange}
        autoCorrect={false}
        autoCapitalize='none'
      />
    ),
    [placeholder, queryText, handleTextChange, style]
  )

  return {
    queryText,
    filteredData,
    searchInput,
  }
}

const styles = StyleSheet.create({
  searchInput: {
    height: 40,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    margin: 16,
    fontSize: 16,
    backgroundColor: '#fff',
  },
})
