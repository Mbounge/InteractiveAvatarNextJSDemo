"use client";
import { useState } from "react";
import { EnterCode } from "@/components/EnterCode";
import { FilterStep } from "@/components/FilterStep";
import { RankingStep } from "@/components/RankingStep";

// import Home from "@/components/home";

export default function App() {
  const [step, setStep] = useState<'code' | 'filter' | 'ranking'>('code');
  const [code, setCode] = useState('');
  const [year, setYear] = useState<number>(2011);
  const [position, setPosition] = useState<'G' | 'D' | 'F'>('F');


  return (
    <main className="min-h-[90dvh] flex flex-col items-center justify-center ">
      {step === 'code' && (
        <EnterCode
          code={code}
          onChange={setCode}
          onContinue={() => setStep('filter')}
        />
      )}
      {step === 'filter' && (
        <FilterStep
          year={year}
          position={position}
          onYearSelect={setYear}
          onPositionSelect={setPosition}
          onContinue={() => setStep('ranking')}
        />
      )}
      {step === 'ranking' && (
        <RankingStep
          year={year}
          position={position}
          onBack={() => setStep('filter')}
        />
      )}
    </main>
  );
}