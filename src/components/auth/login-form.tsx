"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button, InlineLoading, PasswordInput, TextInput } from "@carbon/react";

export function LoginForm() {
  const [email, setEmail] = useState("admin@imkan.local");
  const [password, setPassword] = useState("ChangeMe123!");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      email,
      password,
      callbackUrl: "/dashboard",
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Unable to sign in with the provided credentials.");
      return;
    }

    window.location.href = result?.url ?? "/dashboard";
  }

  return (
    <form onSubmit={handleSubmit} className="app-card app-stack" style={{ maxWidth: "28rem" }}>
      <div>
        <p className="app-page__eyebrow">Secure access</p>
        <h1 className="app-page__title" style={{ fontSize: "2.5rem" }}>
          Sign in
        </h1>
        <p className="app-page__subtitle">
          Use the seeded admin account first, then create and assign PM users from the admin console.
        </p>
      </div>
      <TextInput
        id="email"
        labelText="Email"
        value={email}
        onChange={(event) => setEmail(event.currentTarget.value)}
      />
      <PasswordInput
        id="password"
        labelText="Password"
        value={password}
        onChange={(event) => setPassword(event.currentTarget.value)}
      />
      {error ? <p style={{ color: "#da1e28", margin: 0 }}>{error}</p> : null}
      <div className="app-inline-actions">
        <Button type="submit" disabled={loading}>
          Sign in
        </Button>
        {loading ? <InlineLoading description="Authenticating..." /> : null}
      </div>
    </form>
  );
}
