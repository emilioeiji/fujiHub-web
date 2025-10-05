export async function authFetch(url, options = {}) {
  let access = localStorage.getItem('access');
  const refresh = localStorage.getItem('refresh');

  const doFetch = async (token) => {
    return fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: token ? `Bearer ${token}` : '',
        'Content-Type': 'application/json',
      },
    });
  };

  let res = await doFetch(access);

  if (res.status === 401 && refresh) {
    const refreshRes = await fetch('http://127.0.0.1:8000/api/token/refresh/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    });

    if (refreshRes.ok) {
      const data = await refreshRes.json();
      access = data.access;
      localStorage.setItem('access', access);
      res = await doFetch(access);
    } else {
      localStorage.clear();
      window.location.hash = '#/login';
    }
  }

  return res;
}
