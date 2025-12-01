import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  useWindowDimensions,
  Modal,
  Pressable,
  Image,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { X } from "lucide-react-native";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import { useTheme } from "@/contexts/ThemeContext";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface LivenessTestEnhancedProps {
  isVisible: boolean;
  onClose: () => void;
  onComplete?: (capturedImage: string) => void;
}

const HOLD_DURATION = 5000; // 5 seconds

export default function LivenessTestEnhanced({
  isVisible,
  onClose,
  onComplete,
}: LivenessTestEnhancedProps) {
  console.log('[LivenessTest] Component rendered, isVisible:', isVisible);
  const [permission, requestPermission] = useCameraPermissions();
  const { width } = useWindowDimensions();
  const { colors, isDark } = useTheme();
  const { session } = useAuth();
  const styles = createStyles(colors, isDark);
  
  console.log('[LivenessTest] Permissions check:', { hasPermission: permission?.granted, hasSession: !!session });

  const [isHolding, setIsHolding] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);

  const progressValue = useSharedValue(0);
  const cameraRef = useRef<any>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset all state when modal closes or opens
  const resetState = useCallback(() => {
    setIsHolding(false);
    setCapturedImage(null);
    setUploadComplete(false);
    progressValue.value = 0;
    
    // Clear any pending timers
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, [progressValue]);

  // Animated props for progress ring
  const animatedProps = useAnimatedProps(() => {
    'worklet';
    const progress = progressValue.value;
    const circumference = 2 * Math.PI * 140;
    const offset = circumference - (progress / 100) * circumference;
    return { strokeDashoffset: offset };
  });

  // Request camera permission when modal becomes visible
  useEffect(() => {
    if (isVisible && !permission?.granted && !isRequestingPermission) {
      console.log('[LivenessTest] Requesting camera permission...');
      setIsRequestingPermission(true);
      requestPermission().then((result) => {
        console.log('[LivenessTest] Camera permission result:', result.granted);
        setIsRequestingPermission(false);
        if (!result.granted) {
          console.warn('[LivenessTest] Camera permission denied');
        }
      }).catch((error) => {
        console.error('[LivenessTest] Error requesting camera permission:', error);
        setIsRequestingPermission(false);
      });
    }
  }, [isVisible, permission?.granted, isRequestingPermission, requestPermission]);

  useEffect(() => {
    console.log('[LivenessTest] Visibility changed:', isVisible);
    if (isVisible) {
      console.log('[LivenessTest] Modal opened, resetting state');
      resetState();
    } else {
      console.log('[LivenessTest] Modal closed, resetting state');
      resetState();
    }
  }, [isVisible, resetState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    };
  }, []);

  const capturePhoto = useCallback(async () => {
    console.log('[LivenessTest] capturePhoto called');
    try {
      if (!cameraRef.current) {
        console.error('[LivenessTest] Camera ref is null, cannot capture photo');
        return;
      }
      
      console.log('[LivenessTest] Taking photo...');
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
      });
      console.log('[LivenessTest] Photo captured, URI:', photo.uri);
      
      setCapturedImage(photo.uri);
      console.log('[LivenessTest] Image URI set:', photo.uri);
    } catch (error: any) {
      console.error('[LivenessTest] Error capturing photo:', error);
      if (error?.message) {
        console.error('[LivenessTest] Error details:', error.message);
      }
    }
  }, []);

  // Handle hold button press start
  const handleHoldStart = useCallback(() => {
    console.log('[LivenessTest] Hold started');
    if (capturedImage) return; // Don't allow holding if already captured
    
    setIsHolding(true);
    progressValue.value = 0;
    
    // Animate progress from 0 to 100 over HOLD_DURATION
    progressValue.value = withTiming(100, { duration: HOLD_DURATION });
    
    // Set timer to capture photo when hold completes
    holdTimerRef.current = setTimeout(() => {
      console.log('[LivenessTest] Hold completed, capturing photo');
      setIsHolding(false);
      capturePhoto();
      holdTimerRef.current = null;
    }, HOLD_DURATION);
  }, [capturedImage, progressValue, capturePhoto]);

  // Handle hold button release
  const handleHoldEnd = useCallback(() => {
    console.log('[LivenessTest] Hold released');
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    setIsHolding(false);
    // Reset progress with animation
    progressValue.value = withTiming(0, { duration: 200 });
  }, [progressValue]);


  const handleSubmit = async () => {
    console.log('[LivenessTest] handleSubmit called');
    if (!capturedImage || !session?.user?.id) {
      console.error('[LivenessTest] Missing image or user session:', { 
        hasImage: !!capturedImage, 
        hasSession: !!session?.user?.id 
      });
      return;
    }

    console.log('[LivenessTest] Starting submission, image:', capturedImage);
    setIsSubmitting(true);

    try {
      // Upload captured image to Supabase storage
      const fileExtension = capturedImage.split('.').pop() || 'jpg';
      const fileName = `liveness-photo-${Date.now()}.${fileExtension}`;
      const filePath = `kyc-documents/${session.user.id}/${fileName}`;

      const file = {
        uri: capturedImage,
        name: fileName,
        type: 'image/jpeg'
      } as any;

      // Upload to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file, {
          contentType: 'image/jpeg',
          upsert: true
        });

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      // Get the public URL for the uploaded file
      const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      const storageUrl = urlData.publicUrl;
      console.log('[LivenessTest] Image uploaded successfully:', storageUrl);

      // Fetch user profile data
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      // Create new kyc_data record
      const kycDataRecord = {
        user_id: session.user.id,
        first_name: profileData?.first_name || '',
        last_name: profileData?.last_name || '',
        selfie_url: storageUrl,
      };

      // Check if record already exists
      const { data: existingRecord } = await supabase
        .from('kyc_data')
        .select('id')
        .eq('user_id', session.user.id)
        .single();

      if (existingRecord) {
        // Update existing record
        const { error: updateError } = await supabase
          .from('kyc_data')
          .update({ selfie_url: storageUrl })
          .eq('user_id', session.user.id);
        
        if (updateError) {
          console.error('Update error:', updateError);
        }
      } else {
        // Insert new record
        const { error: insertError } = await supabase
          .from('kyc_data')
          .insert(kycDataRecord);
        
        if (insertError) {
          console.error('Insert error:', insertError);
        }
      }

      // Mark upload as complete
      setIsSubmitting(false);
      setUploadComplete(true);
      
      // Call the onComplete callback with the storage URL
      // Let the parent component handle closing and transitioning to BVN step
      if (onComplete && storageUrl) {
        console.log('[LivenessTest] Calling onComplete callback with URL:', storageUrl);
        // Call onComplete immediately - parent will handle closing the modal
        // This prevents the modal from staying open and potentially reopening
        onComplete(storageUrl);
      } else {
        console.log('[LivenessTest] No onComplete callback or storageUrl');
        // If no callback, close after showing success
        setTimeout(() => {
          onClose();
        }, 1500);
      }
    } catch (error) {
      console.error('[LivenessTest] Error uploading liveness photo:', error);
      setIsSubmitting(false);
      setTimeout(() => {
        onClose();
      }, 1000);
    }
  };

  const getInstructionText = useCallback(() => {
    const canUseCamera = permission?.granted && !isRequestingPermission;
    if (!canUseCamera) {
      if (isRequestingPermission) {
        return "Requesting camera permission...";
      }
      return "Camera permission required to start liveness test";
    }
    if (capturedImage) {
      return uploadComplete ? "Verifying..." : "Photo captured!";
    }
    if (isHolding) {
      return "Hold the button...";
    }
    return "Place your face in the frame.";
  }, [permission?.granted, isRequestingPermission, capturedImage, uploadComplete, isHolding]);

  // Don't render if modal is not visible
  if (!isVisible) {
    return null;
  }

  // Show modal even if permission is not granted yet (to show permission request UI)
  // But only render camera if permission is granted
  const canUseCamera = permission?.granted && !isRequestingPermission;
  
  console.log('[LivenessTest] Rendering component, canUseCamera:', canUseCamera);

  return (
    <Modal visible={isVisible} animationType="slide" presentationStyle="fullScreen">
      <View style={[styles.container, { backgroundColor: colors.backgroundSecondary }]}>
        {/* Camera */}
        <View style={styles.cameraWrapper}>
          <View style={styles.cameraContainer}>
            {!canUseCamera ? (
              <View style={[styles.camera, styles.permissionPlaceholder, { backgroundColor: colors.backgroundTertiary }]}>
                <Text style={[styles.permissionText, { color: colors.text }]}>
                  {isRequestingPermission ? 'Requesting camera permission...' : 'Camera permission required'}
                </Text>
                {!isRequestingPermission && !permission?.granted && (
                  <Pressable
                    style={[styles.permissionButton, { backgroundColor: colors.primary }]}
                    onPress={() => {
                      setIsRequestingPermission(true);
                      requestPermission().then((result) => {
                        setIsRequestingPermission(false);
                        if (!result.granted) {
                          console.warn('[LivenessTest] Camera permission denied');
                        }
                      }).catch((error) => {
                        console.error('[LivenessTest] Error requesting camera permission:', error);
                        setIsRequestingPermission(false);
                      });
                    }}
                  >
                    <Text style={styles.permissionButtonText}>Grant Permission</Text>
                  </Pressable>
                )}
              </View>
            ) : capturedImage ? (
              <Image source={{ uri: capturedImage }} style={styles.camera} resizeMode="cover" />
            ) : (
              <CameraView
                ref={cameraRef}
                style={styles.camera}
                facing="front"
              />
            )}
          </View>
        </View>

        {/* Circular Progress Ring */}
        {!capturedImage && canUseCamera && (
          <View style={styles.progressRingWrapper}>
            <Svg width={300} height={300}>
              <Circle 
                cx="150" 
                cy="150" 
                r="140" 
                stroke="rgba(255,255,255,0.2)" 
                strokeWidth="12" 
                fill="none" 
              />
              <AnimatedCircle
                cx="150"
                cy="150"
                r="140"
                stroke={colors.primary}
                strokeWidth="12"
                fill="none"
                strokeDasharray={2 * Math.PI * 140}
                animatedProps={animatedProps}
                strokeLinecap="round"
              />
            </Svg>
          </View>
        )}

        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.primary }]}>Liveness Test</Text>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <X size={24} color={colors.text} />
          </Pressable>
        </View>

        {/* Instructions */}
        <View style={styles.instructions}>
          <Text style={[styles.instructionText, { color: colors.text }]}>
            {getInstructionText()}
          </Text>
        </View>

        {/* Hold Button */}
        {!capturedImage && canUseCamera && (
          <View style={styles.holdButtonContainer}>
            <Pressable
              style={[
                styles.holdButton,
                { backgroundColor: isHolding ? colors.accent : colors.primary},
                isHolding && styles.holdButtonActive
              ]}
              onPressIn={handleHoldStart}
              onPressOut={handleHoldEnd}
              disabled={isHolding && !capturedImage}
            >
              <Text style={[
                styles.holdButtonText,
                { color: isHolding ? colors.primary : '#FFFFFF' }
              ]}>
                {isHolding ? 'Keep Holding...' : 'Press & Hold to Capture'}
              </Text>
            </Pressable>
          </View>
        )}

        {/* Submit Button */}
        {capturedImage && !uploadComplete && (
          <Pressable
            style={[styles.submitButton, { backgroundColor: colors.primary }]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            <Text style={styles.submitText}>
              {isSubmitting ? "Confirming..." : "Continue"}
            </Text>
          </Pressable>
        )}
        
        {/* Success State */}
        {uploadComplete && (
          <View style={styles.successContainer}>
            <Text style={[styles.successText, { color: '#fff' }]}>
              ✓ Upload Complete
            </Text>
            <Text style={[styles.successSubtext, { color: colors.textSecondary }]}>
              Proceeding to BVN verification...
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  cameraWrapper: {
    position: "absolute",
    top: "20%",
    width: 300,
    height: 300,
    justifyContent: "center",
    alignItems: "center",
  },
  cameraContainer: {
    width: 280,
    height: 280,
    borderRadius: 140,
    overflow: "hidden",
    borderWidth: 4,
    borderColor: "rgba(255,255,255,0.3)",
  },
  camera: {
    width: 280,
    height: 280,
  },
  progressRingWrapper: {
    position: "absolute",
    top: "20%",
    width: 300,
    height: 300,
  },
  header: {
    position: "absolute",
    top: 60,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  instructions: {
    position: "absolute",
    bottom: 150,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: 20,
  },
  instructionText: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  stepText: {
    fontSize: 14,
    fontWeight: "500",
  },
  warningText: {
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 8,
  },
  holdButtonContainer: {
    position: "absolute",
    bottom: 50,
    left: 20,
    right: 20,
    alignItems: "center",
  },
  holdButton: {
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 260,
    borderWidth: 2,
    borderColor: "transparent",
  },
  holdButtonActive: {
    borderColor: colors.primary,
    transform: [{ scale: 1.05 }],
  },
  holdButtonText: {
    fontSize: 17,
    fontWeight: "600",
  },
  submitButton: {
    position: "absolute",
    bottom: 50,
    left: 20,
    right: 20,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: "center",
  },
  submitText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: "600",
  },
  permissionPlaceholder: {
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  permissionText: {
    fontSize: 16,
    fontWeight: "500",
    textAlign: "center",
    marginBottom: 16,
  },
  permissionButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: "center",
  },
  permissionButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
  successContainer: {
    position: "absolute",
    bottom: 50,
    left: 20,
    right: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
  },
  successText: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  successSubtext: {
    fontSize: 14,
    fontWeight: "500",
  },
});