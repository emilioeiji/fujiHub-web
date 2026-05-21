# FujiHub Web

Este é o **frontend do FujiHub**, desenvolvido em **React + Vite**, responsável pela interface web que consome a API do backend (Django REST Framework).
O projeto foi estruturado para oferecer **rapidez, modularidade e integração fluida** com o backend.

---

## Tecnologias

- [React](https://react.dev/)
- [Vite](https://vitejs.dev/) para build e dev server
- [React Router](https://reactrouter.com/) para navegação SPA
- [Axios](https://axios-http.com/) e Fetch API para comunicação com o backend

---

## Subindo o ambiente

Este projeto faz parte de um workspace com `backend`, `web`, `mobile` e `.devcontainer`.

O fluxo recomendado é:

1. Abrir a pasta raiz do workspace no VS Code.
2. Rodar **Dev Containers: Reopen in Container**.
3. Subir o backend em um terminal.
4. Subir a web em outro terminal.

Também é possível subir os containers manualmente a partir da raiz:

```bash
docker compose -f .devcontainer/docker-compose.yml up -d --build
```

---

## Rodando a web

Na pasta `web`:

```bash
cd /workspace/web
npm install
npm run dev
```

O Vite fica disponível em:

- `http://localhost:5173`
- `http://127.0.0.1:5173`

Se estiver rodando fora do Dev Container, use o mesmo comando dentro da pasta `web`:

```bash
cd web
npm install
npm run dev
```

---

## Integração com o backend

- O backend deve estar rodando em `http://127.0.0.1:8000`.
- O frontend consome os endpoints da API, por exemplo:
  - `POST /api/token/` -> login (JWT)
  - `GET /api/profile/` -> dados do usuário autenticado

O backend já está com CORS liberado para a web local.

Para subir o backend:

```bash
cd /workspace/backend
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```

---

## Scripts úteis

- `npm run dev` -> inicia o servidor de desenvolvimento
- `npm run build` -> gera versão de produção
- `npm run preview` -> pré-visualiza o build localmente
- `npm run lint` -> roda o ESLint

---

## Estrutura de pastas

```text
web/
├── public/          # Arquivos estáticos
├── src/
│   ├── assets/      # Imagens, ícones, fontes
│   ├── pages/       # Páginas principais
│   ├── hooks/       # Hooks de integração com API
│   ├── utils/       # Funções utilitárias
│   ├── App.jsx
│   └── main.jsx
├── index.html
├── package.json
└── README.md
```

---

## Observações

- Se o login ou as chamadas da API falharem, confirme primeiro se o backend está ativo em `http://127.0.0.1:8000`.
- O build de produção pode acusar erro caso a web importe dependências específicas do React Native. Nesse caso, revise os imports do arquivo indicado pelo Vite.

---

## Roadmap

- [ ] Integração completa com autenticação JWT
- [ ] Dashboard inicial conectado ao backend
- [ ] Tema visual unificado com branding FujiHub
- [ ] Deploy integrado (Netlify/Vercel ou via Django static)

---

## Licença

Este projeto é de uso interno do **FujiHub**.
