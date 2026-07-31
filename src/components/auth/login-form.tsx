"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Image from "next/image";
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
      callbackUrl: "/project-status",
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Unable to sign in with the provided credentials.");
      return;
    }

    window.location.href = "/project-status";
  }

  return (
    <form onSubmit={handleSubmit} className="app-card app-stack" style={{ maxWidth: "28rem" }}>
      <div>
        <div className="login-form__header">
          <Image
            className="login-form__logo"
            src="/imkan-logo.png"
            alt="IMKAN"
            width={96}
            height={41}
          />
          <h1 className="app-page__title" style={{ fontSize: "1.75rem", lineHeight: 1.2 }}>
            Digital Roadmap Projects Management Center
          </h1>
        </div>
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
        <span className="login-form__byline">by</span>
        <Image
          className="login-form__saal-logo"
          src="/saal-logo.svg"
          alt="SAAL"
          width={68}
          height={22}
        />
      </div>
    </form>
  );
}
