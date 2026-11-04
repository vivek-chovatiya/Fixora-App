import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const shimPath = path.resolve(__dirname, './src/shared/components/ReactNativeWebShim.ts');

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'react-native-libraries-shim',
      enforce: 'pre',
      resolveId(source) {
        if (source === 'react-native' || source === 'react-native-web') {
          return shimPath;
        }
        if (source.includes('react-native/Libraries/') || source.includes('react-native-web/Libraries/')) {
          return '\0react-native-shim:' + source;
        }
      },
      load(id) {
        if (id.startsWith('\0react-native-shim:')) {
          return 'export default {}; export const PressabilityDebugView = () => null; export const customDirectEventTypes = {}; export const getInternalInstanceHandleFromPublicInstance = () => null;';
        }
      },
    },
  ],
  define: {
    __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production'),
    process: { env: { NODE_ENV: JSON.stringify(process.env.NODE_ENV || 'development') } },
    global: 'window',
  },
  optimizeDeps: {
    include: [
      'react-native-web',
      'inline-style-prefixer',
      '@react-native/normalize-colors',
      'inline-style-prefixer/lib/plugins/crossFade',
      'inline-style-prefixer/lib/plugins/cursor',
      'inline-style-prefixer/lib/plugins/filter',
      'inline-style-prefixer/lib/plugins/flex',
      'inline-style-prefixer/lib/plugins/flexboxIE',
      'inline-style-prefixer/lib/plugins/flexboxOld',
      'inline-style-prefixer/lib/plugins/gradient',
      'inline-style-prefixer/lib/plugins/imageSet',
      'inline-style-prefixer/lib/plugins/position',
      'inline-style-prefixer/lib/plugins/sizing',
      'inline-style-prefixer/lib/plugins/transition',
    ],
    exclude: [
      'react-native',
      'react-native-gesture-handler',
      'react-native-safe-area-context',
      'react-native-screens',
      'react-native-worklets',
      '@react-native/new-app-screen',
    ],
  },
  resolve: {
    alias: [
      { find: /^react-native$/, replacement: shimPath },
      { find: /^react-native-web$/, replacement: shimPath },
      { find: '@react-native/new-app-screen', replacement: path.resolve(__dirname, './src/shared/components/NewAppScreenStub.tsx') },
      { find: 'react-native-vector-icons/MaterialCommunityIcons', replacement: 'react-native-vector-icons/dist/MaterialCommunityIcons' },
      { find: '@', replacement: path.resolve(__dirname, './src') },
    ],
    extensions: ['.web.tsx', '.web.ts', '.web.js', '.tsx', '.ts', '.js'],
  },
  server: {
    port: 3000,
  },
});
