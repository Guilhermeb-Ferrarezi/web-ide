# Terminal

## QOL
- Novo comando interno `shortcuts` no terminal restrito para listar atalhos úteis.
- Atalhos documentados: `Ctrl+Shift+C`, `Ctrl+Shift+V`, `Ctrl+L` e `Ctrl+C`.

## Segurança
- O terminal restrito continua com allowlist de comandos.
- Comandos `git` agora também passam por allowlist de subcomandos locais seguros.
- Subcomandos remotos ou administrativos, como `git push`, passam a ser bloqueados para usuários sem privilégio de terminal irrestrito.

## Observação
- Usuários `terminal_superuser` continuam recebendo shell irrestrito pelo backend.
