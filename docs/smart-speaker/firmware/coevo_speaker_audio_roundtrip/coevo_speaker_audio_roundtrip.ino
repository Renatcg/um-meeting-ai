#include <Arduino.h>
#include <WiFi.h>
#include <WiFiManager.h>
#include <WebSocketsClient.h>
#include <FFat.h>
#include <Audio.h>
#include <Wire.h>
#include <mbedtls/base64.h>

#include "ESP_I2S.h"
#include "I2C_Driver.h"
#include "es8311.h"
#include "es7210.h"

// Troque pelos dados gerados no painel Coevo.
const char *DEVICE_ID = "YOUR_DEVICE_ID";
const char *API_KEY = "YOUR_DEVICE_API_KEY";

const char *WS_HOST = "um-meeting-ai-production.up.railway.app";
const uint16_t WS_PORT = 443;
const char *WS_PATH = "/agent/speaker/ws";

#define I2S_MCK_PIN GPIO_NUM_2
#define I2S_BCK_PIN GPIO_NUM_48
#define I2S_LRCK_PIN GPIO_NUM_38
#define I2S_DOUT_PIN GPIO_NUM_47
#define I2S_DIN_PIN GPIO_NUM_39

#define I2C_PIN_SDA GPIO_NUM_11
#define I2C_PIN_SCL GPIO_NUM_10

#define MIC_SAMPLE_RATE 16000
#define MIC_SECONDS 3
#define MIC_CHANNELS 1
#define MIC_BITS 16

#define ES7210_I2C_ADDR 0x40
#define ES7210_MCLK_MULTIPLE 256

#define SPEAKER_SAMPLE_RATE 24000
#define SPEAKER_MCLK_FREQ_HZ (SPEAKER_SAMPLE_RATE * 256)
#define SPEAKER_VOLUME 70

WebSocketsClient webSocket;
I2SClass micI2S;
Audio audio;

static es7210_dev_handle_t es7210_handle = NULL;

String audioBase64Buffer = "";
bool wsReady = false;
bool authSent = false;
bool alreadySentTest = false;
bool playingAudio = false;
bool micActive = false;

void writeWavHeader(uint8_t *header, uint32_t dataSize) {
  uint32_t fileSize = dataSize + 36;
  uint32_t byteRate = MIC_SAMPLE_RATE * MIC_CHANNELS * MIC_BITS / 8;
  uint16_t blockAlign = MIC_CHANNELS * MIC_BITS / 8;

  memcpy(header, "RIFF", 4);
  header[4] = fileSize & 0xff;
  header[5] = (fileSize >> 8) & 0xff;
  header[6] = (fileSize >> 16) & 0xff;
  header[7] = (fileSize >> 24) & 0xff;

  memcpy(header + 8, "WAVE", 4);
  memcpy(header + 12, "fmt ", 4);

  header[16] = 16;
  header[17] = 0;
  header[18] = 0;
  header[19] = 0;

  header[20] = 1;
  header[21] = 0;

  header[22] = MIC_CHANNELS;
  header[23] = 0;

  header[24] = MIC_SAMPLE_RATE & 0xff;
  header[25] = (MIC_SAMPLE_RATE >> 8) & 0xff;
  header[26] = (MIC_SAMPLE_RATE >> 16) & 0xff;
  header[27] = (MIC_SAMPLE_RATE >> 24) & 0xff;

  header[28] = byteRate & 0xff;
  header[29] = (byteRate >> 8) & 0xff;
  header[30] = (byteRate >> 16) & 0xff;
  header[31] = (byteRate >> 24) & 0xff;

  header[32] = blockAlign & 0xff;
  header[33] = (blockAlign >> 8) & 0xff;

  header[34] = MIC_BITS;
  header[35] = 0;

  memcpy(header + 36, "data", 4);

  header[40] = dataSize & 0xff;
  header[41] = (dataSize >> 8) & 0xff;
  header[42] = (dataSize >> 16) & 0xff;
  header[43] = (dataSize >> 24) & 0xff;
}

String extractStringValue(const String &payload, const String &key) {
  String marker = "\"" + key + "\":";
  int start = payload.indexOf(marker);
  if (start < 0) return "";

  start += marker.length();

  while (start < payload.length() && payload[start] == ' ') {
    start++;
  }

  if (start >= payload.length() || payload[start] != '"') {
    return "";
  }

  start++;

  String value = "";
  bool escape = false;

  for (int i = start; i < payload.length(); i++) {
    char c = payload[i];

    if (escape) {
      value += c;
      escape = false;
      continue;
    }

    if (c == '\\') {
      escape = true;
      continue;
    }

    if (c == '"') {
      break;
    }

    value += c;
  }

  return value;
}

bool decodeBase64ToFile(const String &base64, const char *path) {
  size_t decodedLen = 0;

  int ret = mbedtls_base64_decode(
    NULL,
    0,
    &decodedLen,
    (const unsigned char *)base64.c_str(),
    base64.length()
  );

  if (ret != MBEDTLS_ERR_BASE64_BUFFER_TOO_SMALL) {
    Serial.printf("COEVO: erro calculando base64: %d\n", ret);
    return false;
  }

  uint8_t *decoded = (uint8_t *)ps_malloc(decodedLen);
  if (!decoded) {
    Serial.println("COEVO: sem memoria para decodificar audio");
    return false;
  }

  ret = mbedtls_base64_decode(
    decoded,
    decodedLen,
    &decodedLen,
    (const unsigned char *)base64.c_str(),
    base64.length()
  );

  if (ret != 0) {
    Serial.printf("COEVO: erro decodificando base64: %d\n", ret);
    free(decoded);
    return false;
  }

  File file = FFat.open(path, FILE_WRITE);
  if (!file) {
    Serial.println("COEVO: nao abriu arquivo para escrita");
    free(decoded);
    return false;
  }

  file.write(decoded, decodedLen);
  file.close();
  free(decoded);

  Serial.printf("COEVO: arquivo salvo: %s | bytes=%d\n", path, decodedLen);
  return true;
}

static esp_err_t initSpeakerCodec() {
  es8311_handle_t es_handle = es8311_create(I2C_NUM_0, ES8311_ADDRRES_0);

  if (!es_handle) {
    Serial.println("COEVO: falha criando ES8311");
    return ESP_FAIL;
  }

  const es8311_clock_config_t es_clk = {
    .mclk_inverted = false,
    .sclk_inverted = false,
    .mclk_from_mclk_pin = true,
    .mclk_frequency = SPEAKER_MCLK_FREQ_HZ,
    .sample_frequency = SPEAKER_SAMPLE_RATE
  };

  esp_err_t err = es8311_init(
    es_handle,
    &es_clk,
    ES8311_RESOLUTION_16,
    ES8311_RESOLUTION_16
  );

  if (err != ESP_OK) {
    Serial.printf("COEVO: erro ES8311 init: %d\n", err);
    return err;
  }

  es8311_voice_volume_set(es_handle, SPEAKER_VOLUME, NULL);
  es8311_microphone_config(es_handle, false);

  Serial.println("COEVO: speaker ES8311 pronto");
  return ESP_OK;
}

void initMicCodec() {
  Serial.println("COEVO: iniciando microfone ES7210");

  es7210_i2c_config_t es7210_i2c_conf = {
    .i2c_addr = ES7210_I2C_ADDR
  };

  esp_err_t err = es7210_new_codec(&es7210_i2c_conf, &es7210_handle);
  if (err != ESP_OK) {
    Serial.printf("COEVO: erro es7210_new_codec: %d\n", err);
    return;
  }

  es7210_codec_config_t codec_conf = {};
  codec_conf.i2s_format = ES7210_I2S_FMT_I2S;
  codec_conf.mclk_ratio = ES7210_MCLK_MULTIPLE;
  codec_conf.sample_rate_hz = MIC_SAMPLE_RATE;
  codec_conf.bit_width = ES7210_I2S_BITS_16B;
  codec_conf.mic_bias = ES7210_MIC_BIAS_2V87;
  codec_conf.mic_gain = ES7210_MIC_GAIN_36DB;
  codec_conf.flags.tdm_enable = false;

  err = es7210_config_codec(es7210_handle, &codec_conf);
  if (err != ESP_OK) {
    Serial.printf("COEVO: erro es7210_config_codec: %d\n", err);
    return;
  }

  Serial.println("COEVO: microfone ES7210 pronto");
}

bool startMic() {
  if (micActive) return true;

  micI2S.setPins(I2S_BCK_PIN, I2S_LRCK_PIN, I2S_DOUT_PIN, I2S_DIN_PIN, I2S_MCK_PIN);
  micI2S.setTimeout(1000);

  micActive = micI2S.begin(
    I2S_MODE_STD,
    MIC_SAMPLE_RATE,
    I2S_DATA_BIT_WIDTH_16BIT,
    I2S_SLOT_MODE_STEREO
  );

  Serial.printf("COEVO: mic I2S: %s\n", micActive ? "OK" : "FALHOU");
  return micActive;
}

void stopMic() {
  if (!micActive) return;

  micI2S.end();
  micActive = false;

  Serial.println("COEVO: mic I2S liberado");
}

void startSpeaker() {
  audio.setPinout(
    (int)I2S_BCK_PIN,
    (int)I2S_LRCK_PIN,
    (int)I2S_DOUT_PIN,
    (int)I2S_MCK_PIN
  );

  audio.setVolume(21);
}

void playReceivedAudio() {
  stopMic();

  if (!decodeBase64ToFile(audioBase64Buffer, "/coevo.mp3")) {
    audioBase64Buffer = "";
    startMic();
    return;
  }

  audioBase64Buffer = "";

  startSpeaker();

  Serial.println("COEVO: tocando resposta...");
  playingAudio = true;

  audio.connecttoFS(FFat, "/coevo.mp3");
}

void sendAuth() {
  String auth = "{";
  auth += "\"type\":\"auth\",";
  auth += "\"device_id\":\"";
  auth += DEVICE_ID;
  auth += "\",";
  auth += "\"api_key\":\"";
  auth += API_KEY;
  auth += "\"";
  auth += "}";

  webSocket.sendTXT(auth);
}

void recordAndSendAudio() {
  if (!wsReady) {
    Serial.println("COEVO: websocket ainda nao esta pronto");
    return;
  }

  if (playingAudio) {
    Serial.println("COEVO: aguarde terminar o audio atual");
    return;
  }

  if (!startMic()) {
    Serial.println("COEVO: microfone nao iniciou");
    return;
  }

  Serial.println();
  Serial.println("=====================================");
  Serial.println("COEVO: fale agora por 3 segundos...");
  Serial.println("=====================================");

  delay(700);

  const uint32_t dataSize = MIC_SAMPLE_RATE * MIC_SECONDS * 2;

  uint8_t header[44];
  uint8_t buffer[1024];

  writeWavHeader(header, dataSize);

  File wavFile = FFat.open("/input.wav", FILE_WRITE);
  if (!wavFile) {
    Serial.println("COEVO: nao abriu /input.wav para gravar");
    return;
  }

  wavFile.write(header, sizeof(header));

  uint32_t totalRead = 0;

  while (totalRead < dataSize) {
    size_t toRead = min((uint32_t)sizeof(buffer), dataSize - totalRead);
    size_t bytesRead = micI2S.readBytes((char *)buffer, toRead);

    if (bytesRead > 0) {
      wavFile.write(buffer, bytesRead);
      totalRead += bytesRead;
    } else {
      delay(5);
    }
  }

  wavFile.close();

  Serial.printf("COEVO: audio gravado | bytes=%d\n", totalRead);

  webSocket.sendTXT(
    "{\"type\":\"start\",\"mimetype\":\"audio/wav\",\"session_id\":\"speaker-live-test\"}"
  );

  delay(50);

  File sendFile = FFat.open("/input.wav", FILE_READ);
  if (!sendFile) {
    Serial.println("COEVO: nao abriu /input.wav para enviar");
    return;
  }

  uint32_t sent = 0;

  while (sendFile.available()) {
    size_t len = sendFile.read(buffer, sizeof(buffer));

    if (len > 0) {
      webSocket.sendBIN(buffer, len);
      sent += len;
    }

    delay(2);
  }

  sendFile.close();

  Serial.printf("COEVO: wav enviado | bytes=%d\n", sent);

  webSocket.sendTXT("{\"type\":\"audio_commit\",\"audio_mode\":\"chunked\"}");

  Serial.println("COEVO: audio enviado para o backend");
}

void webSocketEvent(WStype_t type, uint8_t *payload, size_t length) {
  if (type == WStype_CONNECTED) {
    Serial.println("COEVO: WebSocket conectado!");
    Serial.println("COEVO: aguardando pedido de autenticacao...");
    authSent = false;
    return;
  }

  if (type == WStype_DISCONNECTED) {
    Serial.println("COEVO: WebSocket desconectado.");
    wsReady = false;
    return;
  }

  if (type != WStype_TEXT) {
    return;
  }

  String msg = String((char *)payload).substring(0, length);
  String eventType = extractStringValue(msg, "type");

  Serial.printf("\nCOEVO: mensagem recebida, bytes=%d\n", length);
  Serial.printf("COEVO: tipo=%s\n", eventType.c_str());

  if (eventType == "auth_required") {
    if (!authSent) {
      Serial.println("COEVO: enviando autenticacao...");
      sendAuth();
      authSent = true;
    } else {
      Serial.println("COEVO: auth_required duplicado ignorado");
    }

    return;
  }

  if (eventType == "ready") {
    wsReady = true;

    Serial.println("COEVO: pronto para ouvir.");

    if (!alreadySentTest) {
      alreadySentTest = true;
      delay(1000);
      recordAndSendAudio();
    }

    return;
  }

  if (eventType == "transcript") {
    Serial.print("COEVO: transcricao: ");
    Serial.println(extractStringValue(msg, "text"));
    return;
  }

  if (eventType == "thinking") {
    Serial.print("COEVO: pensando sobre: ");
    Serial.println(extractStringValue(msg, "transcript"));
    return;
  }

  if (eventType == "response") {
    Serial.print("COEVO: resposta texto: ");
    Serial.println(extractStringValue(msg, "text"));
    return;
  }

  if (eventType == "audio_generating") {
    Serial.println("COEVO: gerando audio...");
    audioBase64Buffer = "";
    return;
  }

  if (eventType == "audio_start") {
    Serial.println("COEVO: inicio do audio em chunks");
    audioBase64Buffer = "";
    return;
  }

  if (eventType == "audio_chunk") {
    String chunk = extractStringValue(msg, "audio_base64");
    audioBase64Buffer += chunk;

    Serial.printf(
      "COEVO: chunk recebido | acumulado=%d chars\n",
      audioBase64Buffer.length()
    );

    return;
  }

  if (eventType == "audio_end") {
    Serial.println("COEVO: fim do audio recebido");
    playReceivedAudio();
    return;
  }

  if (eventType == "error") {
    Serial.print("COEVO: erro: ");
    Serial.println(extractStringValue(msg, "detail"));
    return;
  }
}

void audio_info(const char *info) {
  Serial.print("AUDIO: ");
  Serial.println(info);
}

void audio_eof_mp3(const char *info) {
  Serial.println("AUDIO: fim do mp3");
  playingAudio = false;
  startMic();
}

void setup() {
  Serial.begin(115200);
  delay(2000);

  Serial.println();
  Serial.println("=====================================");
  Serial.println("COEVO SMART SPEAKER AUDIO ROUNDTRIP");
  Serial.println("=====================================");

  WiFiManager wm;
  wm.setConfigPortalTimeout(180);

  bool connected = wm.autoConnect("Coevo-Speaker-Setup");

  if (!connected) {
    Serial.println("COEVO: falha no Wi-Fi. Reiniciando...");
    delay(2000);
    ESP.restart();
  }

  Serial.print("COEVO: Wi-Fi conectado: ");
  Serial.println(WiFi.localIP());

  if (!FFat.begin(true)) {
    Serial.println("COEVO: falha ao iniciar FFat");
  } else {
    Serial.println("COEVO: FFat pronto");
  }

  I2C_Init();

  initSpeakerCodec();

  Wire.begin(I2C_PIN_SDA, I2C_PIN_SCL);

  initMicCodec();
  startMic();

  webSocket.beginSSL(WS_HOST, WS_PORT, WS_PATH);
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(10000);

  Serial.println("COEVO: aguardando WebSocket...");
}

void loop() {
  webSocket.loop();
  audio.loop();

  if (Serial.available()) {
    char c = Serial.read();

    if (c == 'r' || c == 'R') {
      recordAndSendAudio();
    }
  }
}
