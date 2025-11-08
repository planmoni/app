import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  useWindowDimensions,
  Modal,
  Pressable,
  Image,
  Platform,
} from "react-native";
import {
  Camera as VisionCamera,
  useCameraDevice,
  useCameraPermission,
} from "react-native-vision-camera";
import {
  Camera,
  Face,
  FaceDetectionOptions,
} from "react-native-vision-camera-face-detector";
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

const detections = {
  BLINK: { minProbability: 0.25 }, // Eyes closed probability threshold (more sensitive)
  NOD: { minDiff: 8 }, // Minimum pitch change for nod (lower = more responsive)
  TURN_HEAD_LEFT: { maxAngle: -10 }, // Negative yaw = turning left
  TURN_HEAD_RIGHT: { minAngle: 10 }, // Positive yaw = turning right
  SMILE: { minProbability: 0.5 }, // Minimum smile probability (more sensitive)
};

export default function LivenessTestEnhanced({
  isVisible,
  onClose,
  onComplete,
}: LivenessTestEnhancedProps) {
  console.log('[LivenessTest] Component rendered, isVisible:', isVisible);
  const { hasPermission } = useCameraPermission();
  const { width } = useWindowDimensions();
  const { colors, isDark } = useTheme();
  const { session } = useAuth();
  
  console.log('[LivenessTest] Permissions check:', { hasPermission, hasSession: !!session });

  const [livenessStage, setLivenessStage] = useState<
    "setup" | "blink" | "nod" | "look_left" | "look_right" | "smile" | "photo_capture"
  >("setup");
  const [isTestActive, setIsTestActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const [positionValid, setPositionValid] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [faceTooClose, setFaceTooClose] = useState(false);

  const progressValue = useSharedValue(0);
  const pitchAngles = useRef<number[]>([]);
  const nodBaseline = useRef<number | null>(null);
  const device = useCameraDevice("front");
  const cameraRef = useRef<VisionCamera>(null);
  const setupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  console.log('[LivenessTest] Camera device:', { hasDevice: !!device, deviceId: device?.id });

  const detectionSteps = ["BLINK", "NOD", "TURN_HEAD_LEFT", "TURN_HEAD_RIGHT", "SMILE"];

  // Reset all state when modal closes or opens
  const resetState = useCallback(() => {
    setLivenessStage("setup");
    setIsTestActive(false);
    setCurrentStepIndex(0);
    setIsHolding(false);
    setPositionValid(false);
    setCapturedImage(null);
    setFaceTooClose(false);
    progressValue.value = 0;
    pitchAngles.current = [];
    nodBaseline.current = null;
    
    // Clear any pending timers
    if (setupTimerRef.current) {
      clearTimeout(setupTimerRef.current);
      setupTimerRef.current = null;
    }
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, [progressValue]);

  // Animated props for progress ring
  const animatedProps = useAnimatedProps(() => {
    'worklet';
    const progress = progressValue.value;
    const circumference = 2 * Math.PI * 130;
    const offset = circumference - (progress / 100) * circumference;
    return { strokeDashoffset: offset };
  });

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
      if (setupTimerRef.current) clearTimeout(setupTimerRef.current);
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    };
  }, []);

  const startLivenessTest = useCallback(() => {
    console.log('[LivenessTest] Starting liveness test');
    if (setupTimerRef.current) {
      clearTimeout(setupTimerRef.current);
      setupTimerRef.current = null;
    }
    setIsTestActive(true);
    setLivenessStage("blink");
    setCurrentStepIndex(0);
    setPositionValid(false);
    progressValue.value = withTiming(20, { duration: 300 });
    console.log('[LivenessTest] Test started, stage: blink');
  }, [progressValue]);

  const capturePhoto = async () => {
    console.log('[LivenessTest] capturePhoto called');
    try {
      if (!cameraRef.current) {
        console.error('[LivenessTest] Camera ref is null, cannot capture photo');
        return;
      }
      console.log('[LivenessTest] Taking photo...');
      const photo = await cameraRef.current.takePhoto({ 
        flash: "off", 
        enableShutterSound: false 
      });
      console.log('[LivenessTest] Photo captured:', photo.path);
      const imageUri = photo.path.startsWith('file://') ? photo.path : `file://${photo.path}`;
      setCapturedImage(imageUri);
      console.log('[LivenessTest] Image URI set:', imageUri);
    } catch (error) {
      console.error('[LivenessTest] Error capturing photo:', error);
    }
  };

  const nextStep = useCallback(() => {
    console.log('[LivenessTest] nextStep called, current stage:', livenessStage, 'current index:', currentStepIndex);
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    
    const nextIndex = currentStepIndex + 1;
    const newProgress = ((nextIndex + 1) / detectionSteps.length) * 100;

    // Reset detection-specific state
    setPositionValid(false);
    pitchAngles.current = [];
    nodBaseline.current = null;

    switch (livenessStage) {
      case "blink":
        console.log('[LivenessTest] Moving from blink to nod');
        setLivenessStage("nod");
        setCurrentStepIndex(nextIndex);
        progressValue.value = withTiming(newProgress, { duration: 300 });
        break;
      case "nod":
        console.log('[LivenessTest] Moving from nod to look_left');
        setLivenessStage("look_left");
        setCurrentStepIndex(nextIndex);
        progressValue.value = withTiming(newProgress, { duration: 300 });
        break;
      case "look_left":
        console.log('[LivenessTest] Moving from look_left to look_right');
        setLivenessStage("look_right");
        setCurrentStepIndex(nextIndex);
        progressValue.value = withTiming(newProgress, { duration: 300 });
        break;
      case "look_right":
        console.log('[LivenessTest] Moving from look_right to smile');
        setLivenessStage("smile");
        setCurrentStepIndex(nextIndex);
        progressValue.value = withTiming(newProgress, { duration: 300 });
        break;
      case "smile":
        console.log('[LivenessTest] Moving from smile to photo_capture');
        setLivenessStage("photo_capture");
        progressValue.value = withTiming(100, { duration: 300 });
        console.log('[LivenessTest] Scheduling photo capture in 1000ms');
        setTimeout(() => {
          console.log('[LivenessTest] Executing scheduled photo capture');
          capturePhoto();
        }, 1000);
        break;
    }
  }, [livenessStage, currentStepIndex, detectionSteps.length, progressValue]);

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

      // Call the onComplete callback with the storage URL
      if (onComplete && storageUrl) {
        console.log('[LivenessTest] Calling onComplete callback with URL:', storageUrl);
        onComplete(storageUrl);
      } else {
        console.log('[LivenessTest] No onComplete callback or storageUrl');
      }

      setTimeout(() => {
        console.log('[LivenessTest] Closing modal after submission');
        setIsSubmitting(false);
        onClose();
      }, 1000);
    } catch (error) {
      console.error('[LivenessTest] Error uploading liveness photo:', error);
      setIsSubmitting(false);
      setTimeout(() => {
        onClose();
      }, 1000);
    }
  };

  const getInstructionText = () => {
    switch (livenessStage) {
      case "setup": return "Position your face in the circle to start";
      case "blink": return "Blink your eyes a few times";
      case "nod": return "Nod your head up and down";
      case "look_right": return "Turn your head right";
      case "look_left": return "Turn your head left";
      case "smile": return "Smile at the camera";
      case "photo_capture": return "Photo captured! Submit to complete";
      default: return "Position your face in the circle";
    }
  };

  const getWarningText = () => {
    if (faceTooClose) return "Please move the phone away from your face";
    return null;
  };

  const handleFacesDetection = useCallback((faces: Face[]) => {
    try {
      if (!faces || faces.length === 0) {
        return;
      }

      const face = faces[0];
      // Log face detection periodically (every 30 frames to avoid spam)
      if (Math.random() < 0.033) {
        console.log('[LivenessTest] Face detected:', {
          stage: livenessStage,
          isTestActive,
          isHolding,
          faceArea: face.bounds.width * face.bounds.height,
          yaw: face.yawAngle,
          pitch: face.pitchAngle,
          smiling: face.smilingProbability
        });
      }
      
      // Check if face is too close (face area is too large)
      const faceArea = face.bounds.width * face.bounds.height;
      const maxFaceArea = Platform.OS === 'ios' ? 800000 : 80000;
      
      if (faceArea > maxFaceArea) {
        setFaceTooClose(true);
        return;
      } else {
        setFaceTooClose(false);
      }

      // Setup stage: Start test when face is detected with good quality
      if (livenessStage === "setup" && !isTestActive) {
        const hasGoodQuality = faceArea > 10000;
        console.log('[LivenessTest] Setup stage - face quality check:', { 
          faceArea, 
          hasGoodQuality, 
          hasTimer: !!setupTimerRef.current 
        });
        if (hasGoodQuality && !setupTimerRef.current) {
          console.log('[LivenessTest] Starting setup timer (500ms)');
          setupTimerRef.current = setTimeout(() => {
            startLivenessTest();
          }, 500); // Faster start (500ms instead of 800ms)
        }
        return;
      }

      // Skip detection if holding (between stages) or test not active
      if (!isTestActive || isHolding) {
        return;
      }

      let currentPositionValid = false;

      switch (livenessStage) {
        case "blink":
          // Check if both eyes are closed (low probability = eyes closed)
          const leftEyeClosed = (face.leftEyeOpenProbability || 1) <= detections.BLINK.minProbability;
          const rightEyeClosed = (face.rightEyeOpenProbability || 1) <= detections.BLINK.minProbability;
          currentPositionValid = leftEyeClosed && rightEyeClosed;
          break;

        case "nod":
          const currentPitch = face.pitchAngle || 0;
          
          // Initialize baseline if not set
          if (nodBaseline.current === null) {
            nodBaseline.current = currentPitch;
            pitchAngles.current = [currentPitch];
          } else {
            pitchAngles.current.push(currentPitch);
            // Keep only last 6 samples for faster detection
            if (pitchAngles.current.length > 6) {
              pitchAngles.current.shift();
            }

            // Need at least 2 samples to detect nod (faster response)
            if (pitchAngles.current.length >= 2) {
              const minPitch = Math.min(...pitchAngles.current);
              const maxPitch = Math.max(...pitchAngles.current);
              
              // Detect upward nod (positive pitch change from baseline or minimum)
              const pitchFromBaseline = currentPitch - nodBaseline.current;
              const pitchFromMin = currentPitch - minPitch;
              
              // Valid nod: upward movement detected (more lenient)
              currentPositionValid = pitchFromBaseline >= detections.NOD.minDiff || 
                                    pitchFromMin >= detections.NOD.minDiff;
            }
          }
          break;

        case "look_left":
          // Negative yaw angle means turning left (from camera's perspective)
          currentPositionValid = (face.yawAngle || 0) <= detections.TURN_HEAD_LEFT.maxAngle;
          break;

        case "look_right":
          // Positive yaw angle means turning right (from camera's perspective)
          currentPositionValid = (face.yawAngle || 0) >= detections.TURN_HEAD_RIGHT.minAngle;
          break;

        case "smile":
          // Check smile probability
          currentPositionValid = (face.smilingProbability || 0) >= detections.SMILE.minProbability;
          break;

        default:
          currentPositionValid = false;
      }

      // Update position validity and trigger next step if valid
      if (currentPositionValid !== positionValid) {
        console.log('[LivenessTest] Position validity changed:', {
          stage: livenessStage,
          wasValid: positionValid,
          nowValid: currentPositionValid
        });
        setPositionValid(currentPositionValid);
        
        if (currentPositionValid) {
          console.log('[LivenessTest] Position valid, starting hold timer (1200ms)');
          setIsHolding(true);
          holdTimerRef.current = setTimeout(() => {
            console.log('[LivenessTest] Hold timer expired, calling nextStep');
            nextStep();
            setIsHolding(false);
            holdTimerRef.current = null;
          }, 1200); // Hold for 1.2 seconds before moving to next step (faster)
        }
      }
    } catch (error) {
      console.error("Face detection error:", error);
    }
  }, [livenessStage, isTestActive, isHolding, positionValid, startLivenessTest, nextStep]);

  const faceDetectionOptions = useRef<FaceDetectionOptions>({
    performanceMode: "accurate",
    landmarkMode: "all",
    classificationMode: "all",
    trackingEnabled: true,
  }).current;

  if (!isVisible || !hasPermission || !device) {
    console.log('[LivenessTest] Component not rendering:', {
      isVisible,
      hasPermission,
      hasDevice: !!device
    });
    return null;
  }
  
  console.log('[LivenessTest] Rendering component, stage:', livenessStage);

  return (
    <Modal visible={isVisible} animationType="slide" presentationStyle="fullScreen">
      <View style={[styles.container, { backgroundColor: colors.backgroundSecondary }]}>
        {/* Camera */}
        <View style={styles.cameraWrapper}>
          <View style={styles.cameraContainer}>
            {livenessStage === "photo_capture" && capturedImage ? (
              <Image source={{ uri: capturedImage }} style={styles.camera} resizeMode="cover" />
            ) : (
              <Camera
                ref={cameraRef}
                style={styles.camera}
                device={device}
                isActive={isVisible}
                photo={true}
                faceDetectionCallback={handleFacesDetection}
                faceDetectionOptions={faceDetectionOptions}
              />
            )}
          </View>
        </View>

        {/* Circular Progress Ring */}
        {livenessStage !== "photo_capture" && (
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
          <Text style={[styles.title, { color: colors.text }]}>Liveness Test</Text>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <X size={24} color={colors.text} />
          </Pressable>
        </View>

        {/* Instructions */}
        <View style={styles.instructions}>
          <Text style={[styles.instructionText, { color: colors.text }]}>
            {getInstructionText()}
          </Text>
          {isTestActive && (
            <Text style={[styles.stepText, { color: colors.textSecondary }]}>
              Step {currentStepIndex + 1} of {detectionSteps.length}
            </Text>
          )}
          {getWarningText() && (
            <Text style={[styles.warningText, { color: '#FF6B6B' }]}>
              {getWarningText()}
            </Text>
          )}
        </View>

        {/* Submit Button */}
        {livenessStage === "photo_capture" && capturedImage && (
          <Pressable
            style={[styles.submitButton, { backgroundColor: colors.primary }]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            <Text style={styles.submitText}>
              {isSubmitting ? "Uploading..." : "Continue"}
            </Text>
          </Pressable>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    fontSize: 18,
    fontWeight: "600",
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
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
