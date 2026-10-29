import { Alert, Platform, ToastAndroid } from 'react-native';

export const LOG_PREFIX = '[react-native-dev-actions]';

export function notify(message: string): void {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  } else {
    Alert.alert('Dev actions', message);
  }
}
