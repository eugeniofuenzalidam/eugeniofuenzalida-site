export default function BookingCalendar() {
  return (
    <div className="bg-neutral-50 rounded-[2rem] p-10 text-center border border-neutral-100">
      <div className="w-16 h-16 bg-neutral-200 text-neutral-500 rounded-full flex items-center justify-center mx-auto mb-6">
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
      <h3 className="text-2xl font-medium tracking-tight text-black mb-3">Agendar Hora</h3>
      <p className="text-neutral-500 font-light mb-8 max-w-xs mx-auto">Disponible próximamente. El calendario se conectará con tu agenda personal.</p>
      
      <div className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm">
        <div className="grid grid-cols-7 gap-2 text-xs text-neutral-400 mb-4 font-medium">
          {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => (
            <div key={d} className="text-center">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 35 }, (_, i) => (
            <div key={i} className={`aspect-square rounded-full flex items-center justify-center text-sm font-light ${i > 4 && i < 30 ? 'text-neutral-600 hover:bg-black hover:text-white cursor-pointer transition-colors' : 'text-transparent'}`}>
              {i > 4 && i < 30 ? i - 4 : ''}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
