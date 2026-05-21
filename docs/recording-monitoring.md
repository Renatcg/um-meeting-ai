# Monitoramento de gravacoes

O Coevo Meet grava reunioes usando LiveKit Egress e salva o arquivo em S3/R2.
Para evitar que uma falha passe despercebida, a API expoe uma checagem de saude:

```http
GET /recordings/health
X-Agent-API-Key: <AGENT_API_KEY>
```

Quando esta tudo certo, a resposta vem com HTTP 200:

```json
{
  "healthy": true,
  "configured": true,
  "active_count": 0,
  "failed_count": 0,
  "missing_location_count": 0,
  "alerts": []
}
```

Quando a gravacao estiver desabilitada, mal configurada, falhar no LiveKit Egress
ou terminar sem URL/arquivo salvo, a resposta vem com HTTP 503. Esse status deve
ser usado por um monitor externo para disparar alerta.

## Como configurar o alerta

Use um monitor como Better Stack, UptimeRobot, Railway cron/health check ou outro
servico equivalente apontando para:

```text
https://um-meeting-ai-production.up.railway.app/recordings/health
```

Inclua o header:

```text
X-Agent-API-Key: valor_do_AGENT_API_KEY
```

Configure alerta para qualquer resposta diferente de HTTP 200.

## O que a correcao protege

- O frontend nao marca mais "gravando" apenas porque a API respondeu HTTP 200.
- A API tenta reconciliar o Egress depois de parar a gravacao, buscando status,
  duracao, tamanho e local do arquivo direto no LiveKit.
- A URL da gravacao fica vinculada na reuniao mesmo quando o webhook/stop nao
  devolve novamente a URL, desde que ela ja tenha sido registrada.
- A checagem `/recordings/health` acusa gravacoes com erro ou finalizadas sem
  arquivo salvo.

## Proximo reforco recomendado

Para producao, crie um worker separado que rode periodicamente a conciliacao de
gravacoes recentes. Assim, se a API reiniciar exatamente no fim da reuniao, o
worker ainda consegue recuperar o status do Egress e atualizar o banco.
