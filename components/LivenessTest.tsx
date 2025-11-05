import React, {useEffect, useState, useRef} from "react"
import {StyleSheet, View, Text, useWindowDimensions, Modal, Pressable, StatusBar, Image, Platform } from "react-native"
import {Camera as VisionCamera, useCameraDevice, useCameraPermission } from "react-native-vision-camera"
import {Camera, Face, FaceDetectionOptions} from 'react-native-vision-camera-face-detector';
import { useCameraPermissions } from 'expo-camera';
import { X, RotateCcw } from 'lucide-react-native';
import Animated, { useSharedValue, useAnimatedProps, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '@/contexts/ThemeContext';

// Animated SVG Circle for Reanimated
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
// Removed @cutos/ai-face-detect - not compatible with React Native

// Face data structure for comparison
interface FaceData {
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  leftEyeOpenProbability?: number;
  rightEyeOpenProbability?: number;
  smilingProbability?: number;
  yawAngle?: number;
  pitchAngle?: number;
  rollAngle?: number;
  landmarks?: any[];
  contours?: any[];
  timestamp: number;
}

interface LivenessTestProps {
  isVisible: boolean;
  onClose: () => void;
  onComplete?: (capturedImage: string) => void;
}

export default function LivenessTest({ isVisible, onClose, onComplete }: LivenessTestProps) {
  const {hasPermission} = useCameraPermission()
  const {width, height} = useWindowDimensions();
  const { colors, isDark } = useTheme();
  const [currentState, setCurrentState] = useState<'no-face' | 'face-in-circle' | 'face-out-circle' | 'smiling'>('no-face');
  const [livenessStage, setLivenessStage] = useState<'setup' | 'look_straight' | 'look_left' | 'look_right' | 'smile' | 'photo_capture' | 'done'>('setup');
  const [isTestActive, setIsTestActive] = useState(false);
  // const [holdTimer, setHoldTimer] = useState<number | null>(null); // Commented out - not used
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isHolding, setIsHolding] = useState(false);
  const [positionValid, setPositionValid] = useState(false);
  const [hasSpokenInstruction, setHasSpokenInstruction] = useState(false);
  // const [isSpeaking, setIsSpeaking] = useState(false); // Commented out - not used
  // const [lastSpeechTime, setLastSpeechTime] = useState<number>(0); // Commented out - not used
  const [currentInstruction, setCurrentInstruction] = useState<string>('');
  const [hasSpokenCurrentInstruction, setHasSpokenCurrentInstruction] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Face comparison states
  const [referenceFaceData, setReferenceFaceData] = useState<FaceData | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [comparisonResult, setComparisonResult] = useState<{score: number, success: boolean} | null>(null);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [hasPerformedComparison, setHasPerformedComparison] = useState(false);
  const [multipleFacesDetected, setMultipleFacesDetected] = useState(false);
  const [differentPersonDetected, setDifferentPersonDetected] = useState(false);
  
  const device = useCameraDevice('front');
  // const isMountedRef = useRef(true); // Commented out - not used
  const cameraRef = useRef<VisionCamera>(null);
  const [expoPermission, requestExpoPermission] = useCameraPermissions();
  // const expoCameraRef = useRef<CameraView>(null); // Commented out - not used
  const hasSpokenGoodRef = useRef(false);
  // Removed faceDetectRef - using ML Kit instead

  useEffect(() => {
    (async () => {
      await VisionCamera.requestCameraPermission();
      if (!expoPermission?.granted) {
        await requestExpoPermission();
      }
      
      // ML Kit face detection is already initialized
      console.log('ML Kit face detection ready');
    })();
  }, [device, expoPermission, requestExpoPermission]);

  

 
  useEffect(() => {
    if (isVisible) {
      
      StatusBar.setBarStyle('light-content', true);
      StatusBar.setBackgroundColor('#000000', true);
      
     
      setCurrentState('no-face');
      setLivenessStage('setup');
      setIsTestActive(false);
      // setHoldTimer(null); // Commented out - not used
      setCapturedImage(null);
      setIsHolding(false);
      setPositionValid(false);
      setHasSpokenInstruction(false);
      // setIsSpeaking(false); // Commented out - not used
      // setLastSpeechTime(0); // Commented out - not used
      setCurrentInstruction('');
      setHasSpokenCurrentInstruction(false);
      setIsSubmitting(false);
      hasSpokenGoodRef.current = false;
      
      setReferenceFaceData(null);
      setIsComparing(false);
      setComparisonResult(null);
      setShowErrorModal(false);
      setShowSuccessModal(false);
      setHasPerformedComparison(false);
      setMultipleFacesDetected(false);
      setDifferentPersonDetected(false);
      
      setTimeout(() => {
        speakInstruction("Position your face in the circle area to start your liveness test", true);
      }, 1500); 
    } else {
      // Reset StatusBar when modal closes
      StatusBar.setBarStyle('default', true);
      if (Platform.OS === 'android') {
        StatusBar.setBackgroundColor('transparent', true);
      }
      
      // Speech.stop(); // Commented out
      
     
      // setIsSpeaking(false); // Commented out - not used
      // setLastSpeechTime(0); // Commented out - not used
      setCurrentInstruction('');
      setHasSpokenCurrentInstruction(false);
      setIsSubmitting(false);
      hasSpokenGoodRef.current = false;
      
      setReferenceFaceData(null);
      setIsComparing(false);
      setComparisonResult(null);
      setShowErrorModal(false);
      setShowSuccessModal(false);
      setHasPerformedComparison(false);
      setMultipleFacesDetected(false);
      setDifferentPersonDetected(false);
      
     
      setIsTestActive(false);
      setIsHolding(false);
      setPositionValid(false);
      setHasSpokenInstruction(false);
      setCurrentState('no-face');
      setLivenessStage('setup');
      setCapturedImage(null);
      // setHoldTimer(null); // Commented out - not used
      
      
      // setTimeout(() => {
      //   Speech.stop(); // Commented out
      // }, 200);
    }
  }, [isVisible]);

  
  const handleClose = () => {
    // Speech.stop(); // Commented out
    
    
      // setIsSpeaking(false); // Commented out - not used
      // setLastSpeechTime(0); // Commented out - not used
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
    // setHoldTimer(null); // Commented out - not used
    
    
    onClose();
  };

  
  useEffect(() => {
    return () => {
      // Speech cleanup commented out
      // Speech.stop();
    };
  }, []);

  // const playPingSound = async () => {
  //   // Haptic feedback commented out
  //   console.log('Ping sound (haptic disabled)');
  //   return;
  // };

  // const provideStepFeedback = async () => {
  //   // Haptic feedback commented out
  //   console.log('Step feedback (haptic disabled)');
  //   return;
  // };

  const speakInstruction = (text: string, force: boolean = false) => {
    // Speech functionality commented out
    console.log('Instruction (speech disabled):', text);
    return;
    
    // const now = Date.now();
    
    
    // if (text === currentInstruction && hasSpokenCurrentInstruction && !force) {
    //   return;
    // }
    
    // if (isSpeaking && text === currentInstruction && !force) {
    //   return;
    // }
    
   
    // if (force || now - lastSpeechTime >= 2500) {
    //   setLastSpeechTime(now);
    //   setCurrentInstruction(text);
    //   setHasSpokenCurrentInstruction(true);
    //   setIsSpeaking(true);
      
    //   Speech.speak(text, {
    //     language: 'en',
    //     pitch: 1.0,
    //     rate: 0.8,
    //     onDone: () => {
    //       setIsSpeaking(false);
    //     },
    //     onStopped: () => {
    //       setIsSpeaking(false);
    //     },
    //     onError: () => {
    //       setIsSpeaking(false);
    //     }
    //   });
    // }
  };

  const startLivenessTest = () => {
    setIsTestActive(true);
    setLivenessStage('look_left');
    setHasSpokenInstruction(false);
    setHasSpokenInstruction(true);
  };

  const handlePositionGood = () => {
    if (isHolding || hasSpokenGoodRef.current) return; 
    
    setIsHolding(true);
    setPositionValid(false);
    hasSpokenGoodRef.current = true; 
    
    // provideStepFeedback(); // Commented out - function not used
  
    setTimeout(() => {
      
     
      setTimeout(() => {
        nextStep();
        setIsHolding(false);
        hasSpokenGoodRef.current = false; 
      }, 1000);
    }, 2500);
  };

  const nextStep = () => {
    switch (livenessStage) {
      case 'look_left':
        setLivenessStage('smile');
        setHasSpokenInstruction(false);
        setHasSpokenCurrentInstruction(false);
        setHasSpokenInstruction(true);
        break;
      case 'smile':
          setLivenessStage('look_right');
        setHasSpokenInstruction(false);
        setHasSpokenCurrentInstruction(false);
        setHasSpokenInstruction(true);
        break;
      case 'look_right':
        setLivenessStage('look_straight');
        setHasSpokenInstruction(false);
        setHasSpokenCurrentInstruction(false);
        setHasSpokenInstruction(true);
        break;
      case 'look_straight':
        console.log('Switching to photo capture stage');
        setLivenessStage('photo_capture');
        setTimeout(() => {
          console.log('Attempting to capture photo');
          capturePhoto();
        }, 1000);
        break;
      default:
        break;
    }
  };

  const extractFaceData = (face: Face): FaceData => {
    return {
      bounds: face.bounds || { x: 0, y: 0, width: 0, height: 0 },
      leftEyeOpenProbability: face.leftEyeOpenProbability,
      rightEyeOpenProbability: face.rightEyeOpenProbability,
      smilingProbability: face.smilingProbability,
      yawAngle: face.yawAngle,
      pitchAngle: face.pitchAngle,
      rollAngle: face.rollAngle,
      landmarks: face.landmarks ? Object.values(face.landmarks) : [],
      contours: face.contours ? Object.values(face.contours) : [],
      timestamp: Date.now(),
    };
  };

  // Convert image to base64 - commented out as not used
  // const convertImageToBase64 = async (imagePath: string): Promise<string> => {
  //   try {
  //     const response = await fetch(`file://${imagePath}`);
  //     const blob = await response.blob();
  //     return new Promise((resolve, reject) => {
  //       const reader = new FileReader();
  //       reader.onloadend = () => {
  //         const base64 = reader.result as string;
  //         // Remove data:image/jpeg;base64, prefix
  //         const base64Data = base64.split(',')[1];
  //         resolve(base64Data);
  //       };
  //       reader.onerror = reject;
  //       reader.readAsDataURL(blob);
  //     });
  //   } catch (error) {
  //     console.error('Failed to convert image to base64:', error);
  //     throw error;
  //   }
  // };

  // Enhanced multiple face detection using ML Kit
  const detectMultipleFacesWithMLKit = (faces: Face[]): boolean => {
    try {
      const hasMultipleFaces = faces && faces.length > 1;
      console.log('ML Kit detected faces:', faces?.length || 0);
      return hasMultipleFaces;
    } catch (error) {
      console.error('ML Kit multiple face detection failed:', error);
      return false;
    }
  };

  // Validate face quality for better comparison
  const validateFaceQuality = (face: Face): boolean => {
    try {
      // Check if face has sufficient size
      const faceArea = face.bounds.width * face.bounds.height;
      const minFaceArea = 10000; // Minimum face area in pixels
      
      // Check if face is well-positioned (not too close to edges)
      const margin = 50;
      const isWellPositioned = 
        face.bounds.x > margin && 
        face.bounds.y > margin &&
        face.bounds.x + face.bounds.width < width - margin &&
        face.bounds.y + face.bounds.height < height - margin;
      
      // Check if face has good quality indicators
      const hasGoodQuality = 
        face.leftEyeOpenProbability !== undefined &&
        face.rightEyeOpenProbability !== undefined &&
        face.smilingProbability !== undefined;
      
      const isValid = faceArea > minFaceArea && isWellPositioned && hasGoodQuality;
      
      console.log('Face quality validation:', {
        faceArea,
        isWellPositioned,
        hasGoodQuality,
        isValid
      });
      
      return isValid;
    } catch (error) {
      console.error('Face quality validation failed:', error);
      return false;
    }
  };

  // Continuous face verification to ensure same person throughout liveness test
  const verifySamePerson = (currentFace: Face): boolean => {
    try {
      if (!referenceFaceData) {
        console.log('No reference data available for verification');
        return true; // Allow if no reference data
      }

      // Quick comparison using ML Kit face data
      const currentFaceData = extractFaceData(currentFace);
      const score = calculateFaceSimilarity(referenceFaceData, currentFaceData);
      const isSamePerson = score > 0.6; // Lower threshold for continuous verification
      
      console.log('Continuous face verification:', {
        score,
        isSamePerson,
        threshold: 0.6
      });
      
      return isSamePerson;
    } catch (error) {
      console.error('Continuous face verification failed:', error);
      return true; // Allow on error to avoid blocking user
    }
  };

  const captureReferenceFaceData = (face: Face) => {
    try {
      const faceData = extractFaceData(face);
      setReferenceFaceData(faceData);
      console.log('Reference face data captured successfully:', {
        bounds: faceData.bounds,
        yaw: faceData.yawAngle,
        pitch: faceData.pitchAngle,
        roll: faceData.rollAngle,
        landmarks: faceData.landmarks?.length || 0,
        contours: faceData.contours?.length || 0
      });
    } catch (error) {
      console.error('Reference face data capture failed:', error);
    }
  };

  const calculateFaceSimilarity = (reference: FaceData, current: FaceData): number => {
    try {
      let totalScore = 0;
      let factors = 0;

      // 1. Face bounds similarity (30% weight)
      const boundsSimilarity = calculateBoundsSimilarity(reference.bounds, current.bounds);
      totalScore += boundsSimilarity * 0.3;
      factors += 0.3;

      // 2. Face angles similarity (25% weight)
      const anglesSimilarity = calculateAnglesSimilarity(reference, current);
      totalScore += anglesSimilarity * 0.25;
      factors += 0.25;

      // 3. Face classification similarity (25% weight)
      const classificationSimilarity = calculateClassificationSimilarity(reference, current);
      totalScore += classificationSimilarity * 0.25;
      factors += 0.25;

      // 4. Face landmarks similarity (20% weight)
      const landmarksSimilarity = calculateLandmarksSimilarity(reference, current);
      totalScore += landmarksSimilarity * 0.2;
      factors += 0.2;

      const finalScore = factors > 0 ? totalScore / factors : 0;
      console.log('Face similarity calculation:', {
        bounds: boundsSimilarity,
        angles: anglesSimilarity,
        classification: classificationSimilarity,
        landmarks: landmarksSimilarity,
        final: finalScore
      });

      return Math.min(Math.max(finalScore, 0), 1); 
    } catch (error) {
      console.error('Face similarity calculation failed:', error);
      return 0;
    }
  };

  const calculateBoundsSimilarity = (ref: any, curr: any): number => {
    const refCenterX = ref.x + ref.width / 2;
    const refCenterY = ref.y + ref.height / 2;
    const currCenterX = curr.x + curr.width / 2;
    const currCenterY = curr.y + curr.height / 2;

    const centerDistance = Math.sqrt(
      Math.pow(refCenterX - currCenterX, 2) + Math.pow(refCenterY - currCenterY, 2)
    );

    const sizeRatio = Math.min(ref.width / curr.width, curr.width / ref.width) *
                     Math.min(ref.height / curr.height, curr.height / ref.height);

    const maxDistance = Math.sqrt(width * width + height * height);
    const normalizedDistance = Math.min(centerDistance / maxDistance, 1);

    return (1 - normalizedDistance) * sizeRatio;
  };

  const calculateAnglesSimilarity = (ref: FaceData, curr: FaceData): number => {
    const yawDiff = Math.abs((ref.yawAngle || 0) - (curr.yawAngle || 0));
    const pitchDiff = Math.abs((ref.pitchAngle || 0) - (curr.pitchAngle || 0));
    const rollDiff = Math.abs((ref.rollAngle || 0) - (curr.rollAngle || 0));

    const maxAngleDiff = 45; 
    const yawSimilarity = Math.max(0, 1 - yawDiff / maxAngleDiff);
    const pitchSimilarity = Math.max(0, 1 - pitchDiff / maxAngleDiff);
    const rollSimilarity = Math.max(0, 1 - rollDiff / maxAngleDiff);

    return (yawSimilarity + pitchSimilarity + rollSimilarity) / 3;
  };

  // Calculate classification similarity
  const calculateClassificationSimilarity = (ref: FaceData, curr: FaceData): number => {
    const leftEyeDiff = Math.abs((ref.leftEyeOpenProbability || 0) - (curr.leftEyeOpenProbability || 0));
    const rightEyeDiff = Math.abs((ref.rightEyeOpenProbability || 0) - (curr.rightEyeOpenProbability || 0));
    const smileDiff = Math.abs((ref.smilingProbability || 0) - (curr.smilingProbability || 0));

    const leftEyeSimilarity = Math.max(0, 1 - leftEyeDiff);
    const rightEyeSimilarity = Math.max(0, 1 - rightEyeDiff);
    const smileSimilarity = Math.max(0, 1 - smileDiff);

    return (leftEyeSimilarity + rightEyeSimilarity + smileSimilarity) / 3;
  };

  // Calculate landmarks similarity
  const calculateLandmarksSimilarity = (ref: FaceData, curr: FaceData): number => {
    if (!ref.landmarks || !curr.landmarks || ref.landmarks.length === 0 || curr.landmarks.length === 0) {
      return 0.5; // Default similarity if no landmarks
    }

    const minLength = Math.min(ref.landmarks.length, curr.landmarks.length);
    let totalSimilarity = 0;

    for (let i = 0; i < minLength; i++) {
      const refLandmark = ref.landmarks[i];
      const currLandmark = curr.landmarks[i];
      
      if (refLandmark && currLandmark && refLandmark.position && currLandmark.position) {
        const distance = Math.sqrt(
          Math.pow(refLandmark.position.x - currLandmark.position.x, 2) +
          Math.pow(refLandmark.position.y - currLandmark.position.y, 2)
        );
        
        // Normalize distance based on face size
        const faceSize = Math.max(ref.bounds.width, ref.bounds.height);
        const normalizedDistance = Math.min(distance / faceSize, 1);
        const similarity = Math.max(0, 1 - normalizedDistance);
        totalSimilarity += similarity;
      }
    }

    return minLength > 0 ? totalSimilarity / minLength : 0.5;
  };

  // Compare faces using ML Kit face data
  const compareFaces = async (referenceFaceData: FaceData, currentFaceData: FaceData) => {
    try {
      console.log('Starting ML Kit face comparison...');
      
      const score = calculateFaceSimilarity(referenceFaceData, currentFaceData);
      console.log('Face comparison score:', score);
      
      // Using 0.7 threshold for ML Kit comparison
      const success = score > 0.7;
      return { score, success };
    } catch (error) {
      console.error('Face comparison failed:', error);
      return { score: 0, success: false };
    }
  };

  // Handle face comparison result
  const handleComparisonResult = (result: {score: number, success: boolean}) => {
    console.log(' Handling comparison result:', result);
    setComparisonResult(result);
    setIsComparing(false);
    
    if (result.success) {
      console.log('Face verification successful - Score:', result.score);
      setShowSuccessModal(true);
    } else {
      console.log(' Face verification failed - Score:', result.score);
      setShowErrorModal(true);
    }
  };

  // Retry liveness test
  const retryLivenessTest = () => {
    setShowErrorModal(false);
    setShowSuccessModal(false);
    setReferenceFaceData(null);
    setIsComparing(false);
    setComparisonResult(null);
    setHasPerformedComparison(false);
    setCurrentState('no-face');
    setLivenessStage('setup');
    setIsTestActive(false);
    setCapturedImage(null);
    setHasSpokenInstruction(false);
    hasSpokenGoodRef.current = false;
    
    setTimeout(() => {
      speakInstruction("Position your face in the circle area to start your liveness test", true);
    }, 1000);
  };

  const capturePhoto = async () => {
    try {
      console.log('capturePhoto called - cameraRef:', !!cameraRef.current);
      
      if (cameraRef.current) {
        console.log('Taking final photo with Vision camera...');
        const photo = await cameraRef.current.takePhoto({
          flash: 'off',
          enableShutterSound: false,
        });
        console.log('Final photo captured successfully:', photo.path);
        setCapturedImage(photo.path);
        
        // Start comparison with the reference face data captured during setup
        if (referenceFaceData) {
          console.log('Starting face comparison with reference from setup...');
          setIsComparing(true);
          setHasPerformedComparison(false);
        } else {
          console.error('No reference face data available for comparison');
          speakInstruction("No reference face data available for comparison", true);
        }
        
        speakInstruction("Photo captured successfully", true);
      } else {
        console.error('Vision camera not ready');
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
    
   
    setTimeout(() => {
      setIsSubmitting(false);
      
      
      setTimeout(() => {
        handleClose();
      }, 1000);
    }, 3000);
  };

  const getInstructionText = () => {
    if (isComparing) {
      return 'Comparing faces...';
    }
    
    if (differentPersonDetected) {
      return 'Different person detected. Please ensure the same person continues the test';
    }
    
    if (multipleFacesDetected) {
      return 'Multiple faces detected. Please ensure only one person is visible';
    }
    
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
    contourMode: 'all',
    classificationMode: 'all',
    trackingEnabled: true,
    windowWidth: width,
    windowHeight: height,
  }).current;

  const handleFacesDetection = async (faces: Face[]) => {
    try {
      // Enhanced multiple face detection with better validation
      const hasMultipleFaces = detectMultipleFacesWithMLKit(faces);
      if (hasMultipleFaces) {
        console.log('Multiple faces detected:', faces.length);
        setCurrentState('face-out-circle');
        setMultipleFacesDetected(true);
        
        // Speak warning about multiple faces
        if (currentInstruction !== "Multiple faces detected. Please ensure only one person is in frame" || !hasSpokenCurrentInstruction) {
          setCurrentInstruction("Multiple faces detected. Please ensure only one person is in frame");
          setHasSpokenCurrentInstruction(false);
          speakInstruction("Multiple faces detected. Please ensure only one person is in frame");
        }
        return; 
      } else if (faces?.length === 1) {
        setMultipleFacesDetected(false);
        setDifferentPersonDetected(false);
      } else {
        // No faces detected
        setMultipleFacesDetected(false);
        setDifferentPersonDetected(false);
      }
      
      if (faces?.length > 0) {
        const face = faces[0];
        const faceInCircle = isFaceInCircle(face);
        const isSmiling = face.smilingProbability && face.smilingProbability > 0.7;
        const yaw = face.yawAngle > 15 ? "Right" : face.yawAngle < -15 ? "Left" : "Center";
        const pitch = face.pitchAngle > 15 ? "Up" : face.pitchAngle < -10 ? "Down" : "Center";
        
        // Validate face quality
        const hasGoodQuality = validateFaceQuality(face);
        
        if (isComparing) {
          console.log('Face detected during comparison:', {
            faceInCircle,
            hasReferenceData: !!referenceFaceData,
            hasPerformedComparison,
            livenessStage
          });
        }
        
     
        let newState: 'no-face' | 'face-in-circle' | 'face-out-circle' | 'smiling';
        
        if (!faceInCircle) {
          newState = 'face-out-circle';
        } else if (isSmiling) {
          newState = 'smiling';
        } else {
          newState = 'face-in-circle';
        }
        
       
        if (faceInCircle && hasGoodQuality && livenessStage === 'setup' && !isTestActive && !hasSpokenInstruction) {
          setHasSpokenInstruction(true);
          setCurrentInstruction("I can see your face");
          setHasSpokenCurrentInstruction(false);
          
          if (!referenceFaceData) {
            captureReferenceFaceData(face);
            
            // Reference face data is already captured in captureReferenceFaceData
            console.log('Reference face data captured during setup - SECURITY FIX');
          }
          
          setTimeout(() => {
            startLivenessTest();
          }, 1500);
        } else if (faceInCircle && !hasGoodQuality && livenessStage === 'setup' && !isTestActive) {
          // Provide feedback for poor face quality
          if (currentInstruction !== "Please position your face better in the circle" || !hasSpokenCurrentInstruction) {
            setCurrentInstruction("Please position your face better in the circle");
            setHasSpokenCurrentInstruction(false);
            speakInstruction("Please position your face better in the circle");
          }
        }
        
     
        if (isComparing && referenceFaceData && faceInCircle && hasGoodQuality && !hasPerformedComparison) {
          console.log('Face comparison conditions met:', {
            isComparing,
            hasReferenceData: !!referenceFaceData,
            faceInCircle,
            hasGoodQuality,
            hasPerformedComparison
          });
          
          setHasPerformedComparison(true);
          
          try {
            // Compare current face with reference face data
            const currentFaceData = extractFaceData(face);
            console.log('Starting ML Kit face comparison...');
            const result = await compareFaces(referenceFaceData, currentFaceData);
            
            console.log('Comparison result:', result);
            handleComparisonResult(result);
          } catch (error) {
            console.error('Face comparison failed:', error);
            handleComparisonResult({ score: 0, success: false });
          }
          return; 
        }

        if (isTestActive && faceInCircle && !isHolding && !differentPersonDetected) {
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
          
          // Continuous face verification during liveness movements (SECURITY)
          if (currentPositionValid && referenceFaceData && !differentPersonDetected) {
            const isSamePerson = verifySamePerson(face);
            if (!isSamePerson) {
              console.log('Different person detected during liveness test - SECURITY ALERT');
              setDifferentPersonDetected(true);
              setMultipleFacesDetected(true);
              speakInstruction("Different person detected. Please ensure the same person continues the test", true);
              return;
            }
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
            if (currentInstruction !== "Please position your face in the circle area" || !hasSpokenCurrentInstruction) {
              setCurrentInstruction("Please position your face in the circle area");
              setHasSpokenCurrentInstruction(false);
              speakInstruction("Please position your face in the circle area");
            }
          }
          setCurrentState(newState);
        }
    } else {
     
        if (currentState !== 'no-face') {
          if (currentInstruction !== "Please position your face in the circle area" || !hasSpokenCurrentInstruction) {
            setCurrentInstruction("Please position your face in the circle area");
            setHasSpokenCurrentInstruction(false);
            speakInstruction("Please position your face in the circle area");
          }
          setCurrentState('no-face');
        }
      }
    } catch {
      // Error handling commented out
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
          {livenessStage === 'photo_capture' && capturedImage && !isComparing ? (
            <Image 
              source={{ uri: capturedImage }} 
              style={styles.camera}
              resizeMode="cover"
            />
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

          {/* Red Ring when Multiple Faces or Different Person Detected */}
          {(multipleFacesDetected || differentPersonDetected) && (
            <View style={styles.redRing} />
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

    {/* Face Comparison Status */}
    {isComparing && (
      <View style={styles.comparisonOverlay}>
        <View style={[styles.comparisonContainer, { backgroundColor: colors.backgroundTertiary }]}>
          <Text style={[styles.comparisonText, { color: colors.text }]}>
            Comparing faces...
          </Text>
        </View>
      </View>
    )}

    {/* Error Modal */}
    {showErrorModal && (
      <Modal visible={showErrorModal} transparent animationType="fade">
        <View style={styles.errorModalOverlay}>
          <View style={[styles.errorModal, { backgroundColor: colors.backgroundSecondary }]}>
            <View style={styles.errorModalHeader}>
              <Text style={[styles.errorModalTitle, { color: colors.text }]}>
                Face Match Failed
              </Text>
            </View>
            
            <View style={styles.errorModalContent}>
              <Text style={[styles.errorModalMessage, { color: colors.textSecondary }]}>
                Make sure you&apos;re alone and in a well lit environment and try again.
              </Text>
              
              {comparisonResult && (
                <Text style={[styles.errorModalScore, { color: colors.textTertiary }]}>
                  Match Score: {(comparisonResult.score * 100).toFixed(1)}%
                </Text>
              )}
            </View>
            
            <View style={styles.errorModalActions}>
              <Pressable 
                style={[styles.retryButton, { backgroundColor: colors.primary }]}
                onPress={retryLivenessTest}
              >
                <RotateCcw size={20} color="#FFFFFF" />
                <Text style={styles.retryButtonText}>Try Again</Text>
              </Pressable>
              
              <Pressable 
                style={[styles.cancelButton, { backgroundColor: colors.backgroundTertiary }]}
                onPress={handleClose}
              >
                <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    )}

    {/* Success Modal */}
    {showSuccessModal && (
      <Modal visible={showSuccessModal} transparent animationType="fade">
        <View style={styles.errorModalOverlay}>
          <View style={[styles.errorModal, { backgroundColor: colors.backgroundSecondary }]}>
            <View style={styles.errorModalHeader}>
              <Text style={[styles.errorModalTitle, { color: colors.text }]}>
                Face Verification Successful
              </Text>
            </View>
            
            <View style={styles.errorModalContent}>
              <Text style={[styles.errorModalMessage, { color: colors.textSecondary }]}>
                Your face has been successfully verified. You can now proceed.
              </Text>
              
              {comparisonResult && (
                <Text style={[styles.errorModalScore, { color: colors.success || colors.primary }]}>
                  Match Score: {(comparisonResult.score * 100).toFixed(1)}%
                </Text>
              )}
            </View>
            
            <View style={styles.errorModalActions}>
              <Pressable 
                style={[styles.retryButton, { backgroundColor: colors.primary }]}
                onPress={() => {
                  setShowSuccessModal(false);
                  // Call onComplete with captured image if available
                  if (onComplete && capturedImage) {
                    onComplete(capturedImage);
                  }
                  handleClose();
                }}
              >
                <Text style={styles.retryButtonText}>Continue</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    )}
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
  redRing: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -145 }, { translateY: -145 }],
    width: 290,
    height: 290,
    borderRadius: 145,
    borderWidth: 5,
    borderColor: '#FF0000',
    backgroundColor: 'transparent',
    zIndex: 6,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  // Face comparison styles
  comparisonOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 10,
  },
  comparisonContainer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  comparisonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  // Error modal styles
  errorModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  errorModal: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 16,
  },
  errorModalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  errorModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  errorModalContent: {
    alignItems: 'center',
    marginBottom: 24,
  },
  errorModalMessage: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 12,
  },
  errorModalScore: {
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  errorModalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  retryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});