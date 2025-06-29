import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Image, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, Plus, Edit, Trash, Eye, EyeOff, ChevronUp, ChevronDown, Upload } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import Button from '@/components/Button';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';

type Banner = {
  id: string;
  title: string;
  description: string | null;
  image_url: string;
  cta_text: string | null;
  link_url: string | null;
  order_index: number;
  is_active: boolean;
};

export default function BannersAdminScreen() {
  const { colors, isDark } = useTheme();
  const { session } = useAuth();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddingBanner, setIsAddingBanner] = useState(false);
  const [isEditingBanner, setIsEditingBanner] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    image_url: '',
    cta_text: '',
    link_url: '',
    is_active: true
  });
  
  useEffect(() => {
    fetchBanners();
  }, []);
  
  const fetchBanners = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch('/api/banners');
      
      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.banners) {
        setBanners(data.banners);
      }
    } catch (err) {
      console.error('Error fetching banners:', err);
      setError(err instanceof Error ? err.message : 'Failed to load banners');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleAddBanner = () => {
    setFormData({
      title: '',
      description: '',
      image_url: '',
      cta_text: '',
      link_url: '',
      is_active: true
    });
    setIsAddingBanner(true);
    setIsEditingBanner(null);
  };
  
  const handleEditBanner = (banner: Banner) => {
    setFormData({
      title: banner.title,
      description: banner.description || '',
      image_url: banner.image_url,
      cta_text: banner.cta_text || '',
      link_url: banner.link_url || '',
      is_active: banner.is_active
    });
    setIsEditingBanner(banner.id);
    setIsAddingBanner(false);
  };
  
  const handleDeleteBanner = async (bannerId: string) => {
    try {
      const response = await fetch(`/api/banners?id=${bannerId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }
      
      // Remove banner from state
      setBanners(banners.filter(banner => banner.id !== bannerId));
      
      Alert.alert('Success', 'Banner deleted successfully');
    } catch (err) {
      console.error('Error deleting banner:', err);
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to delete banner');
    }
  };
  
  const handleToggleActive = async (banner: Banner) => {
    try {
      const response = await fetch(`/api/banners?id=${banner.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          is_active: !banner.is_active
        })
      });
      
      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }
      
      // Update banner in state
      setBanners(banners.map(b => 
        b.id === banner.id ? { ...b, is_active: !b.is_active } : b
      ));
    } catch (err) {
      console.error('Error toggling banner active state:', err);
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to update banner');
    }
  };
  
  const handleReorderBanner = async (bannerId: string, direction: 'up' | 'down') => {
    const bannerIndex = banners.findIndex(b => b.id === bannerId);
    if (bannerIndex === -1) return;
    
    // Can't move first item up or last item down
    if ((direction === 'up' && bannerIndex === 0) || 
        (direction === 'down' && bannerIndex === banners.length - 1)) {
      return;
    }
    
    const newBanners = [...banners];
    const swapIndex = direction === 'up' ? bannerIndex - 1 : bannerIndex + 1;
    
    // Swap order_index values
    const tempOrderIndex = newBanners[bannerIndex].order_index;
    newBanners[bannerIndex].order_index = newBanners[swapIndex].order_index;
    newBanners[swapIndex].order_index = tempOrderIndex;
    
    // Swap positions in array
    [newBanners[bannerIndex], newBanners[swapIndex]] = [newBanners[swapIndex], newBanners[bannerIndex]];
    
    // Update state
    setBanners(newBanners);
    
    // Update in database
    try {
      const promises = [
        fetch(`/api/banners?id=${newBanners[bannerIndex].id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`
          },
          body: JSON.stringify({
            order_index: newBanners[bannerIndex].order_index
          })
        }),
        fetch(`/api/banners?id=${newBanners[swapIndex].id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`
          },
          body: JSON.stringify({
            order_index: newBanners[swapIndex].order_index
          })
        })
      ];
      
      await Promise.all(promises);
    } catch (err) {
      console.error('Error reordering banners:', err);
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to reorder banners');
      // Revert state on error
      fetchBanners();
    }
  };
  
  const handleSubmitForm = async () => {
    try {
      // Validate form
      if (!formData.title || !formData.image_url) {
        Alert.alert('Error', 'Title and image are required');
        return;
      }
      
      const method = isEditingBanner ? 'PUT' : 'POST';
      const url = isEditingBanner ? `/api/banners?id=${isEditingBanner}` : '/api/banners';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          ...formData,
          order_index: isEditingBanner 
            ? banners.find(b => b.id === isEditingBanner)?.order_index 
            : banners.length > 0 
              ? Math.max(...banners.map(b => b.order_index)) + 1 
              : 0
        })
      });
      
      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }
      
      // Refresh banners
      await fetchBanners();
      
      // Reset form
      setIsAddingBanner(false);
      setIsEditingBanner(null);
      
      Alert.alert('Success', isEditingBanner ? 'Banner updated successfully' : 'Banner added successfully');
    } catch (err) {
      console.error('Error submitting banner form:', err);
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save banner');
    }
  };
  
  const handlePickImage = async () => {
    try {
      // Request permissions
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Please grant access to your photo library to upload images');
        return;
      }
      
      // Pick image
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });
      
      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }
      
      const selectedImage = result.assets[0];
      
      // Upload image to Supabase Storage
      await uploadImage(selectedImage.uri);
    } catch (err) {
      console.error('Error picking image:', err);
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to pick image');
    }
  };
  
  const uploadImage = async (uri: string) => {
    try {
      setIsUploading(true);
      
      // Get file info
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists) {
        throw new Error('File does not exist');
      }
      
      // Get file extension
      const fileExtension = uri.split('.').pop()?.toLowerCase() || 'jpg';
      
      // Generate a unique file name
      const fileName = `banner_${Date.now()}.${fileExtension}`;
      
      // Get a signed URL for uploading
      const response = await fetch('/api/storage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          fileName,
          fileType: `image/${fileExtension}`,
          folderPath: 'banners'
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to get upload URL: ${response.status}`);
      }
      
      const { signedUrl, path, publicUrl } = await response.json();
      
      // Read file as base64
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64
      });
      
      // Convert base64 to blob
      const blob = await (await fetch(`data:image/${fileExtension};base64,${base64}`)).blob();
      
      // Upload to signed URL
      const uploadResponse = await fetch(signedUrl, {
        method: 'PUT',
        body: blob,
        headers: {
          'Content-Type': `image/${fileExtension}`
        }
      });
      
      if (!uploadResponse.ok) {
        throw new Error(`Failed to upload image: ${uploadResponse.status}`);
      }
      
      // Update form with public URL
      setFormData({
        ...formData,
        image_url: publicUrl
      });
      
      Alert.alert('Success', 'Image uploaded successfully');
    } catch (err) {
      console.error('Error uploading image:', err);
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to upload image');
    } finally {
      setIsUploading(false);
    }
  };
  
  const styles = createStyles(colors, isDark);
  
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Manage Banners</Text>
        <Pressable onPress={handleAddBanner} style={styles.addButton}>
          <Plus size={24} color="#FFFFFF" />
        </Pressable>
      </View>
      
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading banners...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <Button 
              title="Retry" 
              onPress={fetchBanners} 
              style={styles.retryButton}
            />
          </View>
        ) : (
          <>
            {(isAddingBanner || isEditingBanner) ? (
              <View style={styles.formContainer}>
                <Text style={styles.formTitle}>
                  {isEditingBanner ? 'Edit Banner' : 'Add New Banner'}
                </Text>
                
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Title</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.title}
                    onChangeText={(text) => setFormData({...formData, title: text})}
                    placeholder="Enter banner title"
                    placeholderTextColor={colors.textTertiary}
                  />
                </View>
                
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Description (Optional)</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={formData.description}
                    onChangeText={(text) => setFormData({...formData, description: text})}
                    placeholder="Enter banner description"
                    placeholderTextColor={colors.textTertiary}
                    multiline
                    numberOfLines={3}
                  />
                </View>
                
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Image</Text>
                  {formData.image_url ? (
                    <View style={styles.imagePreviewContainer}>
                      <Image
                        source={{ uri: formData.image_url }}
                        style={styles.imagePreview}
                        resizeMode="cover"
                      />
                      <Pressable 
                        style={styles.changeImageButton}
                        onPress={handlePickImage}
                      >
                        <Text style={styles.changeImageText}>Change Image</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable 
                      style={styles.uploadButton}
                      onPress={handlePickImage}
                      disabled={isUploading}
                    >
                      {isUploading ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Upload size={24} color="#FFFFFF" />
                          <Text style={styles.uploadButtonText}>Upload Image</Text>
                        </>
                      )}
                    </Pressable>
                  )}
                </View>
                
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Call to Action Text (Optional)</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.cta_text}
                    onChangeText={(text) => setFormData({...formData, cta_text: text})}
                    placeholder="E.g., Learn More, Get Started"
                    placeholderTextColor={colors.textTertiary}
                  />
                </View>
                
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Link URL (Optional)</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.link_url}
                    onChangeText={(text) => setFormData({...formData, link_url: text})}
                    placeholder="E.g., /create-payout"
                    placeholderTextColor={colors.textTertiary}
                  />
                </View>
                
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Active</Text>
                  <Pressable 
                    style={[
                      styles.toggleButton,
                      formData.is_active ? styles.toggleActive : styles.toggleInactive
                    ]}
                    onPress={() => setFormData({...formData, is_active: !formData.is_active})}
                  >
                    <Text style={styles.toggleText}>
                      {formData.is_active ? 'Active' : 'Inactive'}
                    </Text>
                  </Pressable>
                </View>
                
                <View style={styles.formActions}>
                  <Button
                    title="Cancel"
                    onPress={() => {
                      setIsAddingBanner(false);
                      setIsEditingBanner(null);
                    }}
                    variant="outline"
                    style={styles.cancelButton}
                  />
                  <Button
                    title={isEditingBanner ? 'Update Banner' : 'Add Banner'}
                    onPress={handleSubmitForm}
                    style={styles.submitButton}
                  />
                </View>
              </View>
            ) : (
              <>
                {banners.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No banners found</Text>
                    <Text style={styles.emptySubtext}>Add your first banner to get started</Text>
                    <Button
                      title="Add Banner"
                      onPress={handleAddBanner}
                      style={styles.emptyAddButton}
                      icon={Plus}
                    />
                  </View>
                ) : (
                  <View style={styles.bannersList}>
                    {banners.map((banner) => (
                      <View key={banner.id} style={styles.bannerCard}>
                        <Image
                          source={{ uri: banner.image_url }}
                          style={styles.bannerImage}
                          resizeMode="cover"
                        />
                        <View style={styles.bannerDetails}>
                          <View style={styles.bannerHeader}>
                            <Text style={styles.bannerTitle}>{banner.title}</Text>
                            <View style={[
                              styles.statusBadge,
                              banner.is_active ? styles.activeBadge : styles.inactiveBadge
                            ]}>
                              <Text style={[
                                styles.statusText,
                                banner.is_active ? styles.activeText : styles.inactiveText
                              ]}>
                                {banner.is_active ? 'Active' : 'Inactive'}
                              </Text>
                            </View>
                          </View>
                          
                          {banner.description && (
                            <Text style={styles.bannerDescription} numberOfLines={2}>
                              {banner.description}
                            </Text>
                          )}
                          
                          {banner.cta_text && (
                            <Text style={styles.bannerCta}>
                              CTA: {banner.cta_text}
                            </Text>
                          )}
                          
                          {banner.link_url && (
                            <Text style={styles.bannerLink} numberOfLines={1}>
                              Link: {banner.link_url}
                            </Text>
                          )}
                          
                          <View style={styles.bannerActions}>
                            <Pressable 
                              style={styles.actionButton}
                              onPress={() => handleToggleActive(banner)}
                            >
                              {banner.is_active ? (
                                <EyeOff size={20} color={colors.text} />
                              ) : (
                                <Eye size={20} color={colors.text} />
                              )}
                            </Pressable>
                            
                            <Pressable 
                              style={styles.actionButton}
                              onPress={() => handleEditBanner(banner)}
                            >
                              <Edit size={20} color={colors.text} />
                            </Pressable>
                            
                            <Pressable 
                              style={styles.actionButton}
                              onPress={() => handleDeleteBanner(banner.id)}
                            >
                              <Trash size={20} color={colors.error} />
                            </Pressable>
                            
                            <View style={styles.reorderButtons}>
                              <Pressable 
                                style={styles.reorderButton}
                                onPress={() => handleReorderBanner(banner.id, 'up')}
                                disabled={banners.indexOf(banner) === 0}
                              >
                                <ChevronUp 
                                  size={20} 
                                  color={banners.indexOf(banner) === 0 ? colors.textTertiary : colors.text} 
                                />
                              </Pressable>
                              
                              <Pressable 
                                style={styles.reorderButton}
                                onPress={() => handleReorderBanner(banner.id, 'down')}
                                disabled={banners.indexOf(banner) === banners.length - 1}
                              >
                                <ChevronDown 
                                  size={20} 
                                  color={banners.indexOf(banner) === banners.length - 1 ? colors.textTertiary : colors.text} 
                                />
                              </Pressable>
                            </View>
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 16,
  },
  errorContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 16,
    color: colors.error,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    minWidth: 120,
    backgroundColor: colors.primary,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyAddButton: {
    minWidth: 150,
    backgroundColor: colors.primary,
  },
  bannersList: {
    gap: 16,
  },
  bannerCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  bannerImage: {
    width: '100%',
    height: 120,
  },
  bannerDetails: {
    padding: 16,
  },
  bannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeBadge: {
    backgroundColor: '#DCFCE7',
  },
  inactiveBadge: {
    backgroundColor: '#FEE2E2',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  activeText: {
    color: '#22C55E',
  },
  inactiveText: {
    color: '#EF4444',
  },
  bannerDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  bannerCta: {
    fontSize: 14,
    color: colors.primary,
    marginBottom: 4,
  },
  bannerLink: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  bannerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reorderButtons: {
    flexDirection: 'row',
    gap: 4,
  },
  reorderButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  formContainer: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.backgroundTertiary,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  imagePreviewContainer: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 8,
  },
  imagePreview: {
    width: '100%',
    height: 150,
  },
  changeImageButton: {
    backgroundColor: colors.backgroundTertiary,
    padding: 8,
    alignItems: 'center',
  },
  changeImageText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.primary,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    padding: 12,
    borderRadius: 8,
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  toggleButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  toggleActive: {
    backgroundColor: '#DCFCE7',
  },
  toggleInactive: {
    backgroundColor: '#FEE2E2',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '500',
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16,
  },
  cancelButton: {
    borderColor: colors.border,
  },
  submitButton: {
    backgroundColor: colors.primary,
  },
});