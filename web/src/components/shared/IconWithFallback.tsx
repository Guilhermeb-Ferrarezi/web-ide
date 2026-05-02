import { useEffect, useState } from 'react';

type Props = {
  src: string;
  fallbackSrc: string;
  alt?: string;
  role?: string;
  ariaHidden?: boolean;
  className?: string;
};

export function IconWithFallback({
  src,
  fallbackSrc,
  alt = '',
  role,
  ariaHidden,
  className,
}: Props) {
  const [currentSrc, setCurrentSrc] = useState(src);

  useEffect(() => {
    setCurrentSrc(src);
  }, [src]);

  return (
    <img
      src={currentSrc}
      alt={alt}
      role={role}
      aria-hidden={ariaHidden}
      className={className}
      onError={() => {
        if (currentSrc !== fallbackSrc) {
          setCurrentSrc(fallbackSrc);
        }
      }}
    />
  );
}
