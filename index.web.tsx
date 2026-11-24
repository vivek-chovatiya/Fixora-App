import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import iconFont from 'react-native-vector-icons/Fonts/MaterialCommunityIcons.ttf';
import interRegular from './src/assets/fonts/Inter-Regular.ttf';
import interMedium from './src/assets/fonts/Inter-Medium.ttf';
import interSemiBold from './src/assets/fonts/Inter-SemiBold.ttf';
import interBold from './src/assets/fonts/Inter-Bold.ttf';

const interFace = (src: string, weight: number) =>
  `@font-face { font-family: 'Inter'; src: url(${src}) format('truetype'); font-weight: ${weight}; font-style: normal; font-display: swap; }`;

// Inject root styles for web
const style = document.createElement('style');
style.type = 'text/css';
style.appendChild(
  document.createTextNode(`
  @font-face {
    font-family: 'MaterialCommunityIcons';
    src: url(${iconFont}) format('truetype');
  }
  ${interFace(interRegular, 400)}
  ${interFace(interMedium, 500)}
  ${interFace(interSemiBold, 600)}
  ${interFace(interBold, 700)}
  html, body, #root {
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    background-color: #F9FAFB;
    font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  #root > div {
    flex: 1;
    display: flex;
    flex-direction: column;
    height: 100%;
  }
`),
);
document.head.appendChild(style);

AppRegistry.registerComponent(appName, () => App);

AppRegistry.runApplication(appName, {
  initialProps: {},
  rootTag: document.getElementById('root'),
});
