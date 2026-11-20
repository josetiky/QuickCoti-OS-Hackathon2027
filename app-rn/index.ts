import { registerRootComponent } from 'expo';
import { Buffer } from 'buffer';
(global as any).Buffer = (global as any).Buffer || Buffer;
import App from './App';
registerRootComponent(App);
