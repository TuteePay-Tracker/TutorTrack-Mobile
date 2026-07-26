import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BAR_BODY_HEIGHT = 52;

export function useTabBarHeight() {
  const insets = useSafeAreaInsets();
  return BAR_BODY_HEIGHT + insets.bottom + 16;
}
