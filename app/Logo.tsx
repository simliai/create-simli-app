'use client';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import React from 'react';
import logo from '../media/SimliLogoV2.svg';
import cn from './utils/TailwindMergeAndClsx';

interface Props {
  className?: string;
  children?: React.ReactNode;
}

const SimliHeaderLogo = ({ className, children }: Props) => {
  const router = useRouter();
  const pathname = usePathname();

  const handleClick = async () => {
    console.log('Clicked Simli logo', pathname);
    if (pathname === '/') {
      window.location.reload();
      return;
    }
    router.push('/');
  };

  return (
    <div className={cn('fixed top-10 left-10 z-50 cursor-pointer', className)} onClick={handleClick}>
      <Image src={logo} className='Logo' alt='Simli logo' />
    </div>
  );
};

export default SimliHeaderLogo;
