import { ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * To merge Tailwind CSS classes
 *
 * Inspiration https://www.youtube.com/watch?v=re2JFITR7TI&t=349s
 */
const cn = (...inputs: ClassValue[]) => {
  return twMerge(clsx(inputs));
};

export default cn;
