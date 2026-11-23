import { expect, test } from "@playwright/test";

test("login screen renders", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Digital Roadmap Projects Management Center" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Forgot password?" })).toBeVisible();
});

test("opening a reset link replaces the completed request form", async ({ page }) => {
  await page.route("**/api/auth/reset-password/request", (route) => route.fulfill({ json: { success: true } }));
  await page.goto("/reset-password");
  await page.getByLabel("Email", { exact: true }).fill("test@example.com");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("status")).toContainText("it will be emailed");
  await page.evaluate(() => {
    window.location.hash = "token=" + "f".repeat(64);
  });
  await expect(page.getByLabel("New password", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Set password" })).toBeVisible();
});
