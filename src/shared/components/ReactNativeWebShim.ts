// @ts-ignore
export * from 'react-native-web/dist/index.js';

// @ts-ignore
import * as RNWeb from 'react-native-web/dist/index.js';

const RNWebAny = RNWeb as any;

export const DrawerLayoutAndroid = RNWebAny.DrawerLayoutAndroid || (() => null);
export const TouchableNativeFeedback = RNWebAny.TouchableNativeFeedback || RNWebAny.TouchableOpacity;
export const DeviceEventEmitter =
  RNWebAny.DeviceEventEmitter || {
    addListener: () => ({ remove: () => {} }),
    emit: () => {},
    removeAllListeners: () => {},
  };
export const ViewPropTypes = RNWebAny.ViewPropTypes || { style: () => {} };

const Shim = {
  ...RNWebAny,
  DrawerLayoutAndroid,
  TouchableNativeFeedback,
  DeviceEventEmitter,
  ViewPropTypes,
};

export default Shim;
