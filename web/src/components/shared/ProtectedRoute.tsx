import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { status } = useAuth();

  if (status === 'idle' || status === 'loading') {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Carregando...
      </div>
    );
  }
  if (status === 'unauthenticated') return <Navigate to="/login" replace />;
  return <>{children}</>;
}
