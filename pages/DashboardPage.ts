import { Page, Locator, expect } from '@playwright/test';

/** Page Object for the main screen after login (header + profile menu). */
export class DashboardPage {
  readonly page: Page;
  readonly greeting: Locator;
  readonly profileButton: Locator;
  readonly signOutButton: Locator;
  readonly changePassword: Locator;

  constructor(page: Page) {
    this.page = page;
    this.greeting = page.getByRole('heading', { name: /^Good (morning|afternoon|evening)/ });
    this.profileButton = page.getByRole('button', { name: 'Open your profile' });
    this.signOutButton = page.getByRole('button', { name: 'Sign out' });
    this.changePassword = page.getByText('Change password');
  }

  /** Wait until the dashboard is really loaded (login can be slow on the free server) */
  async waitUntilLoaded() {
    await expect(this.page).toHaveURL(/\/dashboard/, { timeout: 60_000 });
    await expect(this.greeting).toBeVisible({ timeout: 30_000 });
  }

  async openProfile() {
    await this.profileButton.click();
  }

  async signOut() {
    await this.openProfile();
    await this.signOutButton.click();
  }

  /** Is the login token present in this tab? */
  async hasToken(): Promise<boolean> {
    return this.page.evaluate(() => !!sessionStorage.getItem('token'));
  }
}
