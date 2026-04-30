import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Github } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getGithubLoginUrl } from '@/api/auth';
import { useAuth } from '@/hooks/useAuth';

export default function LoginPage() {
  const { user, status } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  useEffect(() => {
    const error = params.get('error');
    if (error) toast.error(`Falha no login: ${error}`);
  }, [params]);

  useEffect(() => {
    if (status === 'authenticated' && user) navigate('/repos', { replace: true });
  }, [status, user, navigate]);

  return (
    <div className="flex h-full items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Web IDE</CardTitle>
          <CardDescription>Edite seus repositórios direto do navegador</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full" size="lg">
            <a href={getGithubLoginUrl()}>
              <Github className="mr-2 h-4 w-4" />
              Continuar com GitHub
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
