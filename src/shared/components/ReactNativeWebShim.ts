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
/** Native-only modules (e.g. the image picker's TurboModule) resolve to null on web. */
export const TurboModuleRegistry = RNWebAny.TurboModuleRegistry || {
  get: () => null,
  getEnforcing: () => null,
};

const Shim = {
  ...RNWebAny,
  DrawerLayoutAndroid,
  TouchableNativeFeedback,
  DeviceEventEmitter,
  ViewPropTypes,
  TurboModuleRegistry,
};

export default Shim;
