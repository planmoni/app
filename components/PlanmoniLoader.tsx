import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
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
};

export default function PlanmoniLoader({ 
  size = 'medium', 
  containerStyle,
  blurBackground = false
}: PlanmoniLoaderProps) {
  // Calculate size based on the prop
  const getSize = () => {
    switch (size) {
      case 'small':
        return 80;
      case 'large':
        return 200;
      case 'medium':
      default:
        return 120;
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
      backgroundColor: 'rgba(0, 0, 0, 0.3)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
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