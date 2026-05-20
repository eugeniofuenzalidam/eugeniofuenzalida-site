import { useState, useEffect, useRef } from "react";
import { collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "../../lib/firebase";
import { Upload, Trash2, Image as ImageIcon, Loader2 } from "lucide-react";

interface GalleryImage {
  id: string;
  url: string;
  filename: string;
  createdAt: any;
}

export function GalleryManager() {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = query(collection(db, "gallery"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const imageData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as GalleryImage[];
      setImages(imageData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        // Create unique filename
        const uniqueName = `${Date.now()}-${file.name}`;
        const storageRef = ref(storage, `gallery/${uniqueName}`);
        
        // Upload to Storage
        await uploadBytes(storageRef, file);
        const downloadUrl = await getDownloadURL(storageRef);
        
        // Save to Firestore
        await addDoc(collection(db, "gallery"), {
          url: downloadUrl,
          filename: uniqueName,
          createdAt: serverTimestamp()
        });
      }
    } catch (error) {
      console.error("Error uploading image: ", error);
      alert("Hubo un error al subir la imagen. Verifica que Storage esté habilitado.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDelete = async (image: GalleryImage) => {
    if (confirm("¿Estás seguro de que quieres eliminar esta imagen de la galería?")) {
      try {
        // Delete from Storage
        const storageRef = ref(storage, `gallery/${image.filename}`);
        await deleteObject(storageRef);
        
        // Delete from Firestore
        await deleteDoc(doc(db, "gallery", image.id));
      } catch (error) {
        console.error("Error deleting image: ", error);
        alert("Error al eliminar la imagen.");
      }
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Galería de Imágenes</h1>
          <p className="text-sm text-neutral-500 mt-1">Sube y administra las fotos que se muestran en tu sitio.</p>
        </div>
        <div>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-black px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-neutral-800 shadow-md">
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            {uploading ? "Subiendo..." : "Subir Imagen"}
            <input 
              type="file" 
              ref={fileInputRef}
              accept="image/*" 
              multiple 
              className="hidden" 
              onChange={handleFileUpload} 
              disabled={uploading}
            />
          </label>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-neutral-200 p-6 sm:p-8 min-h-[400px]">
        {loading ? (
          <div className="flex h-64 items-center justify-center text-neutral-400">
            Cargando galería...
          </div>
        ) : images.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-neutral-400 border-2 border-dashed border-neutral-200 rounded-2xl">
            <ImageIcon size={48} className="mb-4 opacity-50" />
            <p className="font-medium text-neutral-600">No hay imágenes en la galería.</p>
            <p className="text-sm mt-1">Sube tu primera imagen usando el botón de arriba.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {images.map((image) => (
              <div key={image.id} className="group relative aspect-square rounded-2xl overflow-hidden bg-neutral-100 border border-neutral-200">
                <img 
                  src={image.url} 
                  alt={image.filename} 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                  <button 
                    onClick={() => handleDelete(image)}
                    className="p-3 bg-white/20 hover:bg-red-500 hover:text-white text-white backdrop-blur-sm rounded-full transition-all transform scale-75 group-hover:scale-100"
                    title="Eliminar imagen"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
