"use client";

import { useState, useSyncExternalStore, type FormEvent } from "react";
import Link from "next/link";
import { Button, PasswordInput, TextInput } from "@carbon/react";

function subscribeToHash(callback: () => void) {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}

export default function ResetPasswordPage() {
  const token = useSyncExternalStore(
    subscribeToHash,
    () => new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "",
    () => "",
  );
  const [passwordChanged, setPasswordChanged] = useState(false);

  function confirmSuccess() {
    setPasswordChanged(true);
    window.history.replaceState(null, "", window.location.pathname);
  }

  return (
    <main className="login-page">
      {passwordChanged ? (
        <section className="app-card app-stack">
          <h1 className="app-page__title">Reset password</h1>
          <p role="status">Your password has been updated.</p>
          <Link href="/login">Back to sign in</Link>
        </section>
      ) : (
        <ResetPasswordForm key={token} token={token} onPasswordChanged={confirmSuccess} />
      )}
    </main>
  );
}

function ResetPasswordForm({ token, onPasswordChanged }: { token: string; onPasswordChanged: () => void }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setPending(true);
    setMessage("");
    try {
      const response = await fetch(`/api/auth/reset-password/${token ? "confirm" : "request"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(token ? { token, password: fields.get("password") } : { email: fields.get("email") }),
      });
      if (!response.ok) {
        const result = await response.json();
        setMessage(result.error ?? "Unable to complete the reset request.");
        return;
      }
      if (token) {
        onPasswordChanged();
      } else {
        setDone(true);
        setMessage("If the account can receive a reset link, it will be emailed to you.");
      }
    } catch {
      setMessage("Unable to complete the reset request. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="app-card app-stack" onSubmit={submit}>
      <h1 className="app-page__title">Reset password</h1>
      {done ? null : token ? (
        <PasswordInput id="password" name="password" labelText="New password" autoComplete="new-password" minLength={12} required />
      ) : (
        <TextInput id="email" name="email" labelText="Email" type="email" autoComplete="username" required />
      )}
      {message && <p role="status">{message}</p>}
      {!done && <Button type="submit" disabled={pending}>{token ? "Set password" : "Send reset link"}</Button>}
      <Link href="/login">Back to sign in</Link>
    </form>
  );
}
