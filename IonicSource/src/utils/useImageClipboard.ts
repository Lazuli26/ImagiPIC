import { useCallback, useEffect, useRef, useState } from 'react';

export function imageFromPaste(data: DataTransfer | null): File | null {
  if (!data) return null;
  for (const item of Array.from(data.items || [])) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const image = item.getAsFile();
      if (image) return image;
    }
  }
  return Array.from(data.files || []).find(file => file.type.startsWith('image/')) || null;
}

export function useImageClipboard(enabled: boolean, onImage: (file: File) => Promise<void>) {
  const callback = useRef(onImage);
  const active = useRef(enabled);
  callback.current = onImage;
  active.current = enabled;
  const pending = useRef(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!enabled) return;
    setError('');
    const paste = (event: ClipboardEvent) => {
      if (event.defaultPrevented || pending.current) return;
      const target = event.target;
      // Preserve ordinary pasting into names, labels and other editable fields.
      if (target instanceof Element && target.closest('input, textarea, ion-input, ion-textarea, [contenteditable="true"]')) return;
      const image = imageFromPaste(event.clipboardData);
      if (!image) return;
      event.preventDefault(); setError('');
      callback.current(image).catch(() => setError('No se pudo cargar la imagen pegada. Prueba con un archivo.'));
    };
    document.addEventListener('paste', paste);
    return () => document.removeEventListener('paste', paste);
  }, [enabled]);
  const read = useCallback(async () => {
    if (!active.current || pending.current) return;
    setError('');
    if (!navigator.clipboard?.read) { setError('Este navegador no permite leer el portapapeles con un botón. Prueba Ctrl/Cmd+V o selecciona un archivo.'); return; }
    pending.current = true; setReading(true);
    try {
      const entries = await navigator.clipboard.read();
      if (!active.current) return;
      for (const entry of entries) {
        const type = entry.types.find(value => value.startsWith('image/'));
        if (!type) continue;
        const blob = await entry.getType(type);
        if (!active.current) return;
        const extension = type.split('/')[1]?.replace(/[^a-z0-9]/gi, '') || 'png';
        await callback.current(new File([blob], `imagen-pegada.${extension}`, { type: blob.type || type }));
        return;
      }
      setError('No hay una imagen en el portapapeles. Copia una imagen o una captura e inténtalo de nuevo.');
    } catch (error) {
      if (!active.current) return;
      setError((error as { name?: string }).name === 'NotAllowedError' ? 'No se pudo acceder al portapapeles. Permite el acceso o pega la imagen con Ctrl/Cmd+V.' : 'No se pudo leer el portapapeles. Prueba Ctrl/Cmd+V o selecciona un archivo.');
    } finally { pending.current = false; setReading(false); }
  }, []);
  return { read, reading, error };
}
