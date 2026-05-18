import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { initializeApp } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';

const firebaseConfig = {
  apiKey: "AIzaSyACo9VakiNymvhhzgSZ0jFvVPSTfAgmdTM",
  authDomain: "eugeniofuenzalidaps.firebaseapp.com",
  projectId: "eugeniofuenzalidaps",
  storageBucket: "eugeniofuenzalidaps.firebasestorage.app",
  messagingSenderId: "153097732814",
  appId: "1:153097732814:web:757f723336ae187492069f",
  measurementId: "G-N2Y9RSPVZ8"
};

const app = initializeApp(firebaseConfig);
const functions = getFunctions(app, 'us-central1');
const getBusySlotsFn = httpsCallable(functions, 'getBusySlots');
const createBookingFn = httpsCallable(functions, 'createBooking');
const createPreferenceFn = httpsCallable(functions, 'createPreference');

const DAYS_ES = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const MONTHS_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const SERVICES = [
  'Coaching Deportivo Alto Rendimiento',
  'Paquete de 4 sesiones: Encuentra un buen trabajo',
  'Psicología integral orientada a resultados',
  'Trabaja con Propósito',
];

const WORKING_HOURS = [
  9, 10, 11, 12, 14, 15, 16, 17,
];

const SERVICE_PRICES: Record<string, number> = {
  'Coaching Deportivo Alto Rendimiento': 30000,
  'Paquete de 4 sesiones: Encuentra un buen trabajo': 100000,
  'Psicología integral orientada a resultados': 30000,
  'Trabaja con Propósito': 30000,
};

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

function formatDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

interface BusyRange {
  start: string;
  end: string;
}

export default function BookingCalendar() {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [selectedDate, setSelectedDate] = useState<number | null>(null);
  const [selectedTime, setSelectedTime] = useState<number | null>(null);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [busySlots, setBusySlots] = useState<BusyRange[]>([]);
  const [loading, setLoading] = useState(false);
  const [bookingStatus, setBookingStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [contactInfo, setContactInfo] = useState({ name: '', email: '', phone: '' });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const fetchBusySlots = useCallback(async (year: number, month: number, day: number) => {
    setLoading(true);
    try {
      const dateStr = formatDate(year, month, day);
      const timeMin = `${dateStr}T00:00:00-04:00`;
      const timeMax = `${dateStr}T23:59:59-04:00`;
      const result = await getBusySlotsFn({ timeMin, timeMax });
      setBusySlots((result.data as { busy: BusyRange[] }).busy || []);
    } catch {
      setBusySlots([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedDate) {
      fetchBusySlots(currentYear, currentMonth, selectedDate);
    }
  }, [selectedDate, currentMonth, currentYear, fetchBusySlots]);

  // Handle return from Mercado Pago
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('status');
    const paymentId = params.get('payment_id');

    if (status === 'success' && paymentId) {
      const pendingBooking = sessionStorage.getItem('pending_booking');
      if (pendingBooking) {
        setBookingStatus('submitting');
        const data = JSON.parse(pendingBooking);
        createBookingFn(data).then(() => {
          setBookingStatus('success');
          sessionStorage.removeItem('pending_booking');
          window.history.replaceState({}, '', window.location.pathname);
        }).catch((err) => {
          console.error(err);
          setBookingStatus('error');
        });
      } else {
        setBookingStatus('success');
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, []);

  // Handle external service selection
  useEffect(() => {
    const handleSelectService = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      const service = customEvent.detail;
      if (SERVICES.includes(service)) {
        setSelectedService(service);
        setSelectedDate(null);
        setSelectedTime(null);
        setBookingStatus('idle');
        setIsModalOpen(true);
      }
    };

    document.addEventListener('select-service', handleSelectService as any);
    return () => {
      document.removeEventListener('select-service', handleSelectService as any);
    };
  }, []);

  const isTimeBusy = (hour: number): boolean => {
    if (!selectedDate) return false;
    const dateStr = formatDate(currentYear, currentMonth, selectedDate);
    const slotStart = new Date(`${dateStr}T${String(hour).padStart(2, '0')}:00:00-04:00`);
    const slotEnd = new Date(`${dateStr}T${String(hour + 1).padStart(2, '0')}:00:00-04:00`);

    return busySlots.some((busy) => {
      const busyStart = new Date(busy.start);
      const busyEnd = new Date(busy.end);
      return slotStart < busyEnd && slotEnd > busyStart;
    });
  };

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
    setSelectedDate(null);
    setSelectedTime(null);
    setBusySlots([]);
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
    setSelectedDate(null);
    setSelectedTime(null);
    setBusySlots([]);
  };

  const isPast = (day: number) => {
    const d = new Date(currentYear, currentMonth, day);
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return d < t;
  };

  const isToday = (day: number) => {
    return day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();
  };

  const handleConfirm = async () => {
    if (!selectedService || !selectedDate || selectedTime === null) return;

    setBookingStatus('submitting');
    try {
      const dateStr = formatDate(currentYear, currentMonth, selectedDate);
      
      // Store booking data to create it after successful payment
      const bookingData = {
        service: selectedService,
        date: dateStr,
        hour: selectedTime,
        name: contactInfo.name,
        email: contactInfo.email,
        phone: contactInfo.phone,
      };
      sessionStorage.setItem('pending_booking', JSON.stringify(bookingData));

      // Create Mercado Pago preference
      const amount = SERVICE_PRICES[selectedService] || 30000;
      const result = await createPreferenceFn({
        service: selectedService,
        amount: amount
      });
      const { init_point } = result.data as { init_point: string };
      
      // Redirect to Mercado Pago
      window.location.href = init_point;
      
    } catch (error) {
      console.error('Error creating booking or payment preference:', error);
      setBookingStatus('error');
    }
  };

  let content = null;

  if (bookingStatus === 'success') {
    content = (
      <div className="bg-neutral-50 rounded-[2rem] p-10 text-center border border-neutral-100">
        <div className="w-16 h-16 bg-black text-white rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-2xl font-medium tracking-tight text-black mb-3">¡Hora agendada!</h3>
        <p className="text-neutral-500 font-light">Recibirás la confirmación en tu calendario.</p>
        <button
          onClick={() => {
            setBookingStatus('idle');
            setSelectedService(null);
            setSelectedDate(null);
            setSelectedTime(null);
            setContactInfo({ name: '', email: '', phone: '' });
          }}
          className="mt-6 text-sm font-medium text-neutral-400 hover:text-black transition-colors"
        >
          Agendar otra hora
        </button>
      </div>
    );
  } else if (!selectedService && bookingStatus !== 'success') {
    content = (
      <div className="bg-neutral-50 rounded-[2rem] p-10 border border-neutral-100">
        <h3 className="text-2xl font-medium tracking-tight text-black mb-3 text-center">Agendar Hora</h3>
        <p className="text-neutral-500 font-light mb-8 text-center">Selecciona el servicio que necesitas.</p>
        <div className="space-y-4">
          {SERVICES.map((service) => (
            <div
              key={service}
              className="w-full flex justify-between items-center px-6 py-5 rounded-2xl border border-neutral-200 bg-white hover:border-black hover:shadow-md transition-all duration-300"
            >
              <div className="flex-1 text-left">
                <div className="font-medium text-black text-sm md:text-base">{service}</div>
                <div className="text-neutral-500 font-light text-sm mt-1">${(SERVICE_PRICES[service] || 0).toLocaleString('es-CL')}</div>
              </div>
              <button
                onClick={() => setSelectedService(service)}
                className="ml-4 px-5 py-2.5 bg-black text-white text-sm font-medium rounded-xl hover:bg-neutral-800 transition-colors shadow-sm whitespace-nowrap"
              >
                Agendar
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  } else {
    content = (
      <div className="bg-neutral-50 rounded-[2rem] p-10 border border-neutral-100">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => { setSelectedService(null); setSelectedDate(null); setSelectedTime(null); }}
            className="text-sm text-neutral-400 hover:text-black transition-colors"
          >
            ← Servicios
          </button>
          <span className="text-xs text-neutral-400 font-light">{selectedService}</span>
        </div>

        <div className="flex items-center justify-between mb-6">
          <button onClick={prevMonth} className="w-9 h-9 rounded-full border border-neutral-200 flex items-center justify-center text-neutral-600 hover:bg-black hover:text-white transition-colors text-sm">←</button>
          <span className="text-lg font-medium tracking-tight text-black">{MONTHS_ES[currentMonth]} {currentYear}</span>
          <button onClick={nextMonth} className="w-9 h-9 rounded-full border border-neutral-200 flex items-center justify-center text-neutral-600 hover:bg-black hover:text-white transition-colors text-sm">→</button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-2">
          {DAYS_ES.map((d) => (
            <div key={d} className="text-center text-xs text-neutral-400 font-medium py-1">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 mb-6">
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const isSelected = selectedDate === day;
            const past = isPast(day);
            const today_ = isToday(day);
            return (
              <button
                key={day}
                onClick={() => !past && setSelectedDate(day)}
                disabled={past}
                className={`aspect-square rounded-full flex items-center justify-center text-sm font-light transition-all duration-200
                  ${isSelected ? 'bg-black text-white font-medium' : past ? 'text-neutral-200 cursor-default' : today_ ? 'bg-neutral-100 text-black font-medium' : 'text-neutral-600 hover:bg-black hover:text-white cursor-pointer'}`}
              >
                {day}
              </button>
            );
          })}
        </div>

        {selectedDate && (
          <div className="border-t border-neutral-100 pt-6">
            <h4 className="text-sm font-medium text-black mb-4">
              Horas disponibles — {selectedDate} de {MONTHS_ES[currentMonth]}
            </h4>

            {loading ? (
              <div className="flex justify-center py-6">
                <div className="w-5 h-5 border-2 border-neutral-200 border-t-black rounded-full animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2 mb-6">
                {WORKING_HOURS.map((hour) => {
                  const busy = isTimeBusy(hour);
                  const isSelected = selectedTime === hour;
                  return (
                    <button
                      key={hour}
                      onClick={() => !busy && setSelectedTime(hour)}
                      disabled={busy}
                      className={`py-2.5 rounded-xl text-sm transition-all duration-200
                        ${busy ? 'bg-neutral-100 text-neutral-300 cursor-default line-through' : isSelected ? 'bg-black text-white font-medium' : 'bg-white border border-neutral-200 text-neutral-600 hover:border-black cursor-pointer'}`}
                    >
                      {String(hour).padStart(2, '0')}:00
                    </button>
                  );
                })}
              </div>
            )}

            {selectedTime !== null && (
              <div className="border-t border-neutral-100 pt-6 space-y-4">
                <h4 className="text-sm font-medium text-black">Tus datos</h4>
                <input
                  type="text"
                  placeholder="Nombre"
                  value={contactInfo.name}
                  onChange={(e) => setContactInfo({ ...contactInfo, name: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm text-neutral-600 font-light focus:outline-none focus:border-black transition-colors"
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={contactInfo.email}
                  onChange={(e) => setContactInfo({ ...contactInfo, email: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm text-neutral-600 font-light focus:outline-none focus:border-black transition-colors"
                />
                <input
                  type="tel"
                  placeholder="Teléfono (opcional)"
                  value={contactInfo.phone}
                  onChange={(e) => setContactInfo({ ...contactInfo, phone: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm text-neutral-600 font-light focus:outline-none focus:border-black transition-colors"
                />

                <button
                  onClick={handleConfirm}
                  disabled={bookingStatus === 'submitting' || !contactInfo.name || !contactInfo.email}
                  className="w-full py-4 bg-black text-white rounded-xl text-sm font-medium tracking-wide transition-all duration-200 hover:scale-[1.01] hover:shadow-lg disabled:bg-neutral-300 disabled:cursor-default disabled:hover:scale-100 disabled:hover:shadow-none"
                >
                  {bookingStatus === 'submitting' ? 'Redirigiendo al pago...' : `Agendar y Pagar: ${selectedDate} de ${MONTHS_ES[currentMonth]} a las ${String(selectedTime).padStart(2, '0')}:00`}
                </button>

                {bookingStatus === 'error' && (
                  <p className="text-sm text-red-500 text-center">Error al agendar. Intenta de nuevo.</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  if (isModalOpen && isMounted) {
    return createPortal(
      <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="w-full max-w-3xl relative">
          <button 
            onClick={() => { setIsModalOpen(false); setSelectedService(null); }} 
            className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center bg-black/5 hover:bg-black/10 text-neutral-500 rounded-full transition-colors cursor-pointer"
          >
            ✕
          </button>
          <div className="max-h-[90vh] overflow-y-auto rounded-[2rem] shadow-2xl shadow-black/20">
            {content}
          </div>
        </div>
      </div>,
      document.body
    );
  }

  return content;
}
