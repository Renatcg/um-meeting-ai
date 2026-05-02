# apps/web

Frontend do UM Meeting AI.

## Responsabilidades

- Tela de entrada e lobby da reuniao.
- Experiencia da sala de video com LiveKit.
- Interface para notas, transcricao e resumo.
- Mensagens privadas do UM Copilot para o comercial.
- Configuracoes basicas de reuniao e participantes.

## Stack planejada

- Next.js
- React
- Tailwind
- LiveKit React SDK

## Sprint 1

Implementa:

- pagina inicial para criar reuniao;
- rota `/meeting/[id]`;
- formulario de nome e e-mail;
- aceite LGPD obrigatorio;
- entrada em sala LiveKit com audio e video.

## Rodando localmente

```bash
npm install
npm run dev:web
```
