# Simulador de Raspberry Pi / TV kiosk

Aplicação React que representa o player executado em um Raspberry Pi conectado a uma TV. A interface segue a identidade visual do `frontend-web`, abre em modo kiosk, mantém o dispositivo online por heartbeat e busca novos alertas no backend `mobile2screen`.

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

O comando gera o build React, inicia o servidor em `0.0.0.0`, detecta o IP da rede local e abre uma janela isolada do Microsoft Edge. Leia o QR Code exibido, faça login pelo celular e selecione o dispositivo no dropdown. O `id` e o `connection_token` são mantidos somente em memória pelo kiosk.

Para sair do kiosk, pressione `Alt + F4`.

## Desenvolvimento

Execute o backend do kiosk e o Vite em terminais separados:

```powershell
npm run dev:server
npm run dev
```

O Vite fica disponível na rede pela porta `3333` e encaminha as chamadas para o processo Node interno na porta `3334`. O `frontend-web` pode continuar usando a porta `5173`. Para validar a versão de produção, use `npm run build` e `npm start`; nesse modo, interface e servidor usam juntos a porta `3333`.

O servidor Node mantém uma conexão WebSocket privada com o Laravel Reverb. Ao receber `alert.available`, ele busca o conteúdo pela API autenticada e o entrega à interface React pelo stream SSE local. Mantenha `php artisan reverb:start` em execução no backend.

O código Node está separado em:

- `server/config.mjs`: ambiente, porta e descoberta do IP local;
- `server/kiosk-service.mjs`: pareamento, backend, heartbeat e alertas;
- `server/app-server.mjs`: rotas HTTP e QR Code;
- `server/http.mjs`: leitura de payload, respostas e arquivos do React.

O simulador disponibiliza:

- `GET /health`: estado local da TV simulada;
- `GET /events`: stream SSE que entrega alertas à interface kiosk;
- `POST /api/connect`: reconecta manualmente o simulador ao backend;
- `POST /api/pair/login`: autentica a sessão temporária de pareamento;
- `POST /api/pair/devices`: lista os dispositivos do usuário autenticado;
- `POST /api/pair/select`: conecta o kiosk ao dispositivo escolhido.

O backend valida o token por dispositivo. O token não é gravado no `.env`, enviado no QR Code ou devolvido ao navegador do celular.
