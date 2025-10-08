import * as bcrypt from 'bcrypt';

export class PasswordUtil {
    private static readonly SALT_ROUNDS = 10;

    /**
     * Hash password menggunakan bcrypt
     */
    static async hashPassword(password: string): Promise<string> {
        return bcrypt.hash(password, this.SALT_ROUNDS);
    }

    /**
     * Compare plain password dengan hashed password
     */
    static async comparePassword(
        plainPassword: string,
        hashedPassword: string,
    ): Promise<boolean> {
        return bcrypt.compare(plainPassword, hashedPassword);
    }

    /**
     * Validate password requirements
     * - Min 8 characters
     * - At least 1 uppercase letter
     * - At least 1 lowercase letter
     * - At least 1 number
     * - At least 1 special character
     */
    static validatePasswordRequirements(password: string): {
        isValid: boolean;
        errors: string[];
    } {
        const errors: string[] = [];

        if (password.length < 8) {
            errors.push('Password must be at least 8 characters long');
        }

        if (!/[A-Z]/.test(password)) {
            errors.push('Password must contain at least one uppercase letter');
        }

        if (!/[a-z]/.test(password)) {
            errors.push('Password must contain at least one lowercase letter');
        }

        if (!/[0-9]/.test(password)) {
            errors.push('Password must contain at least one number');
        }

        if (!/[!@#$%^&*]/.test(password)) {
            errors.push('Password must contain at least one special character (!@#$%^&*)');
        }

        return {
            isValid: errors.length === 0,
            errors,
        };
    }
}