import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  Pressable, 
  ScrollView, 
  ActivityIndicator,
  Alert,
  Image
} from 'react-native';
import { X, Plus, Edit, Trash, Eye, EyeOff, ArrowUp, ArrowDown } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import Button from '@/components/Button';

interface Banner {
  id: string;
  title: string;
  description: string | null;
  image_url: string;
  cta_text: string | null;
  link_url: string | null;
  order_index: number;
  is_active: boolean;
}

export default function BannerAdmin() {
  const { colors, isDark } = useTheme();
  const { session } = useAuth();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Form state
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    id: '',
    title: '',
    description: '',
    image_url: '',
    cta_text: '',
    link_url: '',
    order_index: 0,
    is_active: true
  });
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check if user is admin
  useEffect(() => {
    const checkAdmin = async () => {
      if (!session?.user?.id) return;
      
      try {
        const { data, error } = await supabase.rpc('is_admin');
        if (error) throw error;
        setIsAdmin(!!data);
      } catch (err) {
        console.error('Error checking admin status:', err);
        setIsAdmin(false);
      }
    };
    
    checkAdmin();
  }, [session?.user?.id]);

  // Fetch banners
  useEffect(() => {
    fetchBanners();
  }, []);

  const fetchBanners = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('banners')
        .select('*')
        .order('order_index', { ascending: true });
      
      if (error) throw error;
      setBanners(data || []);
    } catch (err) {
      console.error('Error fetching banners:', err);
      setError(err instanceof Error ? err.message : 'Failed to load banners');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddBanner = () => {
    setFormData({
      id: '',
      title: '',
      description: '',
      image_url: '',
      cta_text: '',
      link_url: '',
      order_index: banners.length,
      is_active: true
    });
    setIsEditing(false);
    setShowForm(true);
  };

  const handleEditBanner = (banner: Banner) => {
    setFormData({
      id: banner.id,
      title: banner.title,
      description: banner.description || '',
      image_url: banner.image_url,
      cta_text: banner.cta_text || '',
      link_url: banner.link_url || '',
      order_index: banner.order_index,
      is_active: banner.is_active
    });
    setIsEditing(true);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      setError(null);
      
      // Validate required fields
      if (!formData.title || !formData.image_url) {
        setError('Title and image URL are required');
        return;
      }
      
      if (isEditing) {
        // Update existing banner
        const { error } = await supabase
          .from('banners')
          .update({
            title: formData.title,
            description: formData.description || null,
            image_url: formData.image_url,
            cta_text: formData.cta_text || null,
            link_url: formData.link_url || null,
            order_index: formData.order_index,
            is_active: formData.is_active
          })
          .eq('id', formData.id);
        
        if (error) throw error;
      } else {
        // Create new banner
        const { error } = await supabase
          .from('banners')
          .insert({
            title: formData.title,
            description: formData.description || null,
            image_url: formData.image_url,
            cta_text: formData.cta_text || null,
            link_url: formData.link_url || null,
            order_index: formData.order_index,
            is_active: formData.is_active
          });
        
        if (error) throw error;
      }
      
      // Refresh banners
      await fetchBanners();
      setShowForm(false);
    } catch (err) {
      console.error('Error saving banner:', err);
      setError(err instanceof Error ? err.message : 'Failed to save banner');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteBanner = async (id: string) => {
    Alert.alert(
      'Delete Banner',
      'Are you sure you want to delete this banner?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              const { error } = await supabase
                .from('banners')
                .delete()
                .eq('id', id);
              
              if (error) throw error;
              await fetchBanners();
            } catch (err) {
              console.error('Error deleting banner:', err);
              setError(err instanceof Error ? err.message : 'Failed to delete banner');
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('banners')
        .update({ is_active: !isActive })
        .eq('id', id);
      
      if (error) throw error;
      await fetchBanners();
    } catch (err) {
      console.error('Error toggling banner status:', err);
      setError(err instanceof Error ? err.message : 'Failed to update banner status');
    }
  };

  const handleMoveUp = async (index: number) => {
    if (index === 0) return;
    
    try {
      const banner = banners[index];
      const prevBanner = banners[index - 1];
      
      // Swap order_index values
      const { error: error1 } = await supabase
        .from('banners')
        .update({ order_index: prevBanner.order_index })
        .eq('id', banner.id);
      
      const { error: error2 } = await supabase
        .from('banners')
        .update({ order_index: banner.order_index })
        .eq('id', prevBanner.id);
      
      if (error1 || error2) throw error1 || error2;
      await fetchBanners();
    } catch (err) {
      console.error('Error moving banner:', err);
      setError(err instanceof Error ? err.message : 'Failed to reorder banners');
    }
  };

  const handleMoveDown = async (index: number) => {
    if (index === banners.length - 1) return;
    
    try {
      const banner = banners[index];
      const nextBanner = banners[index + 1];
      
      // Swap order_index values
      const { error: error1 } = await supabase
        .from('banners')
        .update({ order_index: nextBanner.order_index })
        .eq('id', banner.id);
      
      const { error: error2 } = await supabase
        .from('banners')
        .update({ order_index: banner.order_index })
        .eq('id', nextBanner.id);
      
      if (error1 || error2) throw error1 || error2;
      await fetchBanners();
    } catch (err) {
      console.error('Error moving banner:', err);
      setError(err instanceof Error ? err.message : 'Failed to reorder banners');
    }
  };

  if (!isAdmin) {
    return (
      <View style={[styles.container, { backgroundColor: colors.backgroundSecondary }]}>
        <Text style={[styles.message, { color: colors.textSecondary }]}>
          You don't have permission to access this page.
        </Text>
      </View>
    );
  }

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      padding: 16,
      backgroundColor: colors.backgroundSecondary,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
    },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primary,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      gap: 8,
    },
    addButtonText: {
      color: '#FFFFFF',
      fontWeight: '600',
    },
    message: {
      fontSize: 16,
      textAlign: 'center',
      marginTop: 20,
    },
    errorContainer: {
      backgroundColor: colors.errorLight,
      padding: 12,
      borderRadius: 8,
      marginBottom: 16,
    },
    errorText: {
      color: colors.error,
    },
    bannerList: {
      marginBottom: 16,
    },
    bannerItem: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    bannerHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    bannerTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      flex: 1,
      marginRight: 8,
    },
    bannerActions: {
      flexDirection: 'row',
      gap: 8,
    },
    actionButton: {
      padding: 8,
      borderRadius: 8,
      backgroundColor: colors.backgroundTertiary,
    },
    bannerContent: {
      marginBottom: 12,
    },
    bannerDescription: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 8,
    },
    bannerImage: {
      width: '100%',
      height: 120,
      borderRadius: 8,
      marginBottom: 8,
    },
    bannerDetails: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    bannerDetail: {
      backgroundColor: colors.backgroundTertiary,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
    },
    bannerDetailText: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    formContainer: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    formHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    formTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    closeButton: {
      padding: 8,
      borderRadius: 8,
      backgroundColor: colors.backgroundTertiary,
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
      backgroundColor: colors.backgroundTertiary,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: colors.text,
    },
    textArea: {
      minHeight: 80,
      textAlignVertical: 'top',
    },
    switchContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    switchLabel: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.text,
    },
    switch: {
      // Switch styles
    },
    submitButton: {
      backgroundColor: colors.primary,
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center',
    },
    submitButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    orderControls: {
      flexDirection: 'row',
      gap: 8,
    },
    orderButton: {
      padding: 8,
      borderRadius: 8,
      backgroundColor: colors.backgroundTertiary,
    },
    activeStatus: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.backgroundTertiary,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
    },
    activeStatusText: {
      fontSize: 12,
      color: colors.textSecondary,
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Banner Management</Text>
        <Pressable style={styles.addButton} onPress={handleAddBanner}>
          <Plus size={20} color="#FFFFFF" />
          <Text style={styles.addButtonText}>Add Banner</Text>
        </Pressable>
      </View>
      
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      
      {isLoading ? (
        <ActivityIndicator size="large" color={colors.primary} />
      ) : (
        <ScrollView style={styles.bannerList}>
          {banners.length === 0 ? (
            <Text style={styles.message}>No banners found. Add your first banner!</Text>
          ) : (
            banners.map((banner, index) => (
              <View key={banner.id} style={styles.bannerItem}>
                <View style={styles.bannerHeader}>
                  <Text style={styles.bannerTitle}>{banner.title}</Text>
                  <View style={styles.bannerActions}>
                    <View style={styles.orderControls}>
                      <Pressable 
                        style={styles.orderButton} 
                        onPress={() => handleMoveUp(index)}
                        disabled={index === 0}
                      >
                        <ArrowUp 
                          size={20} 
                          color={index === 0 ? colors.textTertiary : colors.text} 
                        />
                      </Pressable>
                      <Pressable 
                        style={styles.orderButton} 
                        onPress={() => handleMoveDown(index)}
                        disabled={index === banners.length - 1}
                      >
                        <ArrowDown 
                          size={20} 
                          color={index === banners.length - 1 ? colors.textTertiary : colors.text} 
                        />
                      </Pressable>
                    </View>
                    <Pressable 
                      style={styles.actionButton} 
                      onPress={() => handleToggleActive(banner.id, banner.is_active)}
                    >
                      {banner.is_active ? (
                        <Eye size={20} color={colors.text} />
                      ) : (
                        <EyeOff size={20} color={colors.text} />
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
                  </View>
                </View>
                
                <View style={styles.bannerContent}>
                  <Image 
                    source={{ uri: banner.image_url }} 
                    style={styles.bannerImage}
                    resizeMode="cover"
                  />
                  {banner.description && (
                    <Text style={styles.bannerDescription}>{banner.description}</Text>
                  )}
                  <View style={styles.bannerDetails}>
                    <View style={styles.activeStatus}>
                      {banner.is_active ? (
                        <Eye size={12} color={colors.success} />
                      ) : (
                        <EyeOff size={12} color={colors.error} />
                      )}
                      <Text style={styles.activeStatusText}>
                        {banner.is_active ? 'Active' : 'Inactive'}
                      </Text>
                    </View>
                    {banner.cta_text && (
                      <View style={styles.bannerDetail}>
                        <Text style={styles.bannerDetailText}>CTA: {banner.cta_text}</Text>
                      </View>
                    )}
                    {banner.link_url && (
                      <View style={styles.bannerDetail}>
                        <Text style={styles.bannerDetailText}>Link: {banner.link_url}</Text>
                      </View>
                    )}
                    <View style={styles.bannerDetail}>
                      <Text style={styles.bannerDetailText}>Order: {banner.order_index}</Text>
                    </View>
                  </View>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}
      
      {showForm && (
        <View style={styles.formContainer}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>
              {isEditing ? 'Edit Banner' : 'Add New Banner'}
            </Text>
            <Pressable style={styles.closeButton} onPress={() => setShowForm(false)}>
              <X size={20} color={colors.text} />
            </Pressable>
          </View>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>Title *</Text>
            <TextInput
              style={styles.input}
              value={formData.title}
              onChangeText={(text) => setFormData({ ...formData, title: text })}
              placeholder="Enter banner title"
              placeholderTextColor={colors.textTertiary}
            />
          </View>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.description}
              onChangeText={(text) => setFormData({ ...formData, description: text })}
              placeholder="Enter banner description"
              placeholderTextColor={colors.textTertiary}
              multiline
            />
          </View>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>Image URL *</Text>
            <TextInput
              style={styles.input}
              value={formData.image_url}
              onChangeText={(text) => setFormData({ ...formData, image_url: text })}
              placeholder="Enter image URL"
              placeholderTextColor={colors.textTertiary}
            />
          </View>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>CTA Text</Text>
            <TextInput
              style={styles.input}
              value={formData.cta_text}
              onChangeText={(text) => setFormData({ ...formData, cta_text: text })}
              placeholder="Enter call-to-action text"
              placeholderTextColor={colors.textTertiary}
            />
          </View>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>Link URL</Text>
            <TextInput
              style={styles.input}
              value={formData.link_url}
              onChangeText={(text) => setFormData({ ...formData, link_url: text })}
              placeholder="Enter link URL"
              placeholderTextColor={colors.textTertiary}
            />
          </View>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>Order Index</Text>
            <TextInput
              style={styles.input}
              value={formData.order_index.toString()}
              onChangeText={(text) => {
                const value = parseInt(text);
                if (!isNaN(value)) {
                  setFormData({ ...formData, order_index: value });
                }
              }}
              placeholder="Enter order index"
              placeholderTextColor={colors.textTertiary}
              keyboardType="numeric"
            />
          </View>
          
          <View style={styles.switchContainer}>
            <Text style={styles.switchLabel}>Active</Text>
            <Pressable
              onPress={() => setFormData({ ...formData, is_active: !formData.is_active })}
            >
              {formData.is_active ? (
                <Eye size={24} color={colors.success} />
              ) : (
                <EyeOff size={24} color={colors.error} />
              )}
            </Pressable>
          </View>
          
          <Button
            title={isSubmitting ? 'Saving...' : isEditing ? 'Update Banner' : 'Add Banner'}
            onPress={handleSubmit}
            disabled={isSubmitting}
            style={{ backgroundColor: colors.primary }}
          />
        </View>
      )}
    </View>
  );
}