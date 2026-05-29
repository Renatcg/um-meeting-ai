# Coevo em smart speaker

O canal de smart speaker usa o mesmo Coevo configurado no sistema: perfil,
personalidade, voz, memória e permissões do agente.

## URL

Em produção, a URL fica no formato:

```text
wss://um-meeting-ai-production.up.railway.app/agent/speaker/ws
```

Em desenvolvimento local:

```text
ws://localhost:8000/agent/speaker/ws
```

## Cadastro do dispositivo

Cada smart speaker deve ser cadastrado no painel Coevo, em **Smart Speakers**.
Ao cadastrar, o sistema gera:

- `device_id`;
- `api_key` exclusiva daquele dispositivo.

A `api_key` aparece apenas uma vez. Se ela for perdida, gere um novo token no
painel e atualize o dispositivo.

O painel também guarda as configurações que o ESP32 deve buscar:

- organização;
- nome do dispositivo;
- agente vinculado;
- logo;
- volume;
- brilho;
- idioma.

O Wi-Fi não é salvo no Coevo. Ele deve ser configurado localmente pelo portal do
próprio ESP32.

## Autenticação

Configure no Railway:

```env
SMART_SPEAKER_API_KEY=um-token-longo-e-secreto
```

`SMART_SPEAKER_API_KEY` continua existindo como fallback de desenvolvimento. Em
produção, prefira sempre `device_id` + `api_key` por dispositivo.

O jeito mais seguro é abrir o WebSocket sem token na URL e mandar a primeira
mensagem assim:

```json
{
  "type": "auth",
  "device_id": "spk_xxxxxxxxxxxx",
  "api_key": "api-key-do-dispositivo"
}
```

Também funciona enviar `device_id` na query string e `api_key` por header
`x-agent-api-key`, quando o dispositivo suportar headers customizados.

## Buscar configuração

O ESP32 pode buscar sua configuração antes de abrir o WebSocket:

```bash
curl "https://um-meeting-ai-production.up.railway.app/smart-speakers/spk_xxxxxxxxxxxx/config" \
  -H "x-agent-api-key: api-key-do-dispositivo"
```

A resposta traz:

```json
{
  "device_id": "spk_xxxxxxxxxxxx",
  "name": "Sala comercial",
  "organization_id": "default",
  "agent_id": "coevo",
  "logo_url": "https://...",
  "volume": 70,
  "brightness": 80,
  "language": "pt-BR"
}
```

## Protocolo

Depois da autenticação, a API responde:

```json
{
  "type": "ready",
  "session_id": "voice-...",
  "output_audio": "mp3_base64",
  "device": {
    "device_id": "spk_xxxxxxxxxxxx",
    "name": "Sala comercial",
    "volume": 70,
    "brightness": 80,
    "language": "pt-BR"
  }
}
```

Para configurar a sessão:

```json
{
  "type": "start",
  "session_id": "speaker-sala-diretoria",
  "organization_id": "default",
  "user_id": "host-123",
  "user_name": "Renato",
  "user_email": "renato@empresa.com",
  "mimetype": "audio/wav"
}
```

O padrão do canal é `audio/wav`, porque é o formato mais simples para o ESP32
enviar no primeiro MVP. Depois podemos otimizar para Opus/streaming.

Para enviar áudio, o dispositivo pode mandar frames binários e, ao fim da fala,
confirmar:

```json
{
  "type": "audio_commit"
}
```

Também pode mandar áudio em base64:

```json
{
  "type": "audio_chunk",
  "audio_base64": "...",
  "final": true
}
```

A resposta vem com texto e áudio:

```json
{
  "type": "response",
  "text": "Resposta do Coevo",
  "audio_base64": "...",
  "audio_mimetype": "audio/mpeg",
  "memory_count": 2
}
```

## Segurança

- Use sempre `wss://` em produção.
- Não coloque o token em app público ou firmware distribuído sem proteção.
- Prefira autenticar na primeira mensagem ou via header, não por query string.
- Use um token próprio por dispositivo e rotacione se o dispositivo for perdido
  ou substituído.
- Revogue o token no painel quando um dispositivo sair de operação.
- O WebSocket só devolve a fala do Coevo; a memória e permissões continuam
  centralizadas na API.

## Teste sem o dispositivo

Antes de gravar o firmware no ESP32, valide que o backend já responde em texto
e áudio:

```bash
curl -X POST "https://um-meeting-ai-production.up.railway.app/agent/speaker/test" \
  -H "Content-Type: application/json" \
  -H "x-agent-api-key: $SMART_SPEAKER_API_KEY" \
  -d '{
    "text": "Coevo, confirme em uma frase curta que o canal do smart speaker esta funcionando.",
    "session_id": "smart-speaker-test",
    "organization_id": "default",
    "user_id": "renato",
    "user_name": "Renato",
    "user_email": "renato@empresa.com"
  }'
```

A resposta deve trazer:

```json
{
  "session_id": "smart-speaker-test",
  "text": "resposta do Coevo",
  "audio_base64": "...",
  "audio_mimetype": "audio/mpeg",
  "memory_count": 0
}
```
