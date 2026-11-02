import { useEffect, useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { loadInventoryItems } from '@/api/inventoryItems';

export default function useInventory() {
  const { user } = useAuth(), identity = `${user?.id}:${user?.store_id}:${user?.plan}`;
  const [attempt,setAttempt]=useState(0),[state,setState]=useState({identity:null,loading:true,error:'',products:[]});
  useEffect(()=>{
    let active=true;setState({identity,loading:true,error:'',products:[]});
    loadInventoryItems(user?.plan).then(products=>{if(active)setState({identity,products,loading:false,error:''});})
      .catch(()=>{if(active)setState({identity,products:[],loading:false,error:'Stok belum dapat dimuat. Periksa koneksi lalu coba lagi.'});});
    return()=>{active=false;};
  },[identity,attempt]);
  return {...(state.identity===identity?state:{products:[],error:'',loading:true}),retry:()=>setAttempt(n=>n+1)};
}
