import React, { useEffect, useState, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  useWindowDimensions,
  Modal,
  Pressable,
  Image,
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
import { useCameraPermissions } from "expo-camera";
import { X, RotateCcw } from "lucide-react-native";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Text as SvgText } from "react-native-svg";
import { useTheme } from "@/contexts/ThemeContext";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useKYCData } from "@/hooks/useKYCData";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface LivenessTestEnhancedProps {
  isVisible: boolean;
  onClose: () => void;
  onComplete?: (capturedImage: string) => void;
}

const detections = {
  BLINK: { minProbability: 0.1 },
  NOD: { minDiff: 15 },
  TURN_HEAD_LEFT: { maxAngle: -15 },
  TURN_HEAD_RIGHT: { minAngle: 15 },
  SMILE: { minProbability: 0.7 },
};

export default function LivenessTestEnhanced({
  isVisible,
  onClose,
  onComplete,
}: LivenessTestEnhancedProps) {
  const { hasPermission } = useCameraPermission();
  const { width } = useWindowDimensions();
  const { colors, isDark } = useTheme();
  const { session } = useAuth();
  const { saveFormData } = useKYCData();

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
  const device = useCameraDevice("front");
  const cameraRef = useRef<VisionCamera>(null);

  const detectionSteps = ["BLINK", "NOD", "TURN_HEAD_LEFT", "TURN_HEAD_RIGHT", "SMILE"];

  // FIXED: Use worklet and read from shared value only
  const animatedProps = useAnimatedProps(() => {
    'worklet';
    const progress = progressValue.value;
    const circumference = 2 * Math.PI * 130;
    const offset = circumference - (progress / 100) * circumference;
    return { strokeDashoffset: offset };
  });

  useEffect(() => {
    if (isVisible) {
      setLivenessStage("setup");
      setIsTestActive(false);
      setCapturedImage(null);
      setCurrentStepIndex(0);
      setFaceTooClose(false);
      progressValue.value = 0;
    } else {
      progressValue.value = 0;
    }
  }, [isVisible]);

  const startLivenessTest = () => {
    setIsTestActive(true);
    setLivenessStage("blink");
    setCurrentStepIndex(0);
    progressValue.value = withTiming(20, { duration: 300 });
  };

  const nextStep = () => {
    const nextIndex = currentStepIndex + 1;
    const newProgress = ((nextIndex + 1) / detectionSteps.length) * 100;

    switch (livenessStage) {
      case "blink":
        setLivenessStage("nod");
        setCurrentStepIndex(nextIndex);
        progressValue.value = withTiming(newProgress, { duration: 300 });
        break;
      case "nod":
        setLivenessStage("look_left");
        setCurrentStepIndex(nextIndex);
        progressValue.value = withTiming(newProgress, { duration: 300 });
        break;
      case "look_left":
        setLivenessStage("look_right");
        setCurrentStepIndex(nextIndex);
        progressValue.value = withTiming(newProgress, { duration: 300 });
        break;
      case "look_right":
        setLivenessStage("smile");
        setCurrentStepIndex(nextIndex);
        progressValue.value = withTiming(newProgress, { duration: 300 });
        break;
      case "smile":
        setLivenessStage("photo_capture");
        progressValue.value = withTiming(100, { duration: 300 });
        setTimeout(() => capturePhoto(), 1000);
        break;
    }
  };

  const capturePhoto = async () => {
    if (cameraRef.current) {
      const photo = await cameraRef.current.takePhoto({ flash: "off", enableShutterSound: false });
      const imageUri = photo.path.startsWith('file://') ? photo.path : `file://${photo.path}`;
      setCapturedImage(imageUri);
    }
  };

  const handleSubmit = async () => {
    if (!capturedImage || !session?.user?.id) {
      console.error('Missing image or user session');
      return;
    }

    setIsSubmitting(true);

    try {
      // Upload captured image to Supabase storage
      const fileExtension = capturedImage.split('.').pop() || 'jpg';
      const fileName = `liveness-photo-${Date.now()}.${fileExtension}`;
      const filePath = `kyc-documents/${session.user.id}/${fileName}`;

      // Upload file directly (React Native file format for Supabase)
      const file = {
        uri: capturedImage,
        name: fileName,
        type: 'image/jpeg'
      } as any;

      // Upload to Supabase storage
      const { data: uploadData, error: uploadError } = await supabase.storage
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
      console.log('Image uploaded successfully:', storageUrl);

      // Fetch user profile data
      console.log('Fetching user profile for user ID:', session.user.id);
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
      } else {
        console.log('Profile data retrieved:', profileData);
      }

      // Create new kyc_data record with user info from profiles and selfie URL
      const kycDataRecord = {
        user_id: session.user.id,
        first_name: profileData?.first_name || '',
        last_name: profileData?.last_name || '',
        selfie_url: storageUrl,
      };

      console.log('KYC data to save:', kycDataRecord);
      console.log('Full profile data:', profileData);

      // Check if record already exists
      const { data: existingRecord } = await supabase
        .from('kyc_data')
        .select('id')
        .eq('user_id', session.user.id)
        .single();

      let savedResult;

      if (existingRecord) {
        // Update existing record
        console.log('Updating existing kyc_data record');
        const { error: updateError } = await supabase
          .from('kyc_data')
          .update({ selfie_url: storageUrl })
          .eq('user_id', session.user.id);
        
        if (updateError) {
          console.error('Update error:', updateError);
          savedResult = false;
        } else {
          console.log('Successfully updated kyc_data record');
          savedResult = true;
        }
      } else {
        // Insert new record
        console.log('Creating new kyc_data record');
        const { error: insertError } = await supabase
          .from('kyc_data')
          .insert(kycDataRecord);
        
        if (insertError) {
          console.error('Insert error:', insertError);
          savedResult = false;
        } else {
          console.log('Successfully created new kyc_data record');
          savedResult = true;
        }
      }

      // Call the onComplete callback with the storage URL
      if (onComplete && storageUrl) onComplete(storageUrl);

      setTimeout(() => {
        setIsSubmitting(false);
        onClose();
      }, 1000);
    } catch (error) {
      console.error('Error uploading liveness photo:', error);
      setIsSubmitting(false);
      // Still close the modal but log the error
      setTimeout(() => {
        onClose();
      }, 1000);
    }
  };

  const getInstructionText = () => {
    switch (livenessStage) {
      case "setup": return "Position your face in the circle to start";
      case "blink": return "Blink your eyes";
      case "nod": return "Nod your head";
      case "look_left": return "Turn your head left";
      case "look_right": return "Turn your head right";
      case "smile": return "Smile at the camera";
      case "photo_capture": return "Photo captured! Submit to complete";
      default: return "Position your face in the circle";
    }
  };

  const getWarningText = () => {
    if (faceTooClose) return "Please move the phone away from your face";
    return null;
  };

  const handleFacesDetection = (faces: Face[]) => {
    try {
      // Check if face is too close (face area is too large)
      if (faces?.length > 0) {
        const face = faces[0];
        const faceArea = face.bounds.width * face.bounds.height;
        const maxFaceArea = 80000; // Threshold for face being too close
        
        setFaceTooClose(faceArea > maxFaceArea);
        
        // Prevent progression if face is too close
        if (faceArea > maxFaceArea) {
          return;
        }
      }

      if (faces?.length > 0 && livenessStage === "setup" && !isTestActive) {
        const hasGoodQuality = faces[0].bounds.width * faces[0].bounds.height > 10000;
        if (hasGoodQuality) {
          setTimeout(startLivenessTest, 1500);
        }
      }

      if (isTestActive && !isHolding && faces?.length > 0) {
        const face = faces[0];
        let currentPositionValid = false;

        switch (livenessStage) {
          case "blink":
            currentPositionValid = 
              (face.leftEyeOpenProbability || 1) <= detections.BLINK.minProbability &&
              (face.rightEyeOpenProbability || 1) <= detections.BLINK.minProbability;
            break;
          case "nod":
            pitchAngles.current.push(face.pitchAngle || 0);
            if (pitchAngles.current.length > 10) pitchAngles.current.shift();
            if (pitchAngles.current.length >= 10) {
              const baselineAngle = pitchAngles.current[0];
              const currentAngle = face.pitchAngle || 0;
              // Head going up = positive pitch change (looking upwards)
              const pitchChange = currentAngle - baselineAngle;
              currentPositionValid = pitchChange >= detections.NOD.minDiff;
            }
            break;
          case "look_left":
            currentPositionValid = (face.yawAngle || 0) >= 15;
            break;
          case "look_right":
            currentPositionValid = (face.yawAngle || 0) <= -15;
            break;
          case "smile":
            currentPositionValid = (face.smilingProbability || 0) >= detections.SMILE.minProbability;
            break;
        }

        if (currentPositionValid !== positionValid) {
          setPositionValid(currentPositionValid);
          if (currentPositionValid) {
            setIsHolding(true);
            setTimeout(() => {
              nextStep();
              setIsHolding(false);
            }, 2500);
          }
        }
      }
    } catch (error) {
      console.error("Face detection error:", error);
    }
  };

  const faceDetectionOptions = useRef<FaceDetectionOptions>({
    performanceMode: "accurate",
    landmarkMode: "all",
    classificationMode: "all",
    trackingEnabled: true,
  }).current;

  if (!isVisible || !hasPermission || !device) return null;

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

        {/* Circular Progress Ring - Hide when photo is captured */}
        {livenessStage !== "photo_capture" && (
          <View style={styles.progressRingWrapper}>
            <Svg width={300} height={300}>
              <Circle cx="150" cy="150" r="140" stroke="rgba(255,255,255,0.2)" strokeWidth="12" fill="none" />
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
              {isTestActive && (
                <SvgText x="150" y="165" fill={colors.text} fontSize="28" fontWeight="bold" textAnchor="middle">
                  {Math.round(progressValue.value)}%
                </SvgText>
              )}
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
          <Text style={[styles.instructionText, { color: colors.text }]}>{getInstructionText()}</Text>
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
            <Text style={styles.submitText}>{isSubmitting ? "Uploading..." : "Submit"}</Text>
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
  photoText: {
    fontSize: 16,
    textAlign: "center",
    marginTop: 120,
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
