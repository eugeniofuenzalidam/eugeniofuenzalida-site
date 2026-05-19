import { useState, useEffect } from "react";
import { collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { UserPlus, Trash2, Search, MoreHorizontal } from "lucide-react";

interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: "activo" | "inactivo";
  notes: string;
  createdAt: any;
}

export function ClientsManager() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const q = query(collection(db, "clients"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const clientsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Client[];
      setClients(clientsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      await addDoc(collection(db, "clients"), {
        name,
        email,
        phone,
        notes,
        status: "activo",
        createdAt: serverTimestamp()
      });
      setIsAdding(false);
      setName("");
      setEmail("");
      setPhone("");
      setNotes("");
    } catch (error) {
      console.error("Error adding client: ", error);
      alert("Hubo un error al agregar el cliente.");
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("¿Estás seguro de que quieres eliminar este cliente? Esta acción no se puede deshacer.")) {
      try {
        await deleteDoc(doc(db, "clients", id));
      } catch (error) {
        console.error("Error deleting client: ", error);
      }
    }
  };

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Directorio de Clientes</h1>
          <p className="text-sm text-neutral-500 mt-1">Gestiona la información y el estado de tus pacientes.</p>
        </div>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center justify-center gap-2 rounded-xl bg-black px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-neutral-800"
        >
          {isAdding ? "Cancelar" : <><UserPlus size={16} /> Nuevo Cliente</>}
        </button>
      </div>

      {isAdding && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-200">
          <h3 className="text-lg font-semibold mb-4">Agregar Nuevo Cliente</h3>
          <form onSubmit={handleAddClient} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1">Nombre Completo *</label>
              <input required value={name} onChange={e => setName(e.target.value)} className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-black focus:ring-1 focus:ring-black outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-black focus:ring-1 focus:ring-black outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1">Teléfono</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-black focus:ring-1 focus:ring-black outline-none" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-neutral-500 mb-1">Notas Internas</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-black focus:ring-1 focus:ring-black outline-none resize-none" />
            </div>
            <div className="md:col-span-2 flex justify-end mt-2">
              <button type="submit" className="rounded-lg bg-black px-6 py-2 text-sm font-semibold text-white hover:bg-neutral-800">
                Guardar Cliente
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
        <div className="p-4 border-b border-neutral-100 flex items-center gap-2 bg-neutral-50/50">
          <Search size={18} className="text-neutral-400" />
          <input 
            type="text" 
            placeholder="Buscar por nombre o email..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="bg-transparent border-none outline-none text-sm w-full placeholder:text-neutral-400"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 text-neutral-500">
              <tr>
                <th className="px-6 py-4 font-medium">Cliente</th>
                <th className="px-6 py-4 font-medium">Contacto</th>
                <th className="px-6 py-4 font-medium">Estado</th>
                <th className="px-6 py-4 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-neutral-400">Cargando clientes...</td>
                </tr>
              ) : filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-neutral-400">
                    No se encontraron clientes.
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => (
                  <tr key={client.id} className="hover:bg-neutral-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-neutral-900">{client.name}</div>
                      {client.notes && <div className="text-xs text-neutral-400 truncate max-w-[200px] mt-0.5">{client.notes}</div>}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-neutral-600">{client.email || "—"}</div>
                      <div className="text-xs text-neutral-400 mt-0.5">{client.phone || "—"}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                        client.status === "activo" ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-600"
                      }`}>
                        {client.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => handleDelete(client.id)} className="p-2 text-neutral-400 hover:text-red-600 transition-colors rounded-lg hover:bg-red-50">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
