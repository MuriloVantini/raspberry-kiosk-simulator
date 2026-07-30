# Simulador de Raspberry Pi / TV kiosk

Este projeto representa o player que seria executado em um Raspberry Pi conectado a uma TV. Ele abre uma tela em modo kiosk, mantém o dispositivo online por heartbeat e busca novos alertas no backend `mobile2screen`.

## Preparação

1. No painel mobile2screen, cadastre um dispositivo do tipo `tv` ou `rpi` e associe-o às tags desejadas.
2. Copie o `id` e o `connection_token` retornados no cadastro do dispositivo.
3. Copie `.env.example` para `.env` e preencha `M2S_DEVICE_ID` e `M2S_DEVICE_TOKEN`.

```powershell
Copy-Item .env.example .env
```

## Executar

```powershell
npm start
```

Em outro terminal, abra a TV em modo kiosk:

```powershell
npm run tv
```

O comando usa uma janela isolada do Microsoft Edge, sem fechar os navegadores que já estiverem abertos. Para sair do kiosk, pressione `Alt + F4`. Para desenvolvimento com reinício automático, execute `npm run dev`.

O simulador disponibiliza:

- `GET /health`: estado local da TV simulada;
- `GET /events`: stream SSE que entrega alertas à interface kiosk;
- `POST /api/connect`: reconecta manualmente o simulador ao backend.

Ele consulta a API periodicamente e não depende de WebSocket, permitindo demonstrar o fluxo em um computador comum. O backend valida o token por dispositivo em vez de expor um token de usuário.
