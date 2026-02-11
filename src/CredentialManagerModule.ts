import { CodedError, Platform, requireOptionalNativeModule } from 'expo-modules-core';
import type {
  CreatePasskeyResult,
  GetCredentialOptions,
  GetCredentialResult,
  GoogleCredential,
  NativeCredentialManagerModule,
  SignInWithGoogleOptions,
} from './CredentialManager.types';
import { CredentialManagerErrorCodes } from './CredentialManager.types';

const NativeModule =
  requireOptionalNativeModule<NativeCredentialManagerModule>('CredentialManager');

function ensureAvailable(): NativeCredentialManagerModule {
  if (Platform.OS !== 'android') {
    throw new CodedError(
      CredentialManagerErrorCodes.E_UNSUPPORTED_PLATFORM,
      'CredentialManager is only available on Android.'
    );
  }
  if (!NativeModule) {
    throw new CodedError(
      CredentialManagerErrorCodes.E_UNSUPPORTED_PLATFORM,
      'CredentialManager native module not found. Ensure the package is installed and the app has been rebuilt.'
    );
  }
  return NativeModule;
}

function hasAtLeastOneOption(options: GetCredentialOptions): boolean {
  const hasPublicKey =
    typeof options.publicKeyRequestJson === 'string' &&
    options.publicKeyRequestJson.trim() !== '';
  const hasPassword = options.password === true;
  const hasGoogle = options.googleId != null;
  return hasPublicKey || hasPassword || hasGoogle;
}

function normalizeGetCredentialOptions(options: GetCredentialOptions): GetCredentialOptions {
  if (
    typeof options.publicKeyRequestJson === 'string' &&
    options.publicKeyRequestJson.trim() === ''
  ) {
    const { publicKeyRequestJson: _ignored, ...rest } = options;
    return rest as GetCredentialOptions;
  }
  return options;
}

export async function isAvailable(): Promise<boolean> {
  if (Platform.OS !== 'android' || !NativeModule) {
    return false;
  }
  return await NativeModule.isAvailable();
}

export async function createPasskey(requestJson: string): Promise<CreatePasskeyResult> {
  const native = ensureAvailable();
  if (!requestJson || requestJson.trim() === '') {
    throw new CodedError(
      CredentialManagerErrorCodes.E_INVALID_INPUT,
      'requestJson cannot be blank.'
    );
  }
  return await native.createPasskey(requestJson);
}

export async function createPassword(username: string, password: string): Promise<{ type: 'password' }> {
  const native = ensureAvailable();
  if (!username || username.trim() === '') {
    throw new CodedError(
      CredentialManagerErrorCodes.E_INVALID_INPUT,
      'Username cannot be blank.'
    );
  }
  if (!password || password.trim() === '') {
    throw new CodedError(
      CredentialManagerErrorCodes.E_INVALID_INPUT,
      'Password cannot be blank.'
    );
  }
  return await native.createPassword(username, password);
}

export async function getCredential(options: GetCredentialOptions): Promise<GetCredentialResult> {
  const native = ensureAvailable();
  const normalizedOptions = normalizeGetCredentialOptions(options);
  if (!hasAtLeastOneOption(normalizedOptions)) {
    throw new CodedError(
      CredentialManagerErrorCodes.E_INVALID_OPTIONS,
      'At least one of publicKeyRequestJson, password, or googleId must be provided.'
    );
  }
  return await native.getCredential(normalizedOptions);
}

export async function signInWithGoogle(options: SignInWithGoogleOptions): Promise<GoogleCredential> {
  const native = ensureAvailable();
  return await native.signInWithGoogle(options);
}

export async function clearCredentialState(): Promise<void> {
  const native = ensureAvailable();
  await native.clearCredentialState();
}
