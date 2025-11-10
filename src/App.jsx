import './App.css';
import { Toaster } from 'sonner';
import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import History from './pages/History';

function App() {
  return (
    <>
      <Toaster position="top-center" richColors />
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/history" element={<History />} />
      </Routes>
    </>
  );
}

export default App;
