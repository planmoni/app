import { useWindowDimensions } from 'react-native'; // better & reactive on web

// In component:
const { width: screenWidth } = useWindowDimensions();

return (
  <View style={[styles.container, { height }]}>
    <ScrollView
      ref={scrollViewRef}
      horizontal
      pagingEnabled={Platform.OS !== 'web'} // turn off on web
      showsHorizontalScrollIndicator={false}
      scrollEventThrottle={16}
      onScroll={handleScroll}
      decelerationRate="fast"
      style={{ width: '100%' }}
      contentContainerStyle={{
        alignItems: 'center',
        width: screenWidth * banners.length,
      }}
    >
      {banners.map((banner, i) => (
        <Pressable
          key={banner.id}
          onPress={() => handleBannerPress(banner)}
          style={[
            styles.slide,
            { width: screenWidth - 40, height },
          ]}
        >
          <Image
            source={{ uri: banner.image_url }}
            style={styles.image}
          />
        </Pressable>
      ))}
    </ScrollView>
    
    {/* Pagination ... */}
  </View>
);
