# Firmware de teste do Coevo Smart Speaker

Este firmware testa o ciclo completo do smart speaker:

1. Conecta no Wi-Fi.
2. Conecta no WebSocket do Coevo.
3. Grava 3 segundos do microfone.
4. Envia `audio/wav` para a API.
5. A API transcreve, consulta o Coevo e gera resposta em voz.
6. O ESP32 recebe MP3 em chunks, salva em `FFat` e toca no alto-falante.

## Como montar o sketch no Arduino IDE

1. Abra o exemplo oficial `03_audio_out_no_tf`.
2. Salve como `coevo_speaker_audio_roundtrip`.
3. Copie para a mesma pasta do sketch estes arquivos do exemplo `03_audio_out_no_tf`:
   - `I2C_Driver.h`
   - `I2C_Driver.cpp`
   - `es8311.h`
   - `es8311.cpp`
   - `es8311_reg.h`
4. Copie para a mesma pasta do sketch estes arquivos do exemplo `08_esp_sr`:
   - `es7210.h`
   - `es7210.cpp`
   - `es7210_reg.h`
5. Apague o conteúdo do `.ino`.
6. Cole o conteúdo de `coevo_speaker_audio_roundtrip.ino`.
7. Troque:
   - `YOUR_DEVICE_ID`
   - `YOUR_DEVICE_API_KEY`

## Configurações da placa

- USB CDC On Boot: `Enabled`
- Flash Size: `16MB`
- PSRAM: `OPI PSRAM`
- Partition Scheme: `16M Flash (3MB APP/9.9MB FATFS)`
- Upload Speed: `921600` ou `460800`

## Teste

Abra o Serial Monitor em `115200`.

Ao ver `COEVO: pronto para ouvir.`, o firmware grava automaticamente 3 segundos.

Para repetir o teste, digite `r` no Serial Monitor e pressione Enter.

## Formatos de áudio

No MVP do dispositivo, usamos:

- entrada: `audio/wav`;
- saída: `audio/mpeg` em chunks.

O `audio/wav` é maior, mas é o caminho mais simples e confiável para o ESP32
enviar a fala capturada pelo microfone. O dispositivo só precisa empacotar o
PCM com cabeçalho WAV.

O `audio/mpeg` é usado na resposta porque o backend já gera MP3 e a biblioteca
`ESP32-audioI2S` toca esse formato sem exigir decodificador extra no nosso
código.

`OGG/Opus` fica para uma etapa futura. Ele economiza banda, mas exigiria
codificação local no ESP32 ou outro pipeline de áudio, aumentando a complexidade
antes de validarmos o ciclo principal.

## Observação de segurança

Nunca publique um firmware real com `api_key` de produção embutida em repositório
público. Cada dispositivo deve ter sua própria chave, e ela deve ser revogada no
painel se o dispositivo for perdido ou substituído.
