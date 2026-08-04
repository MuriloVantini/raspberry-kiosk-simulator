# Simulador de Raspberry Pi / TV kiosk

Este projeto representa o player executado em um Raspberry Pi conectado a uma TV. Ele abre uma tela em modo kiosk, mantém o dispositivo online por heartbeat e busca novos alertas no backend `mobile2screen`.

## Preparação

1. No painel mobile2screen, cadastre um dispositivo do tipo `tv` ou `rpi` e associe-o às tags desejadas.
2. Copie `.env.example` para `.env` e confirme o endereço do backend em `M2S_API_BASE_URL`.

```powershell
Copy-Item .env.example .env
```

## Executar

```powershell
npm run tv
```

O comando inicia o servidor em `0.0.0.0`, detecta o IP da rede local e abre uma janela isolada do Microsoft Edge. Leia o QR Code exibido, faça login pelo celular e selecione o dispositivo no dropdown. O `id` e o `connection_token` são mantidos somente em memória pelo kiosk.

Para sair do kiosk, pressione `Alt + F4`. Para desenvolvimento com reinício automático, execute `npm run dev` e acesse a porta 3333 pela rede.

O simulador disponibiliza:

- `GET /health`: estado local da TV simulada;
- `GET /events`: stream SSE que entrega alertas à interface kiosk;
- `POST /api/connect`: reconecta manualmente o simulador ao backend;
- `POST /api/pair/login`: autentica a sessão temporária de pareamento;
- `POST /api/pair/devices`: lista os dispositivos do usuário autenticado;
- `POST /api/pair/select`: conecta o kiosk ao dispositivo escolhido.

O backend valida o token por dispositivo. O token não é gravado no `.env`, enviado no QR Code ou devolvido ao navegador do celular.
