import { API_BASE } from './client';
import { sessionToken } from '@/auth/session';

// Polling remains available while a serverless host cannot establish a socket.
export function subscribeStore(storeId, refresh, connected) {
 let disposed=false,socket,heartbeat,authTimeout,reconnect,poll;
 const sla=setInterval(()=>update(),30000);
 const update=()=>{if(!disposed&&!document.hidden&&navigator.onLine)Promise.resolve(refresh()).catch(()=>{});};
 const polling=()=>{if(!poll&&!disposed)poll=setInterval(update,3000);};
 const closeTimers=()=>{clearInterval(heartbeat);clearTimeout(authTimeout);heartbeat=null;};
 let delay=5000;
 function connect(){
  if(disposed||document.hidden||!navigator.onLine||socket?.readyState===WebSocket.OPEN||socket?.readyState===WebSocket.CONNECTING)return;
  const token=sessionToken();if(!token)return;
  const url=new URL(API_BASE+'/ws/'+encodeURIComponent(storeId));url.protocol=url.protocol==='https:'?'wss:':'ws:';url.searchParams.set('module','dapuros');
  try{socket=new WebSocket(url.href);}catch{polling();return;}
  socket.onopen=()=>{if(disposed)return;socket.send(JSON.stringify({type:'AUTH',token}));authTimeout=setTimeout(()=>socket.close(),6000);};
  socket.onmessage=event=>{
   if(disposed)return;
   let data;try{data=JSON.parse(event.data);}catch{socket.close();return;}
   if(data.type==='AUTH_OK'){
    clearTimeout(authTimeout);clearInterval(poll);poll=null;delay=5000;connected(true);
    heartbeat=setInterval(()=>{if(socket?.readyState===WebSocket.OPEN)socket.send('PING');},15000);update();
   }else if(['TABLE_UPDATE','ORDER_CREATE','STOCK_UPDATE'].includes(data.type))update();
  };
  socket.onclose=()=>{
   closeTimers();if(disposed)return;connected(false);polling();clearTimeout(reconnect);
   reconnect=setTimeout(connect,delay);delay=Math.min(60000,delay*2);
  };
  socket.onerror=()=>socket.close();
 }
 const resume=()=>{update();connect();};
 connected(false);polling();connect();
 window.addEventListener('online',resume);window.addEventListener('focus',resume);document.addEventListener('visibilitychange',resume);
 return()=>{disposed=true;closeTimers();clearInterval(sla);clearInterval(poll);clearTimeout(reconnect);socket?.close();window.removeEventListener('online',resume);window.removeEventListener('focus',resume);document.removeEventListener('visibilitychange',resume);};
}
