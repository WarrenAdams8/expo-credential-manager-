class MockCodedError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'CodedError';
  }
}

const createMock = (platform: string, nativeModule: unknown) => ({
  Platform: { OS: platform },
  requireOptionalNativeModule: jest.fn(() => nativeModule),
  CodedError: MockCodedError,
});

describe('CredentialManagerModule', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  describe('on iOS (unsupported platform)', () => {
    beforeEach(() => {
      jest.doMock('expo-modules-core', () => createMock('ios', null));
    });

    it('isAvailable returns false', async () => {
      const { isAvailable } = await import('../CredentialManagerModule');
      expect(await isAvailable()).toBe(false);
    });

    it('createPasskey throws E_UNSUPPORTED_PLATFORM', async () => {
      const { createPasskey } = await import('../CredentialManagerModule');
      await expect(createPasskey('{}')).rejects.toMatchObject({
        code: 'E_UNSUPPORTED_PLATFORM',
      });
    });

    it('createPassword throws E_UNSUPPORTED_PLATFORM', async () => {
      const { createPassword } = await import('../CredentialManagerModule');
      await expect(createPassword('user', 'pass')).rejects.toMatchObject({
        code: 'E_UNSUPPORTED_PLATFORM',
      });
    });

    it('getCredential throws E_UNSUPPORTED_PLATFORM', async () => {
      const { getCredential } = await import('../CredentialManagerModule');
      await expect(getCredential({ password: true })).rejects.toMatchObject({
        code: 'E_UNSUPPORTED_PLATFORM',
      });
    });

    it('signInWithGoogle throws E_UNSUPPORTED_PLATFORM', async () => {
      const { signInWithGoogle } = await import('../CredentialManagerModule');
      await expect(signInWithGoogle({})).rejects.toMatchObject({
        code: 'E_UNSUPPORTED_PLATFORM',
      });
    });

    it('clearCredentialState throws E_UNSUPPORTED_PLATFORM', async () => {
      const { clearCredentialState } = await import('../CredentialManagerModule');
      await expect(clearCredentialState()).rejects.toMatchObject({
        code: 'E_UNSUPPORTED_PLATFORM',
      });
    });
  });

  describe('on Android with native module', () => {
    const mockNativeModule = {
      isAvailable: jest.fn(() => Promise.resolve(true)),
      createPasskey: jest.fn(),
      createPassword: jest.fn(),
      getCredential: jest.fn(),
      signInWithGoogle: jest.fn(),
      clearCredentialState: jest.fn(),
    };

    beforeEach(() => {
      jest.doMock('expo-modules-core', () => createMock('android', mockNativeModule));
      Object.values(mockNativeModule).forEach(fn => fn.mockClear());
    });

    it('isAvailable returns true when native module available', async () => {
      const { isAvailable } = await import('../CredentialManagerModule');
      expect(await isAvailable()).toBe(true);
    });

    describe('createPasskey validation', () => {
      it('throws E_INVALID_INPUT for empty requestJson', async () => {
        const { createPasskey } = await import('../CredentialManagerModule');
        await expect(createPasskey('')).rejects.toMatchObject({
          code: 'E_INVALID_INPUT',
        });
      });

      it('throws E_INVALID_INPUT for whitespace-only requestJson', async () => {
        const { createPasskey } = await import('../CredentialManagerModule');
        await expect(createPasskey('   ')).rejects.toMatchObject({
          code: 'E_INVALID_INPUT',
        });
      });

      it('calls native module with valid requestJson', async () => {
        mockNativeModule.createPasskey.mockResolvedValue({ type: 'publicKey', responseJson: '{}' });
        const { createPasskey } = await import('../CredentialManagerModule');
        await createPasskey('{"challenge":"abc"}');
        expect(mockNativeModule.createPasskey).toHaveBeenCalledWith('{"challenge":"abc"}');
      });
    });

    describe('createPassword validation', () => {
      it('throws E_INVALID_INPUT for blank username', async () => {
        const { createPassword } = await import('../CredentialManagerModule');
        await expect(createPassword('', 'pass')).rejects.toMatchObject({
          code: 'E_INVALID_INPUT',
        });
      });

      it('throws E_INVALID_INPUT for whitespace-only username', async () => {
        const { createPassword } = await import('../CredentialManagerModule');
        await expect(createPassword('   ', 'pass')).rejects.toMatchObject({
          code: 'E_INVALID_INPUT',
        });
      });

      it('throws E_INVALID_INPUT for blank password', async () => {
        const { createPassword } = await import('../CredentialManagerModule');
        await expect(createPassword('user', '')).rejects.toMatchObject({
          code: 'E_INVALID_INPUT',
        });
      });

      it('throws E_INVALID_INPUT for whitespace-only password', async () => {
        const { createPassword } = await import('../CredentialManagerModule');
        await expect(createPassword('user', '   ')).rejects.toMatchObject({
          code: 'E_INVALID_INPUT',
        });
      });

      it('calls native module with valid credentials', async () => {
        mockNativeModule.createPassword.mockResolvedValue({ type: 'password' });
        const { createPassword } = await import('../CredentialManagerModule');
        await createPassword('user@example.com', 'securePass123');
        expect(mockNativeModule.createPassword).toHaveBeenCalledWith('user@example.com', 'securePass123');
      });
    });

    describe('getCredential validation', () => {
      it('throws E_INVALID_OPTIONS when no options provided', async () => {
        const { getCredential } = await import('../CredentialManagerModule');
        await expect(getCredential({} as any)).rejects.toMatchObject({
          code: 'E_INVALID_OPTIONS',
        });
      });

      it('throws E_INVALID_OPTIONS for empty-string publicKeyRequestJson', async () => {
        const { getCredential } = await import('../CredentialManagerModule');
        await expect(getCredential({ publicKeyRequestJson: '' } as any)).rejects.toMatchObject({
          code: 'E_INVALID_OPTIONS',
        });
      });

      it('throws E_INVALID_OPTIONS for whitespace-only publicKeyRequestJson', async () => {
        const { getCredential } = await import('../CredentialManagerModule');
        await expect(getCredential({ publicKeyRequestJson: '   ' } as any)).rejects.toMatchObject({
          code: 'E_INVALID_OPTIONS',
        });
      });

      it('accepts password option', async () => {
        mockNativeModule.getCredential.mockResolvedValue({ type: 'password', id: 'user', password: 'pass' });
        const { getCredential } = await import('../CredentialManagerModule');
        await getCredential({ password: true });
        expect(mockNativeModule.getCredential).toHaveBeenCalledWith({ password: true });
      });

      it('accepts publicKeyRequestJson option', async () => {
        mockNativeModule.getCredential.mockResolvedValue({ type: 'publicKey', responseJson: '{}' });
        const { getCredential } = await import('../CredentialManagerModule');
        await getCredential({ publicKeyRequestJson: '{}' });
        expect(mockNativeModule.getCredential).toHaveBeenCalledWith({ publicKeyRequestJson: '{}' });
      });

      it('accepts googleId option', async () => {
        mockNativeModule.getCredential.mockResolvedValue({ type: 'google', idToken: 'token', userId: 'id' });
        const { getCredential } = await import('../CredentialManagerModule');
        await getCredential({ googleId: { serverClientId: 'client-id' } });
        expect(mockNativeModule.getCredential).toHaveBeenCalledWith({ googleId: { serverClientId: 'client-id' } });
      });

      it('omits blank publicKeyRequestJson when other options are present', async () => {
        mockNativeModule.getCredential.mockResolvedValue({ type: 'password', id: 'user', password: 'pass' });
        const { getCredential } = await import('../CredentialManagerModule');
        await getCredential({ publicKeyRequestJson: '   ', password: true } as any);
        expect(mockNativeModule.getCredential).toHaveBeenCalledWith({ password: true });
      });
    });

    describe('signInWithGoogle', () => {
      it('calls native module with options', async () => {
        mockNativeModule.signInWithGoogle.mockResolvedValue({ type: 'google', idToken: 'token', userId: 'id' });
        const { signInWithGoogle } = await import('../CredentialManagerModule');
        await signInWithGoogle({ serverClientId: 'client-id', nonce: 'abc' });
        expect(mockNativeModule.signInWithGoogle).toHaveBeenCalledWith({ serverClientId: 'client-id', nonce: 'abc' });
      });
    });

    describe('clearCredentialState', () => {
      it('calls native module', async () => {
        mockNativeModule.clearCredentialState.mockResolvedValue(undefined);
        const { clearCredentialState } = await import('../CredentialManagerModule');
        await clearCredentialState();
        expect(mockNativeModule.clearCredentialState).toHaveBeenCalled();
      });
    });

    describe('native error propagation', () => {
      it('propagates native E_CANCELLED error from getCredential', async () => {
        mockNativeModule.getCredential.mockRejectedValue(
          new MockCodedError('E_CANCELLED', 'User cancelled.')
        );
        const { getCredential } = await import('../CredentialManagerModule');
        await expect(getCredential({ password: true })).rejects.toMatchObject({
          code: 'E_CANCELLED',
        });
      });

      it('propagates native E_NO_CREDENTIAL error from getCredential', async () => {
        mockNativeModule.getCredential.mockRejectedValue(
          new MockCodedError('E_NO_CREDENTIAL', 'No credentials available.')
        );
        const { getCredential } = await import('../CredentialManagerModule');
        await expect(getCredential({ password: true })).rejects.toMatchObject({
          code: 'E_NO_CREDENTIAL',
        });
      });

      it('propagates native error from createPasskey', async () => {
        mockNativeModule.createPasskey.mockRejectedValue(
          new MockCodedError('E_CREATE_CREDENTIAL', 'Create failed.')
        );
        const { createPasskey } = await import('../CredentialManagerModule');
        await expect(createPasskey('{}')).rejects.toMatchObject({
          code: 'E_CREATE_CREDENTIAL',
        });
      });
    });
  });

  describe('on Android without native module', () => {
    beforeEach(() => {
      jest.doMock('expo-modules-core', () => createMock('android', null));
    });

    it('isAvailable returns false', async () => {
      const { isAvailable } = await import('../CredentialManagerModule');
      expect(await isAvailable()).toBe(false);
    });

    it('createPasskey throws E_UNSUPPORTED_PLATFORM with module-not-found message', async () => {
      const { createPasskey } = await import('../CredentialManagerModule');
      await expect(createPasskey('{}')).rejects.toMatchObject({
        code: 'E_UNSUPPORTED_PLATFORM',
        message: expect.stringContaining('native module not found'),
      });
    });

    it('getCredential throws E_UNSUPPORTED_PLATFORM', async () => {
      const { getCredential } = await import('../CredentialManagerModule');
      await expect(getCredential({ password: true })).rejects.toMatchObject({
        code: 'E_UNSUPPORTED_PLATFORM',
      });
    });
  });
});
