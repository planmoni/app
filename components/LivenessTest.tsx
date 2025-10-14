import React, {useEffect, useState, useRef} from "react"
import {StyleSheet, View, Text, useWindowDimensions, Modal, Pressable, StatusBar, Image } from "react-native"
import {Camera as VisionCamera, useCameraDevice, useCameraPermission } from "react-native-vision-camera"
import {Camera, Face, FaceDetectionOptions} from 'react-native-vision-camera-face-detector';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { X } from 'lucide-react-native';
import * as Speech from 'expo-speech';
import { useTheme } from '@/contexts/ThemeContext';

interface LivenessTestProps {
  isVisible: boolean;
  onClose: () => void;
  onComplete?: (capturedImage: string) => void;
}

export default function LivenessTest({ isVisible, onClose, onComplete }: LivenessTestProps) {
  // Liveness test component with onComplete callback support
  const {hasPermission} = useCameraPermission()
  const {width, height} = useWindowDimensions();
  const { colors, isDark } = useTheme();
  const [currentState, setCurrentState] = useState<'no-face' | 'face-in-circle' | 'face-out-circle' | 'smiling'>('no-face');
  const [livenessStage, setLivenessStage] = useState<'setup' | 'look_straight' | 'look_left' | 'look_right' | 'smile' | 'photo_capture' | 'done'>('setup');
  const [isTestActive, setIsTestActive] = useState(false);
  const [holdTimer, setHoldTimer] = useState<number | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isHolding, setIsHolding] = useState(false);
  const [positionValid, setPositionValid] = useState(false);
  const [hasSpokenInstruction, setHasSpokenInstruction] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [lastSpeechTime, setLastSpeechTime] = useState<number>(0);
  const [currentInstruction, setCurrentInstruction] = useState<string>('');
  const [hasSpokenCurrentInstruction, setHasSpokenCurrentInstruction] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const device = useCameraDevice('front');
  const isMountedRef = useRef(true);
  const cameraRef = useRef<VisionCamera>(null);
  const [expoPermission, requestExpoPermission] = useCameraPermissions();
  const expoCameraRef = useRef<CameraView>(null);
  const hasSpokenGoodRef = useRef(false);

  useEffect(() => {
    (async () => {
      const status = await VisionCamera.requestCameraPermission();
      // Also request Expo camera permissions
      if (!expoPermission?.granted) {
        await requestExpoPermission();
      }
    })();
  }, [device, expoPermission, requestExpoPermission]);

 
  useEffect(() => {
    if (isVisible) {
      
      StatusBar.setBarStyle('light-content', true);
      StatusBar.setBackgroundColor('#000000', true);
      
     
      setCurrentState('no-face');
      setLivenessStage('setup');
      setIsTestActive(false);
      setHoldTimer(null);
      setCapturedImage(null);
      setIsHolding(false);
      setPositionValid(false);
      setHasSpokenInstruction(false);
      setIsSpeaking(false);
      setLastSpeechTime(0);
      setCurrentInstruction('');
      setHasSpokenCurrentInstruction(false);
      setIsSubmitting(false);
      hasSpokenGoodRef.current = false;
      
      setTimeout(() => {
        speakInstruction("Position your face in the circle area to start your liveness test", true);
      }, 1500); 
    } else {
     
      StatusBar.setBarStyle('default', true);
      
     
      Speech.stop();
      
     
      setIsSpeaking(false);
      setLastSpeechTime(0);
      setCurrentInstruction('');
      setHasSpokenCurrentInstruction(false);
      setIsSubmitting(false);
      hasSpokenGoodRef.current = false;
      
     
      setIsTestActive(false);
      setIsHolding(false);
      setPositionValid(false);
      setHasSpokenInstruction(false);
      setCurrentState('no-face');
      setLivenessStage('setup');
      setCapturedImage(null);
      setHoldTimer(null);
      
      
      setTimeout(() => {
        Speech.stop();
      }, 200);
    }
  }, [isVisible]);

  
  const handleClose = () => {
    Speech.stop();
    
    
    setIsSpeaking(false);
    setLastSpeechTime(0);
    setCurrentInstruction('');
    setHasSpokenCurrentInstruction(false);
    hasSpokenGoodRef.current = false;
    
    
    setIsTestActive(false);
    setIsHolding(false);
    setPositionValid(false);
    setHasSpokenInstruction(false);
    setCurrentState('no-face');
    setLivenessStage('setup');
    setCapturedImage(null);
    setHoldTimer(null);
    
    
    onClose();
  };

  
  useEffect(() => {
    return () => {
     
      Speech.stop();
    };
  }, []);

  const speakInstruction = (text: string, force: boolean = false) => {
    const now = Date.now();
    
    
    if (text === currentInstruction && hasSpokenCurrentInstruction && !force) {
      return;
    }
    
    // If we're already speaking the same text, don't start again
    if (isSpeaking && text === currentInstruction && !force) {
      return;
    }
    
   
    if (force || now - lastSpeechTime >= 2500) {
      setLastSpeechTime(now);
      setCurrentInstruction(text);
      setHasSpokenCurrentInstruction(true);
      setIsSpeaking(true);
      
      Speech.speak(text, {
        language: 'en',
        pitch: 1.0,
        rate: 0.8,
        onDone: () => {
          setIsSpeaking(false);
        },
        onStopped: () => {
          setIsSpeaking(false);
        },
        onError: () => {
          setIsSpeaking(false);
        }
      });
    }
  };

  const startLivenessTest = () => {
    setIsTestActive(true);
    setLivenessStage('look_left');
    setHasSpokenInstruction(false);
    speakInstruction("Look left", true);
    setHasSpokenInstruction(true);
  };

  const handlePositionGood = () => {
    if (isHolding || hasSpokenGoodRef.current) return; 
    
    setIsHolding(true);
    setPositionValid(false);
    hasSpokenGoodRef.current = true; // Mark that we've spoken "Good" for this position
    
  
    setTimeout(() => {
      speakInstruction("Good", true); // Force the "Good" message
      
     
      setTimeout(() => {
        nextStep();
        setIsHolding(false);
        hasSpokenGoodRef.current = false; // Reset for next position
      }, 1000);
    }, 2500);
  };

  const nextStep = () => {
    switch (livenessStage) {
      case 'look_left':
        setLivenessStage('smile');
        setHasSpokenInstruction(false);
        setHasSpokenCurrentInstruction(false);
        speakInstruction("Look straight and smile for the camera", true);
        setHasSpokenInstruction(true);
        break;
      case 'smile':
          setLivenessStage('look_right');
        setHasSpokenInstruction(false);
        setHasSpokenCurrentInstruction(false);
        speakInstruction("Look right", true);
        setHasSpokenInstruction(true);
        break;
      case 'look_right':
        setLivenessStage('look_straight');
        setHasSpokenInstruction(false);
        setHasSpokenCurrentInstruction(false);
        speakInstruction("Look straight at the camera", true);
        setHasSpokenInstruction(true);
        break;
      case 'look_straight':
        console.log('Switching to photo capture stage');
        setLivenessStage('photo_capture');
        // Add a small delay to ensure the Expo camera is ready
        setTimeout(() => {
          console.log('Attempting to capture photo');
          capturePhoto();
        }, 1000);
        break;
      default:
        break;
    }
  };

  const capturePhoto = async () => {
    try {
      console.log('capturePhoto called - expoCameraRef:', !!expoCameraRef.current, 'expoPermission:', expoPermission?.granted);
      
      if (expoCameraRef.current && expoPermission?.granted) {
        console.log('Taking picture with Expo camera...');
        const photo = await expoCameraRef.current.takePictureAsync({
          quality: 0.8,
          base64: false,
          skipProcessing: false,
        });
        console.log('Photo captured successfully:', photo.uri);
        setCapturedImage(photo.uri);
        // Don't set stage here - it's already set in nextStep()
        speakInstruction("Photo captured successfully", true);
      } else {
        console.error('Expo camera not ready or no permission - expoCameraRef:', !!expoCameraRef.current, 'expoPermission:', expoPermission?.granted);
        speakInstruction("Camera not ready for photo capture", true);
      }
    } catch (error) {
      console.error('Photo capture failed:', error);
      speakInstruction("Photo capture not successfully", true);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    speakInstruction("Submitting liveness test", true);
    
    // If we have a captured image and onComplete callback, call it
    if (capturedImage && onComplete) {
      onComplete(capturedImage);
    }
   
    setTimeout(() => {
      setIsSubmitting(false);
      
      
      setTimeout(() => {
        handleClose();
      }, 1000);
    }, 3000);
  };

  const getInstructionText = () => {
    switch (livenessStage) {
      case 'setup':
        return 'Position your face in the circle area to start your liveness test';
      case 'look_left':
        return 'Look left';
      case 'smile':
        return 'Look straight and smile for the camera';
      case 'look_right':
        return 'Look right';
      case 'look_straight':
        return 'Look straight at the camera';
      case 'photo_capture':
        return 'Photo captured! Review and submit';
      default:
        return 'Position your face in the circle area';
    }
  };

  const getCurrentStepNumber = () => {
    switch (livenessStage) {
      case 'look_left':
        return 1;
      case 'smile':
        return 2;
      case 'look_right':
        return 3;
      case 'look_straight':
        return 4;
      default:
        return 0;
    }
  };

  const getInstructionImage = () => {
    switch (livenessStage) {
      case 'look_left':
        return require('@/assets/liveness/Left.png');
      case 'smile':
        return require('@/assets/liveness/Smile.png');
      case 'look_right':
        return require('@/assets/liveness/Right.png');
      case 'look_straight':
        return require('@/assets/liveness/Straight.png');
      default:
        return require('@/assets/liveness/Left.png'); 
    }
  };

 
  const circleRadius = 120;
  const circleCenter = { x: width / 2, y: height / 2 - 50 };

  const isFaceInCircle = (face: Face) => {
    const faceCenterX = face.bounds.x + face.bounds.width / 2;
    const faceCenterY = face.bounds.y + face.bounds.height / 2;
    
    const distance = Math.sqrt(
      Math.pow(faceCenterX - circleCenter.x, 2) + 
      Math.pow(faceCenterY - circleCenter.y, 2)
    );
    
    return distance <= circleRadius;
  };


  const faceDetectionOptions = useRef<FaceDetectionOptions>({
    performanceMode: 'accurate',
    landmarkMode: 'all',
    contourMode: 'none',
    classificationMode: 'all',
    trackingEnabled: false,
    windowWidth: width,
    windowHeight: height,
    autoScale: true,
  }).current;

  const handleFacesDetection = (faces: Face[]) => {
    try {
      if (faces?.length > 0) {
        const face = faces[0];
        const faceInCircle = isFaceInCircle(face);
        const isSmiling = face.smilingProbability && face.smilingProbability > 0.7;
        const yaw = face.yawAngle > 15 ? "Right" : face.yawAngle < -15 ? "Left" : "Center";
        const pitch = face.pitchAngle > 15 ? "Up" : face.pitchAngle < -10 ? "Down" : "Center";
        
     
        let newState: 'no-face' | 'face-in-circle' | 'face-out-circle' | 'smiling';
        
        if (!faceInCircle) {
          newState = 'face-out-circle';
        } else if (isSmiling) {
          newState = 'smiling';
        } else {
          newState = 'face-in-circle';
        }
        
       
        if (faceInCircle && livenessStage === 'setup' && !isTestActive && !hasSpokenInstruction) {
          setHasSpokenInstruction(true);
          setCurrentInstruction("I can see your face");
          setHasSpokenCurrentInstruction(false);
          speakInstruction("I can see your face", true);
          setTimeout(() => {
            startLivenessTest();
          }, 1500);
        }
        
     
        if (isTestActive && faceInCircle && !isHolding) {
          let currentPositionValid = false;
          
          switch (livenessStage) {
            case 'look_left':
              currentPositionValid = (yaw === 'Right'); 
              break;
            case 'smile':
              currentPositionValid = (yaw === 'Center' && pitch === 'Center' && Boolean(isSmiling));
              break;
            case 'look_right':
              currentPositionValid = (yaw === 'Left'); 
              break;
            case 'look_straight':
              currentPositionValid = (yaw === 'Center' && pitch === 'Center');
              break;
          }
          
         
          if (currentPositionValid !== positionValid) {
            setPositionValid(currentPositionValid);
            
         
            if (currentPositionValid) {
              handlePositionGood();
            }
          }
        }
        
     
        if (newState !== currentState) {
          if (newState === 'face-out-circle' && (currentState === 'face-in-circle' || currentState === 'smiling')) {
            if (currentInstruction !== "Position your face in the camera" || !hasSpokenCurrentInstruction) {
              setCurrentInstruction("Position your face in the camera");
              setHasSpokenCurrentInstruction(false);
              speakInstruction("Position your face in the camera");
            }
          }
          setCurrentState(newState);
        }
    } else {
     
        if (currentState !== 'no-face') {
          if (currentInstruction !== "Position your face in the camera" || !hasSpokenCurrentInstruction) {
            setCurrentInstruction("Position your face in the camera");
            setHasSpokenCurrentInstruction(false);
            speakInstruction("Position your face in the camera");
          }
          setCurrentState('no-face');
        }
      }
    } catch (error) {
     
    }
  }

  if (!isVisible) return null;

  if (!hasPermission) {
    return (
      <Modal visible={isVisible} animationType="slide" presentationStyle="fullScreen" statusBarTranslucent={false}>
        <View style={[styles.modalContainer, { backgroundColor: colors.backgroundSecondary }]}>
          <Text style={[styles.errorText, { color: colors.text }]}>Camera permission is required to use this feature.</Text>
          <Pressable style={[styles.closeButton, { backgroundColor: colors.backgroundTertiary }]} onPress={handleClose}>
            <X size={24} color={colors.text} />
          </Pressable>
        </View>
      </Modal>
    );
  }

  if (device == null) {
    return (
      <Modal visible={isVisible} animationType="slide" presentationStyle="fullScreen" statusBarTranslucent={false}>
        <View style={[styles.modalContainer, { backgroundColor: colors.backgroundSecondary }]}>
          <Text style={[styles.errorText, { color: colors.text }]}>Camera device not found.</Text>
          <Pressable style={[styles.closeButton, { backgroundColor: colors.backgroundTertiary }]} onPress={handleClose}>
            <X size={24} color={colors.text} />
          </Pressable>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={isVisible} animationType="slide" presentationStyle="fullScreen" statusBarTranslucent={false}>
      <View style={[styles.modalContainer, { backgroundColor: colors.backgroundSecondary }]}>
      {/* Themed Background */}
        <View style={[styles.backgroundOverlay, { backgroundColor: colors.backgroundSecondary }]} />
      
      {/* Camera only in the circle area */}
        <View style={[styles.cameraContainer, { borderColor: colors.border }]}>
          {livenessStage === 'photo_capture' && capturedImage ? (
            <Image 
              source={{ uri: capturedImage }} 
              style={styles.camera}
              resizeMode="cover"
            />
          ) : livenessStage === 'photo_capture' ? (
            <CameraView
              ref={expoCameraRef}
              style={styles.camera}
              facing="front"
            />
          ) : (
            <Camera
              ref={cameraRef}
              style={styles.camera}
              device={device}
              isActive={isVisible}
              faceDetectionCallback={handleFacesDetection}
              faceDetectionOptions={faceDetectionOptions}
            />
          )}
      </View>

        {/* Overlay with camera circle and instructions */}
        <View style={styles.overlay}>
          {/* Top header with logo and close button */}
          <View style={styles.topOverlay}>
            <View style={styles.headerContent}>
              <View style={styles.logoContainer}>
                <Image 
                  source={isDark 
                    ? require('@/assets/images/PlanmoniDarkMode.png') 
                    : require('@/assets/images/Planmoni.png')
                  } 
                  style={styles.logo}
                  resizeMode="contain"
                />
                <Text style={[styles.logoText, { color: colors.text }]}>Liveness Test</Text>
              </View>
              <Pressable 
                style={[styles.closeButton, { backgroundColor: colors.backgroundTertiary }]}
                onPress={handleClose}
                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
              >
              <X size={24} color={colors.text} />
              </Pressable>
            </View>
          </View>

        {/* Center camera circle with crosshairs */}
          <View style={styles.centerOverlay}>
            <View style={[styles.cameraCircle, { borderColor: colors.border }]}>
            {/* Crosshairs for center alignment */}
            <View style={styles.crosshairs}>
                <View style={[styles.crosshairHorizontal, { backgroundColor: colors.text }]} />
                <View style={[styles.crosshairVertical, { backgroundColor: colors.text }]} />
                </View>
            </View>
          </View>

          {/* Green Ring when Face Found */}
          {(currentState === 'face-in-circle' || currentState === 'smiling') && (
            <View style={styles.greenRing} />
          )}

          {/* Bottom Instructions and Progress */}
          <View style={styles.bottomOverlay}>
            {livenessStage === 'photo_capture' && capturedImage ? (
              <View style={styles.photoPreviewContainer}>
                <Text style={[styles.photoPreviewText, { color: colors.text }]}>Photo captured successfully!</Text>
                <Pressable 
                  style={[
                    styles.submitButton, 
                    { 
                      backgroundColor: colors.primary,
                      opacity: isSubmitting ? 0.7 : 1
                    }
                  ]}
                  onPress={handleSubmit}
                  disabled={isSubmitting}
                >
                  <Text style={styles.submitButtonText}>
                    {isSubmitting ? 'Submitting...' : 'Submit'}
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.instructionsContainer}>
                {/* Liveness instruction image */}
                {isTestActive && livenessStage !== 'setup' && livenessStage !== 'photo_capture' && (
                  <Image 
                    source={getInstructionImage()}
                    style={styles.instructionImage}
                    resizeMode="contain"
                  />
                )}
                
                <Text style={[styles.instructionText, { color: colors.text }]}>
                  {getInstructionText()}
                </Text>
                {isTestActive && (
                  <View style={styles.progressContainer}>
                    <Text style={[styles.progressText, { color: colors.textSecondary }]}>
                      Step {getCurrentStepNumber()} of 4
                  </Text>
                    <View style={styles.progressBar}>
                      <View style={[styles.progressFill, { 
                        width: `${(getCurrentStepNumber() / 4) * 100}%`,
                        backgroundColor: colors.primary 
                      }]} />
                    </View>
                </View>
                )}
              </View>
            )}
          </View>

        </View>
    </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
  },
  backgroundOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  cameraContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 280,
    height: 280,
    marginTop: -140, 
    marginLeft: -140, 
    borderRadius: 140,
    overflow: 'hidden',
    borderWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  camera: {
    width: 280,
    height: 280,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  topOverlay: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    zIndex: 1,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  logoContainer: {
    alignItems: 'flex-start',
  },
  logo: {
    width: 120,
    height: 40,
  },
  logoText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraCircle: {
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
  },
  crosshairs: {
    position: 'absolute',
    width: 280,
    height: 280,
    justifyContent: 'center',
    alignItems: 'center',
  },
  crosshairHorizontal: {
    position: 'absolute',
    width: 40,
    height: 2,
    opacity: 0.7,
  },
  crosshairVertical: {
    position: 'absolute',
    width: 2,
    height: 40,
    opacity: 0.7,
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    width: '100%',
    zIndex: 1,
  },
  instructionsContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
    width: '100%',
  },
  instructionTitle: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  instructionImage: {
    width: 80,
    height: 80,
    marginBottom: 12,
  },
  instructionText: {
    fontSize: 16,
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  progressContainer: {
    width: '100%',
    alignItems: 'center',
  },
  progressText: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  photoPreviewContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
    width: '100%',
  },
  photoPreview: {
    width: 200,
    height: 200,
    borderRadius: 100,
    overflow: 'hidden',
    marginBottom: 20,
    borderWidth: 4,
  },
  capturedImage: {
    width: '100%',
    height: '70%',
    resizeMode: 'cover',
  },
  fullScreenContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  imagePreview: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullWidthButton: {
    paddingVertical: 16,
    paddingHorizontal: 30,
    borderRadius: 30,
    marginTop: 20,
    width: '90%',
    alignItems: 'center',
  },
  photoPreviewText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
  },
  submitButton: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  greenRing: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -145 }, { translateY: -145 }],
    width: 290,
    height: 290,
    borderRadius: 145,
    borderWidth: 5,
    borderColor: '#00FF00',
    backgroundColor: 'transparent',
    zIndex: 6,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
});