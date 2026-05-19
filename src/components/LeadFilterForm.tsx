import { useState } from "react";

export default function LeadFilterForm() {
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  const steps = [
    {
      title: "¿Qué te gustaría mejorar?",
      fields: [
        "Rendimiento deportivo",
        "Desarrollo profesional",
        "Bienestar personal",
        "Desempeño organizacional",
      ],
    },
    {
      title: "¿Cuál es tu nivel de experiencia?",
      fields: ["Principiante", "Intermedio", "Avanzado"],
    },
    {
      title: "¿Cómo prefieres trabajar?",
      fields: [
        "Sesiones individuales",
        "Sesiones grupales",
        "Consultoría online",
        "Presencial",
      ],
    },
  ];

  if (submitted) {
    return (
      <div className="bg-neutral-50 rounded-[2rem] p-10 text-center border border-neutral-100">
        <div className="w-16 h-16 bg-black text-white rounded-full flex items-center justify-center mx-auto mb-6">
          <svg
            className="w-8 h-8"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h3 className="text-2xl font-medium tracking-tight text-black mb-3">
          ¡Gracias por tu interés!
        </h3>
        <p className="text-neutral-500 font-light">
          Próximamente podrás completar este formulario para agendar tu cita.
        </p>
      </div>
    );
  }

  const currentStep = steps[step];

  return (
    <div className="bg-neutral-50 rounded-[2rem] p-10 border border-neutral-100">
      <div className="flex items-center justify-between mb-8">
        {steps.map((_, i) => (
          <div
            key={i}
            className={`w-10 h-10 rounded-full flex items-center justify-center text-sm transition-colors duration-300 ${
              i <= step
                ? "bg-black text-white font-medium"
                : "bg-neutral-200 text-neutral-400 font-light"
            }`}
          >
            0{i + 1}
          </div>
        ))}
      </div>

      <h3 className="text-xl font-medium tracking-tight text-black mb-6">
        {currentStep.title}
      </h3>

      <div className="space-y-4 mb-8">
        {currentStep.fields.map((field) => (
          <button
            key={field}
            onClick={() => {
              if (step < steps.length - 1) {
                setStep(step + 1);
              } else {
                setSubmitted(true);
              }
            }}
            className="w-full text-left px-6 py-4 rounded-2xl border border-neutral-200 bg-white hover:border-black hover:shadow-lg transition-all duration-300 text-neutral-600 font-light hover:text-black"
          >
            {field}
          </button>
        ))}
      </div>

      {step > 0 && (
        <button
          onClick={() => setStep(step - 1)}
          className="text-sm font-medium text-neutral-400 hover:text-black transition-colors"
        >
          ← Volver
        </button>
      )}
    </div>
  );
}
