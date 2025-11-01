import './App.css';
import Home from './pages/Home';
import { Toaster } from 'sonner';

function App() {
  return (
    <>
      <Toaster position="top-center" richColors />
      <Home />
    </>
  );
}

export default App;
