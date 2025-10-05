import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authFetch } from '../utils/authFetch';

export default function Dashboard() {
  const [profile, setProfile] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const res = await authFetch('http://127.0.0.1:8000/api/profile/');
      if (res.ok) {
        setProfile(await res.json());
      } else if (res.status === 401) {
        navigate('/login', { replace: true });
      }
    })();
  }, [navigate]);

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login', { replace: true });
  };

  return (
    <div style={{ padding: 24 }}>
      <h1>Bem-vindo {profile?.username}</h1>
      <p>Email: {profile?.email}</p>
      <button onClick={handleLogout}>Logout</button>
    </div>
  );
}
