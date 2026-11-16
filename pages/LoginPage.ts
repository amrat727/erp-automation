import { Page, Locator, expect, Response } from '@playwright/test';

/**
 * Page Object for the login screen.
 * All "how to find things on the login page" lives here, in ONE place.
 */
export class LoginPage {
  readonly page: Page;
  readonly companyCode: Locator;
  readonly username: Locator;
  readonly password: Locator;
  readonly signInButton: Locator;
  readonly rememberMe: Locator;
  readonly rememberMeLabel: Locator;
  readonly forgotPassword: Locator;
  readonly eyeIcon: Locator;
  readonly errorInvalid: Locator;

  constructor(page: Page) {
    this.page = page;
    this.companyCode = page.getByPlaceholder('Code');
    this.username = page.getByPlaceholder('Username');
    this.password = page.getByPlaceholder('Password');
    this.signInButton = page.getByRole('button', { name: 'Sign in' });
    // custom styled toggle: the real checkbox is hidden, so find it by its HTML type
    this.rememberMe = page.locator('input[type="checkbox"]');
    this.rememberMeLabel = page.getByText('Remember me');
    this.forgotPassword = page.getByRole('link', { name: 'Forgot password?' });
    this.eyeIcon = this.password.locator('xpath=..').getByRole('button');
    this.errorInvalid = page.getByText('Invalid credentials');
  }

  /** Open the login page and wait until the form is ready */
  async open() {
    await this.page.goto('/login');
    await expect(this.signInButton).toBeVisible();
  }

  /** Fill the form (skips a field if you pass undefined) */
  async fill(code?: string, user?: string, pass?: string) {
    if (code !== undefined) await this.companyCode.fill(code);
    if (user !== undefined) await this.username.fill(user);
    if (pass !== undefined) await this.password.fill(pass);
  }

  /** Fill + click Sign in, and return the server's answer to the login request */
  async login(code: string, user: string, pass: string): Promise<Response> {
    await this.fill(code, user, pass);
    const [response] = await Promise.all([
      this.page.waitForResponse(r => r.url().includes('/auth/login')),
      this.signInButton.click(),
    ]);
    return response;
  }

  /** true if the browser considers this field valid (e.g. "required" satisfied) */
  async isFieldValid(field: Locator): Promise<boolean> {
    return field.evaluate((el: HTMLInputElement) => el.validity.valid);
  }
}
