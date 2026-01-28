// src/hooks/useAppUpdate.js
import { useEffect, useState } from 'react';
import { APP_VERSION, CHANGELOG } from '../utils/version';

const VERSION_KEY = 'app_last_version';

export function useAppUpdate() {
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [changes, setChanges] = useState([]);

  useEffect(() => {
    const storedVersion = localStorage.getItem(VERSION_KEY);

    // Si no hay versión guardada o es diferente → mostramos el modal
    if (!storedVersion || storedVersion !== APP_VERSION) {
      setShowUpdateModal(true);
      setChanges(CHANGELOG);

      // Guardamos la nueva versión inmediatamente
      localStorage.setItem(VERSION_KEY, APP_VERSION);
    }
  }, []); // Solo al montar el componente

  const closeModal = () => setShowUpdateModal(false);

  return { showUpdateModal, changes, closeModal };
}