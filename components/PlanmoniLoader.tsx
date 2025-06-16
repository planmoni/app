import React from 'react';
import { View, StyleSheet, Platform, Text } from 'react-native';
import LottieView from 'lottie-react-native';

// Conditionally load the Player component only on web
let Player: any = null;
if (Platform.OS === 'web') {
  Player = require('@lottiefiles/react-lottie-player').Player;
}

type PlanmoniLoaderProps = {
  size?: 'small' | 'medium' | 'large';
  containerStyle?: any;
  blurBackground?: boolean;
  description?: string;
};

export default function PlanmoniLoader({ 
  size = 'small', 
  containerStyle,
  blurBackground = false,
  description
}: PlanmoniLoaderProps) {
  // Calculate size based on the prop
  const getSize = () => {
    // If there's a description, double the size
    const multiplier = description ? 2 : 1;
    
    switch (size) {
      case 'small':
        return 80 * multiplier;
      case 'large':
        return 200 * multiplier;
      case 'medium':
      default:
        return 120 * multiplier;
    }
  };

  const loaderSize = getSize();
  
  const styles = StyleSheet.create({
    container: {
      justifyContent: 'center',
      alignItems: 'center',
      ...containerStyle,
    },
    loaderContainer: {
      width: loaderSize,
      height: loaderSize,
      justifyContent: 'center',
      alignItems: 'center',
    },
    blurOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.0)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
    },
    descriptionContainer: {
      marginTop: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    descriptionText: {
      fontSize: 16,
      color: Platform.OS === 'web' ? '#1E3A8A' : '#B7C9E5',
      fontWeight: '600',
      textAlign: 'center',
    }
  });

  const renderLoader = () => {
    if (Platform.OS === 'web') {
      return (
        <View style={styles.loaderContainer}>
          <Player
            src={require('@/assets/animations/planmoniloader.json')}
            autoplay
            loop
            style={{ width: loaderSize, height: loaderSize }}
          />
          {description && (
            <View style={styles.descriptionContainer}>
              <Text style={styles.descriptionText}>{description}</Text>
            </View>
          )}
        </View>
      );
    }

    return (
      <View style={styles.loaderContainer}>
        <LottieView
          source={require('@/assets/animations/planmoniloader.json')}
          autoPlay
          loop
          style={{ width: loaderSize, height: loaderSize }}
        />
        {description && (
          <View style={styles.descriptionContainer}>
            <Text style={styles.descriptionText}>{description}</Text>
          </View>
        )}
      </View>
    );
  };

  // If blur background is enabled, render a full-screen overlay
  if (blurBackground) {
    return (
      <View style={styles.blurOverlay}>
        {renderLoader()}
      </View>
    );
  }

  // Otherwise, render just the loader
  return (
    <View style={styles.container}>
      {renderLoader()}
    </View>
  );
}