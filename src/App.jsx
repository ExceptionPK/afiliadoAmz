import './App.css';
import { Toaster } from 'sonner';
import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import History from './pages/History';
import Chat from './pages/Chat'; // ← Nueva importación

function App() {
  return (
    <>
      <Toaster
        position="top-center"
        richColors
        duration={1500}
        toastOptions={{
          classNames: {
            toast: "justify-start",
            title: "!text-center",
            description: "!text-center",
            content: "flex-1 text-center",
          }
        }}
      />
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/history" element={<History />} />
        <Route path="/chat" element={<Chat />} />
      </Routes>
    </>
  );
}

export default App;