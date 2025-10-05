import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/fujihub-main.png';
import './Login.css'; // importa o CSS

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleLogin = async () => {
    const res = await fetch('http://127.0.0.1:8000/api/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (res.ok) {
      const data = await res.json();
      localStorage.setItem('access', data.access);
      localStorage.setItem('refresh', data.refresh);
      navigate('/dashboard', { replace: true });
    } else {
      alert('Credenciais inválidas');
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <img src={logo} alt="Fuji Logo" className="login-logo" />
        <h1 className="login-title">Bem-vindo</h1>

        <input
          className="login-input"
          name="username"
          id="username"
          placeholder="Usuário"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
        />

        <input
          className="login-input"
          type="password"
          name="password"
          id="password"
          placeholder="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />

        <button className="login-button" onClick={handleLogin}>
          Entrar
        </button>
      </div>
    </div>
  );
}
