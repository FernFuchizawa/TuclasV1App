import { Dimensions, PixelRatio } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Guideline base dimensions (based on standard iPhone / modern Android screen)
const baseWidth = 390;
const baseHeight = 844;

/**
 * Scales width and horizontal spacing proportionally
 */
export const wp = (size: number) => {
  return (SCREEN_WIDTH / baseWidth) * size;
};

/**
 * Scales height and vertical spacing proportionally
 */
export const hp = (size: number) => {
  return (SCREEN_HEIGHT / baseHeight) * size;
};

/**
 * Scales typography/font-size based on pixel density
 */
export const fontScale = (size: number) => {
  const scale = SCREEN_WIDTH / baseWidth;
  const newSize = size * scale;
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
};