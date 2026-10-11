import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(<App />);

// Worker serves only a public offline notice. Never caches authenticated
// responses, passwords, Supabase API or the OrçaPro workspace.
if(import.meta.env.PROD && 'serviceWorker' in navigator){
  window.addEventListener('load',()=>{
    void navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'})
      .then(registration=>{void registration.update().catch(()=>{});})
      .catch(error=>{console.warn('Instalação offline indisponível:',error);});
  });
}
