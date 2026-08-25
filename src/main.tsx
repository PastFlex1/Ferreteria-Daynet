import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ModalProvider } from './context/ModalContext.tsx';
import './index.css';

// Prevent negative numbers and scientific notation in all number inputs globally
document.addEventListener('keydown', (e: KeyboardEvent) => {
  const target = e.target as HTMLInputElement;
  if (target && target.tagName === 'INPUT' && target.type === 'number') {
    if (['-', '+', 'e', 'E'].includes(e.key)) {
      e.preventDefault();
    }
  }
});

document.addEventListener('paste', (e: ClipboardEvent) => {
  const target = e.target as HTMLInputElement;
  if (target && target.tagName === 'INPUT' && target.type === 'number') {
    const pasteData = e.clipboardData?.getData('text');
    if (pasteData && (pasteData.includes('-') || pasteData.includes('+') || pasteData.includes('e') || pasteData.includes('E'))) {
      e.preventDefault();
    }
  }
});

document.addEventListener('wheel', (e: WheelEvent) => {
  const target = e.target as HTMLInputElement;
  if (target && target.tagName === 'INPUT' && target.type === 'number') {
    e.preventDefault();
  }
}, { passive: false });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ModalProvider>
      <App />
    </ModalProvider>
  </StrictMode>,
);
