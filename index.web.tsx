import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

// Inject root styles for web
const style = document.createElement('style');
style.type = 'text/css';
style.appendChild(
  document.createTextNode(`
  html, body, #root {
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    background-color: #0F172A;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
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
