import { View, StyleSheet } from 'react-native';
import PlanmoniLoader from '@/components/PlanmoniLoader';

type HorizontalLoaderProps = {
  height?: number;
  backgroundColor?: string;
  loaderColor?: string;
};

export default function HorizontalLoader({
  height = 3,
  backgroundColor,
  loaderColor,
}: HorizontalLoaderProps) {
  return (
    <View style={[styles.container, { height }]}>
      <PlanmoniLoader size="small" containerStyle={styles.loaderContainer} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  loaderContainer: {
    height: 30,
  }
});