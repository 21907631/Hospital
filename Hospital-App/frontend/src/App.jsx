import React, { useEffect, useState } from 'react';
import { supabase } from './lib/supabase.js';
import './style.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function App() {
  const [health, setHealth] = useState('Checking backend...');
  const [doctors, setDoctors] = useState([]);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [session, setSession] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then((res) => res.json())
      .then((data) => setHealth(`${data.service}: ${data.status}`))
      .catch(() => setHealth('Backend not reachable'));

    fetch(`${API_URL}/api/doctors`)
      .then((res) => res.json())
      .then((data) => Array.isArray(data) ? setDoctors(data) : setError(data.error || 'Could not load doctors'))
      .catch((err) => setError(err.message));
  }, []);

  async function signIn(e) {
    e.preventDefault();
    setError('');
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) setError(authError.message);
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <main className="page">
      <section className="hero">
        <div>
          <p className="eyebrow">Hospital Appointment Scheduler</p>
          <h1>Book and manage hospital appointments</h1>
          <p className="muted">Backend status: {health}</p>
        </div>
      </section>

      <section className="grid">
        <div className="card">
          <h2>Supabase Login Test</h2>
          {session ? (
            <>
              <p>Logged in as <strong>{session.user.email}</strong></p>
              <button onClick={signOut}>Sign out</button>
            </>
          ) : (
            <form onSubmit={signIn}>
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" />
              <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" />
              <button type="submit">Sign in</button>
            </form>
          )}
        </div>

        <div className="card">
          <h2>Doctors</h2>
          {error && <p className="error">{error}</p>}
          {doctors.length === 0 && !error ? <p>No doctors loaded yet.</p> : null}
          <ul>
            {doctors.map((doctor) => (
              <li key={doctor.id}>
                <strong>{doctor.profiles?.full_name || doctor.profiles?.email || doctor.id}</strong>
                <span>{doctor.specialty}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
