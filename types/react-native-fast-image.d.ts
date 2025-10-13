declare module 'react-native-fast-image' {
  import { ImageProps } from 'react-native';
  import * as React from 'react';
  interface FastImageStatic extends React.ComponentClass<ImageProps> {
    preload(sources: Array<any>): void;
    priority: {
      high: number;
      normal: number;
      low: number;
    };
    cacheControl: {
      immutable: number;
      web: number;
      cacheOnly: number;
    };
    resizeMode: {
      cover: string;
      contain: string;
      stretch: string;
    };
  }

  const FastImage: FastImageStatic;
  export default FastImage;
}
