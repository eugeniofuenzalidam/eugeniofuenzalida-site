import { useState, useEffect } from "react";
import { collection, query, orderBy, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";

interface GalleryImage {
  id: string;
  url: string;
  filename: string;
}

export function DynamicGallery() {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Al cargar el componente en el navegador, pedimos las imágenes a Firebase
    const fetchImages = async () => {
      try {
        const q = query(collection(db, "gallery"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        const imageData = snapshot.docs.map(doc => ({
          id: doc.id,
          url: doc.data().url,
          filename: doc.data().filename,
        }));
        setImages(imageData);
      } catch (error) {
        console.error("Error fetching gallery images:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchImages();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-8">
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <div key={n} className="aspect-square bg-neutral-100 rounded-3xl animate-pulse"></div>
        ))}
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className="text-center py-20 bg-neutral-50 rounded-3xl border border-neutral-100">
        <p className="text-neutral-500 font-medium">No hay imágenes en la galería aún.</p>
        <p className="text-sm text-neutral-400 mt-2">Próximamente estaremos compartiendo más contenido.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-8">
      {images.map((img) => (
        <div 
          key={img.id} 
          className="aspect-square bg-neutral-100 rounded-3xl group hover:bg-neutral-200 transition-colors duration-500 cursor-pointer overflow-hidden relative shadow-sm"
        >
          {/* Imagen real cargada desde Firebase Storage */}
          <img 
            src={img.url} 
            alt="Galería" 
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            loading="lazy"
          />
          
          {/* Overlay oscuro elegante en hover */}
          <div className="absolute inset-0 bg-black/20 mix-blend-multiply opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
        </div>
      ))}
    </div>
  );
}
