'use client';

import Image from 'next/image';
import logo2 from '../public/Graet_Logo.svg'

export const LogoHeader: React.FC = () => (
  <div className="flex justify-center mb-8">
    <Image
      src={logo2}
      alt="GRAET Logo"
      width={150}
      height={40}
      priority
    />
  </div>
);