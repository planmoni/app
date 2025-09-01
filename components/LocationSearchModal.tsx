import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  Modal,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, MapPin, X, ChevronRight } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';

interface Location {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  address: {
    house_number?: string;
    road?: string;
    suburb?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
}

interface LocationSearchModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectLocation: (location: Location) => void;
  placeholder?: string;
}

export default function LocationSearchModal({
  visible,
  onClose,
  onSelectLocation,
  placeholder = "Search for a location..."
}: LocationSearchModalProps) {
  const { colors, isDark } = useTheme();
  const haptics = useHaptics();
  const { width, height } = Dimensions.get('window');
  const isSmallScreen = width < 380 || height < 700;

  const [searchQuery, setSearchQuery] = useState('');
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTimeout, setSearchTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);

  const searchInputRef = useRef<TextInput>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (visible) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 300);
    }
  }, [visible]);

  // Search locations using OpenStreetMap Nominatim API
  const searchLocations = async (query: string) => {
    if (!query.trim() || query.length < 3) {
      setLocations([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Use OpenStreetMap Nominatim API (free, no API key required)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=ng&limit=10&addressdetails=1`,
        {
          headers: {
            'Accept-Language': 'en-US,en;q=0.9',
            'User-Agent': 'Planmoni/1.0'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch locations');
      }

      const data = await response.json();
      setLocations(data);
    } catch (err) {
      console.error('Location search error:', err);
      setError('Failed to search locations. Please try again.');
      setLocations([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Debounced search
  useEffect(() => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    if (searchQuery.trim()) {
      const timeout = setTimeout(() => {
        searchLocations(searchQuery);
      }, 500); // 500ms delay

      setSearchTimeout(timeout);
    } else {
      setLocations([]);
    }

    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [searchQuery]);

  const handleSelectLocation = (location: Location) => {
    haptics.selection();
    onSelectLocation(location);
    onClose();
    setSearchQuery('');
    setLocations([]);
  };

  const formatLocationName = (location: Location) => {
    const parts = location.display_name.split(', ');
    
    // For Nigerian addresses, try to extract meaningful parts
    if (location.address) {
      const { road, suburb, city, state } = location.address;
      const addressParts = [];
      
      if (road) addressParts.push(road);
      if (suburb) addressParts.push(suburb);
      if (city) addressParts.push(city);
      if (state) addressParts.push(state);
      
      if (addressParts.length > 0) {
        return addressParts.join(', ');
      }
    }
    
    // Fallback to first 3 parts of display name
    return parts.slice(0, 3).join(', ');
  };

  const formatLocationDetails = (location: Location) => {
    const parts = location.display_name.split(', ');
    return parts.slice(3).join(', ');
  };

  const renderLocationItem = ({ item }: { item: Location }) => (
    <Pressable
      style={styles.locationItem}
      onPress={() => handleSelectLocation(item)}
    >
      <View style={styles.locationIcon}>
        <MapPin size={16} color={colors.primary} />
      </View>
      <View style={styles.locationContent}>
        <Text style={styles.locationName} numberOfLines={1}>
          {formatLocationName(item)}
        </Text>
        <Text style={styles.locationDetails} numberOfLines={1}>
          {formatLocationDetails(item)}
        </Text>
      </View>
      <ChevronRight size={16} color={colors.textTertiary} />
    </Pressable>
  );

  const styles = StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalContainer: {
      flex: 1,
      backgroundColor: colors.backgroundSecondary,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: isSmallScreen ? 16 : 20,
      paddingVertical: isSmallScreen ? 12 : 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    headerTitle: {
      fontSize: isSmallScreen ? 16 : 18,
      fontWeight: '600',
      color: colors.text,
    },
    closeButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.backgroundTertiary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    searchContainer: {
      paddingHorizontal: isSmallScreen ? 16 : 20,
      paddingVertical: 16,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    searchInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.backgroundTertiary,
      borderRadius: 12,
      paddingHorizontal: 12,
      height: isSmallScreen ? 44 : 48,
    },
    searchIcon: {
      marginRight: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: isSmallScreen ? 14 : 16,
      color: colors.text,
    },
    listContainer: {
      flex: 1,
    },
    locationItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: isSmallScreen ? 16 : 20,
      paddingVertical: isSmallScreen ? 12 : 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    locationIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    locationContent: {
      flex: 1,
      marginRight: 8,
    },
    locationName: {
      fontSize: isSmallScreen ? 14 : 16,
      fontWeight: '500',
      color: colors.text,
      marginBottom: 2,
    },
    locationDetails: {
      fontSize: isSmallScreen ? 12 : 14,
      color: colors.textSecondary,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40,
    },
    loadingText: {
      fontSize: 16,
      color: colors.textSecondary,
      marginTop: 16,
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40,
    },
    errorText: {
      fontSize: 16,
      color: colors.error,
      textAlign: 'center',
      marginTop: 16,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40,
    },
    emptyText: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 16,
    },
    emptySubtext: {
      fontSize: 14,
      color: colors.textTertiary,
      textAlign: 'center',
      marginTop: 8,
    },
  });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.modalContainer} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Select Location</Text>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <X size={20} color={colors.text} />
          </Pressable>
        </View>

        {/* Search Input */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <Search size={20} color={colors.textSecondary} style={styles.searchIcon} />
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              placeholder={placeholder}
              placeholderTextColor={colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>

        {/* Results */}
        <View style={styles.listContainer}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Searching locations...</Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : locations.length === 0 && searchQuery.length >= 3 ? (
            <View style={styles.emptyContainer}>
              <MapPin size={48} color={colors.textTertiary} />
              <Text style={styles.emptyText}>No locations found</Text>
              <Text style={styles.emptySubtext}>
                Try searching for a different area or street name
              </Text>
            </View>
          ) : locations.length === 0 && searchQuery.length < 3 ? (
            <View style={styles.emptyContainer}>
              <Search size={48} color={colors.textTertiary} />
              <Text style={styles.emptyText}>Search for a location</Text>
              <Text style={styles.emptySubtext}>
                Enter at least 3 characters to start searching
              </Text>
            </View>
          ) : (
            <FlatList
              data={locations}
              keyExtractor={(item) => item.place_id.toString()}
              renderItem={renderLocationItem}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 20 }}
            />
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
} 