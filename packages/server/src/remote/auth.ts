import jwt from 'jsonwebtoken';
import type { ServerConfig } from '@chrome-automation/shared';

/**
 * Simple JWT-based auth for the remote control web app.
 */
export class AuthService {
  private config: ServerConfig;

  constructor(config: ServerConfig) {
    this.config = config;
  }

  /** Verify the remote password and return a JWT */
  login(password: string): string | null {
    if (password !== this.config.remotePassword) {
      return null;
    }
    return jwt.sign(
      { role: 'remote-controller' },
      this.config.jwtSecret,
      { expiresIn: '24h' },
    );
  }

  /** Verify a JWT token */
  verify(token: string): boolean {
    try {
      jwt.verify(token, this.config.jwtSecret);
      return true;
    } catch {
      return false;
    }
  }
}
