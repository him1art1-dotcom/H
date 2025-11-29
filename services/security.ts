// src/services/security.ts

// Helper: Convert ArrayBuffer/Uint8Array to Hex String
// Fix: We use 'any' here to accept both ArrayBuffer and Uint8Array without TS complaints
function toHex(buffer: any): string {
    if (!buffer) return '';
    return Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

// Helper: Convert Hex String to Uint8Array
function fromHex(hex: string): Uint8Array {
    const bytes = new Uint8Array(Math.floor(hex.length / 2));
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return bytes;
}

/**
 * Checks if a password string is already hashed.
 * Format expected: iterations:salt:hash
 */
export function isHashed(password: string): boolean {
    return typeof password === 'string' && password.includes(':') && password.split(':').length === 3;
}

/**
 * Hashes a password using PBKDF2 (Standard Secure Algorithm)
 */
export async function hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iterations = 100000;

    // 1. Import the password as a key
    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        encoder.encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveBits", "deriveKey"]
    );

    // 2. Derive the bits (The actual hashing)
    const derivedBits = await crypto.subtle.deriveBits(
        {
            name: "PBKDF2",
            salt: salt,
            iterations: iterations,
            hash: "SHA-256"
        },
        keyMaterial,
        256
    );

    // 3. Return format: iterations:salt(hex):hash(hex)
    // Cast to 'any' to avoid strict ArrayBuffer vs Uint8Array checks
    return `${iterations}:${toHex(salt as any)}:${toHex(derivedBits as any)}`;
}

/**
 * Verifies a password against a stored hash
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
    // Basic validation
    if (!password || !storedHash) return false;

    // If stored password is plain text (legacy), compare directly
    if (!isHashed(storedHash)) {
        return password === storedHash;
    }

    try {
        const parts = storedHash.split(':');
        if (parts.length !== 3) return false;

        const [iterationsStr, saltHex, hashHex] = parts;
        const iterations = parseInt(iterationsStr, 10);
        const salt = fromHex(saltHex);
        const originalHash = fromHex(hashHex);

        const encoder = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            "raw",
            encoder.encode(password),
            { name: "PBKDF2" },
            false,
            ["deriveBits", "deriveKey"]
        );

        const derivedBits = await crypto.subtle.deriveBits(
            {
                name: "PBKDF2",
                salt: salt,
                iterations: iterations,
                hash: "SHA-256"
            },
            keyMaterial,
            256
        );

        // Compare the new hash with the old hash
        const newHash = new Uint8Array(derivedBits);
        
        if (newHash.length !== originalHash.length) return false;
        
        // Constant-time comparison simulation to prevent timing attacks
        let result = 0;
        for (let i = 0; i < newHash.length; i++) {
            result |= newHash[i] ^ originalHash[i];
        }

        return result === 0;
    } catch (e) {
        console.error("Password verification error:", e);
        return false;
    }
}
