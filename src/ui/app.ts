import { WebSocketClient } from './websocket-client';

console.log('Conclave UI starting...');
const ws = new WebSocketClient('ws://localhost:3001');
ws.connect();
