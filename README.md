# 🎨 FujiHub Frontend

Este é o **frontend do FujiHub**, desenvolvido em **React + Vite**, responsável pela interface web que consome a API do backend (Django REST Framework).  
O projeto foi estruturado para oferecer **rapidez, modularidade e integração fluida** com o backend.

---

## 🚀 Tecnologias

- [React 18](https://react.dev/)
- [Vite](https://vitejs.dev/) para build e dev server
- [React Router](https://reactrouter.com/) para navegação SPA
- [Axios ou Fetch API](https://axios-http.com/) para comunicação com o backend
- [CSS Modules / Tailwind / Styled Components] (dependendo do que você escolher) para estilização

---

## ⚙️ Configuração do ambiente

### 1. Clone o repositório

```bash
git clone git@github.com:emilioeiji/fujiHub-web.git
cd fujiHub/web
```

````

### 2. Instale as dependências

```bash
npm install
```

### 3. Execute o servidor de desenvolvimento

```bash
npm run dev
```

O frontend estará disponível em:
👉 `http://127.0.0.1:5173`

---

## 📡 Integração com o Backend

- O backend roda em `http://127.0.0.1:8000`
- O frontend consome os endpoints da API, por exemplo:
  - `POST /api/token/` → login (JWT)
  - `GET /api/profile/` → dados do usuário autenticado

⚠️ Certifique-se de que o **CORS** está habilitado no backend para permitir chamadas do frontend.

---

## 🗂️ Estrutura de pastas

```
web/
├── public/          # Arquivos estáticos
├── src/
│   ├── assets/      # Imagens, ícones, fontes
│   ├── components/  # Componentes reutilizáveis
│   ├── pages/       # Páginas principais
│   ├── services/    # Comunicação com API
│   ├── styles/      # Estilos globais
│   └── main.jsx     # Ponto de entrada
├── index.html
├── package.json
└── README.md
```

---

## 🧪 Scripts úteis

- `npm run dev` → inicia o servidor de desenvolvimento
- `npm run build` → gera versão de produção
- `npm run preview` → pré-visualiza o build localmente

---

## 🎯 Roadmap

- [ ] Integração completa com autenticação JWT
- [ ] Dashboard inicial conectado ao backend
- [ ] Tema visual unificado com branding FujiHub
- [ ] Deploy integrado (Netlify/Vercel ou via Django static)

---

## 📜 Licença

Este projeto é de uso interno do **FujiHub**.

```

---
```
````
