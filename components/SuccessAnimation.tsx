import { StyleSheet, View, Platform } from 'react-native';
import { useEffect, useRef } from 'react';
import LottieView from 'lottie-react-native';

// Conditionally load the Player component only on web
let Player: any = null;
if (Platform.OS === 'web') {
  Player = require('@lottiefiles/react-lottie-player').Player;
}

export default function SuccessAnimation() {
  const checkAnimation = useRef<any>(null);
  const confettiAnimation = useRef<any>(null);

  useEffect(() => {
    // Play both animations when component mounts
    if (Platform.OS !== 'web') {
      checkAnimation.current?.play();
      confettiAnimation.current?.play();
    }
  }, []);

  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <View style={styles.confettiContainer}>
          <Player
            ref={confettiAnimation}
            src={require('@/assets/animations/Animation - 1749106445724.json')}
            autoplay
            loop
            style={styles.confetti}
          />
        </View>
        <View style={styles.checkContainer}>
          <Player
            ref={checkAnimation}
            src={require('@/assets/animations/Animation - 1749106589475.json')}
            autoplay
            loop
            style={styles.check}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.confettiContainer}>
        <LottieView
          ref={confettiAnimation}
          source={require('@/assets/animations/Animation - 1749106445724.json')}
          autoPlay
          loop
          style={styles.confetti}
        />
      </View>
      <View style={styles.checkContainer}>
        <LottieView
          ref={checkAnimation}
          source={require('@/assets/animations/Animation - 1749106589475.json')}
          autoPlay
          loop
          style={styles.check}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  confettiContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  confetti: {
    width: '100%',
    height: '100%',
  },
  checkContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  check: {
    width: 120,
    height: 120,
  },
});