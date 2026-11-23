"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { Button, InlineLoading, PasswordInput, TextInput } from "@carbon/react";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await signIn("credentials", {
        email,
        password,
        callbackUrl: "/project-status",
        redirect: false,
      });
      if (!result?.ok || result.error) {
        setError("Unable to sign in with the provided credentials.");
        return;
      }
      window.location.href = "/project-status";
    } catch {
      setError("Sign-in failed. Please try again.");
    } finally {
      setLoading(false);
    }
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
        type="email"
        autoComplete="username"
        required
        value={email}
        onChange={(event) => setEmail(event.currentTarget.value)}
      />
      <PasswordInput
        id="password"
        labelText="Password"
        autoComplete="current-password"
        required
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
      <Link href="/reset-password">Forgot password?</Link>
    </form>
  );
}
