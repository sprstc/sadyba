/**
 * src/core/AuthGate.js
 * Bramka autoryzacji kryptograficznej (Web Crypto API SHA-256 z solą)
 * blokująca inicjalizację i renderowanie sceny WebGL 3D przed podaniem prawidłowego kodu PIN / hasła.
 */

const CRYPTO_SALT = 'DT_ARCH_1955_1966_SALT_v1:';
const SESSION_STORAGE_KEY = 'dt_arch_auth_token_v1';

// Skróty SHA-256 (z solą CRYPTO_SALT) dla autoryzowanych kodów dostępu (brak hasła jawnego w kodzie)
const ALLOWED_HASHES = [
  '633b5ed18647e2ee3f3efd32ff1f3b9fe6476a83a7e7588c1b472cea94b713e3', // PIN domyślny (4 cyfry)
];

export class AuthGate {
  constructor() {
    this.overlay = document.getElementById('auth-gate-overlay');
    this.form = document.getElementById('auth-gate-form');
    this.input = document.getElementById('auth-pin-input');
    this.errorEl = document.getElementById('auth-gate-error');
    this.submitBtn = document.getElementById('btn-auth-submit');
    this.lockBtn = document.getElementById('btn-lock-app');

    this.failedAttempts = 0;
    this.lockedUntil = 0;

    // Udostępnij narzędzie w konsoli deweloperskiej do wygenerowania nowego skrótu SHA-256 przy zmianie hasła
    window.generatePinHash = async (newPinOrPassword) => {
      const hash = await this.computeSha256(String(newPinOrPassword).trim());
      console.info('Nowy skrót SHA-256 (wklej do ALLOWED_HASHES w src/core/AuthGate.js):\n', hash);
      return hash;
    };
  }

  /**
   * Oblicza skrót SHA-256 za pomocą natywnego Web Crypto API (crypto.subtle.digest)
   */
  async computeSha256(plainText) {
    const payload = `${CRYPTO_SALT}${plainText}`;
    const msgBuffer = new TextEncoder().encode(payload);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Porównanie stałoczasowe (constant-time comparison) zapobiegające atakom czasowym
   */
  constantTimeEqual(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) {
      return false;
    }
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
      diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return diff === 0;
  }

  isHashAuthorized(candidateHash) {
    return ALLOWED_HASHES.some((allowed) => this.constantTimeEqual(candidateHash, allowed));
  }

  /**
   * Zwraca Promise, który rozwiązuje się dopiero po poprawnej autoryzacji użytkownika.
   * Przed rozwiązaniem tego Promise silnik 3D (Viewer.js) nie jest inicjalizowany.
   */
  async waitForUnlock() {
    const savedHash = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (savedHash && this.isHashAuthorized(savedHash)) {
      this.hideOverlay();
      this.bindLockButton();
      return true;
    }

    this.showOverlay();
    this.bindLockButton();

    return new Promise((resolve) => {
      const handleVerify = async (e) => {
        if (e) e.preventDefault();

        const now = Date.now();
        if (now < this.lockedUntil) {
          const secsLeft = Math.ceil((this.lockedUntil - now) / 1000);
          this.showError(`Zbyt wiele prób. Odczekaj ${secsLeft} s.`);
          return;
        }

        const rawVal = (this.input?.value || '').trim();
        if (!rawVal) {
          this.showError('Wprowadź kod PIN lub hasło dostępu.');
          return;
        }

        const candidateHash = await this.computeSha256(rawVal);

        if (this.isHashAuthorized(candidateHash)) {
          this.failedAttempts = 0;
          sessionStorage.setItem(SESSION_STORAGE_KEY, candidateHash);
          if (this.input) this.input.value = '';
          this.hideOverlay();
          resolve(true);
        } else {
          this.failedAttempts += 1;
          if (this.input) {
            this.input.value = '';
            this.input.focus();
          }
          if (this.failedAttempts >= 5) {
            this.lockedUntil = Date.now() + 15000;
            this.showError('Przekroczono limit prób. Blokada czasowa na 15 sekund.');
          } else {
            this.showError(`Nieprawidłowy kod dostępu (próba ${this.failedAttempts}/5).`);
          }
        }
      };

      this.form?.addEventListener('submit', handleVerify);

      // Obsługa przycisków klawiatury numerycznej na ekranie blokady
      document.querySelectorAll('[data-pin-digit]').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (!this.input) return;
          const digit = btn.getAttribute('data-pin-digit');
          if (digit === 'clear') {
            this.input.value = '';
            this.clearError();
          } else if (digit === 'back') {
            this.input.value = this.input.value.slice(0, -1);
          } else if (this.input.value.length < 16) {
            this.input.value += digit;
            this.clearError();
          }
          this.input.focus();
        });
      });
    });
  }

  bindLockButton() {
    this.lockBtn?.addEventListener('click', () => {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      window.location.reload();
    });
  }

  showOverlay() {
    this.overlay?.classList.remove('hidden');
    setTimeout(() => this.input?.focus(), 60);
  }

  hideOverlay() {
    this.overlay?.classList.add('hidden');
  }

  showError(msg) {
    if (!this.errorEl) return;
    this.errorEl.textContent = msg;
    this.errorEl.classList.remove('hidden');
    const card = this.overlay?.querySelector('.auth-card');
    if (card) {
      card.classList.remove('shake');
      void card.offsetWidth;
      card.classList.add('shake');
    }
  }

  clearError() {
    this.errorEl?.classList.add('hidden');
  }
}
