declare module '*.svg' {
  import React from 'react';
  import { SvgProps } from 'react-native-svg';
  
  interface SvgComponent extends React.FC<SvgProps> {
    (props: SvgProps): React.ReactElement;
  }
  
  const content: SvgComponent;
  export default content;
}

