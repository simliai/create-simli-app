'use client';
import Image from 'next/image';
import React from 'react';
// import logo from '../../media/simli_logo.svg';
import cn from '@/utils/CSS/TailwindMergeAndClsx';
import { usePathname, useRouter } from 'next/navigation';
import logo from '../../media/SimliLogoV2.svg';

interface Props {
  className?: string;
  children?: React.ReactNode;
}

const SimliHeaderLogo = ({ className, page, children }: Props) => {
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
    <div className={cn('', className)} onClick={handleClick}>
      <Image src={logo} className='Logo' alt='Simli logo' />
    </div>
  );
};

export default SimliHeaderLogo;
