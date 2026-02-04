import React, { useMemo, useState } from 'react';
import { Button, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Constants from 'expo-constants';
import {
  clearCredentialState,
  createPasskey,
  getCredential,
  isAvailable,
  signInWithGoogle,
} from 'expo-credential-manager';

const SERVER_CLIENT_ID = 'YOUR_SERVER_CLIENT_ID';

export default function App() {
  const [log, setLog] = useState<string[]>([]);
  const [email, setEmail] = useState('user@example.com');
  const [convexToken, setConvexToken] = useState<string | null>(null);
  const apiBaseUrl = useMemo(() => {
    if (process.env.EXPO_PUBLIC_API_BASE_URL) {
      return process.env.EXPO_PUBLIC_API_BASE_URL;
    }
    const hostUri = Constants.expoConfig?.hostUri;
    if (hostUri) {
      return `http://${hostUri}`;
    }
    return 'http://localhost:8081';
  }, []);

  const addLog = (entry: string) => {
    setLog((current) => [entry, ...current]);
  };

  const apiUrl = (path: string) => `${apiBaseUrl}${path}`;

  const fetchTextOrThrow = async (path: string) => {
    const response = await fetch(apiUrl(path));
    if (!response.ok) {
      const message = await response.text();
      throw new Error(`API ${response.status}: ${message}`);
    }
    return await response.text();
  };

  const postJsonOrThrow = async (path: string, body: unknown) => {
    const response = await fetch(apiUrl(path), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const message = await response.text();
      throw new Error(`API ${response.status}: ${message}`);
    }
    return await response.json();
  };

  const postTextOrThrow = async (path: string, body: string) => {
    const response = await fetch(apiUrl(path), { method: 'POST', body });
    if (!response.ok) {
      const message = await response.text();
      throw new Error(`API ${response.status}: ${message}`);
    }
    return await response.json();
  };

  const checkAvailability = async () => {
    const available = await isAvailable();
    addLog(`available=${available} platform=${Platform.OS}`);
  };

  const signInGoogle = async () => {
    try {
      const credential = await signInWithGoogle({
        serverClientId: SERVER_CLIENT_ID,
        hostedDomainFilter: 'example.com',
      });
      const result = await postTextOrThrow('/api/google/verify', credential.idToken);
      setConvexToken(result.convexToken ?? null);
      addLog(`google id=${credential.id}`);
    } catch (error) {
      addLog(`google error=${String(error)}`);
    }
  };

  const getMixedCredential = async () => {
    try {
      const credential = await getCredential({
        password: true,
        googleId: {
          serverClientId: SERVER_CLIENT_ID,
          filterByAuthorizedAccounts: true,
        },
      });
      addLog(`credential type=${credential.type}`);
    } catch (error) {
      addLog(`getCredential error=${String(error)}`);
    }
  };

  const signOut = async () => {
    try {
      await clearCredentialState();
      setConvexToken(null);
      addLog('cleared credential state');
    } catch (error) {
      addLog(`clear error=${String(error)}`);
    }
  };

  const registerPasskey = async () => {
    try {
      if (!email) {
        addLog('enter an email before registering');
        return;
      }
      const registrationJson = await fetchTextOrThrow(
        `/api/webauthn/registration?email=${encodeURIComponent(email)}`
      );
      const createResult = await createPasskey(registrationJson);
      const result = await postJsonOrThrow('/api/webauthn/registration/finish', {
        email,
        responseJson: createResult.responseJson,
      });
      setConvexToken(result.convexToken ?? null);
      addLog('passkey registered');
    } catch (error) {
      addLog(`passkey register error=${String(error)}`);
    }
  };

  const signInWithPasskey = async () => {
    try {
      const authJson = await fetchTextOrThrow('/api/webauthn/authentication');
      const credential = await getCredential({ publicKeyRequestJson: authJson });
      if (credential.type !== 'publicKey') {
        addLog(`unexpected credential type=${credential.type}`);
        return;
      }
      const result = await postTextOrThrow(
        '/api/webauthn/authentication/finish',
        credential.responseJson
      );
      setConvexToken(result.convexToken ?? null);
      addLog('passkey sign-in complete');
    } catch (error) {
      addLog(`passkey sign-in error=${String(error)}`);
    }
  };

  const signInMixed = async () => {
    try {
      const authJson = await fetchTextOrThrow('/api/webauthn/authentication');
      const credential = await getCredential({
        publicKeyRequestJson: authJson,
        password: true,
        googleId: {
          serverClientId: SERVER_CLIENT_ID,
          filterByAuthorizedAccounts: true,
        },
      });

      if (credential.type === 'publicKey') {
        const result = await postTextOrThrow(
          '/api/webauthn/authentication/finish',
          credential.responseJson
        );
        setConvexToken(result.convexToken ?? null);
        addLog('mixed flow: passkey sign-in complete');
      } else if (credential.type === 'password') {
        addLog(`mixed flow: password id=${credential.id}`);
      } else {
        const result = await postTextOrThrow('/api/google/verify', credential.idToken);
        setConvexToken(result.convexToken ?? null);
        addLog(`mixed flow: google id=${credential.id}`);
      }
    } catch (error) {
      addLog(`mixed flow error=${String(error)}`);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Credential Manager Example</Text>
      <Text style={styles.subtitle}>
        Replace SERVER_CLIENT_ID with your web OAuth client ID and run on Android.
      </Text>
      <Text style={styles.subtitle}>API base: {apiBaseUrl}</Text>
      <Text style={styles.subtitle}>
        Convex token: {convexToken ? `${convexToken.slice(0, 12)}...` : 'none'}
      </Text>

      <View style={styles.buttonRow}>
        <Button title="Check availability" onPress={checkAvailability} />
      </View>
      <Text style={styles.sectionTitle}>Passkey Demo</Text>
      <Text style={styles.sectionBody}>
        Uses Expo API routes for WebAuthn registration and authentication.
      </Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="email@example.com"
      />
      <View style={styles.buttonRow}>
        <Button title="Register passkey" onPress={registerPasskey} />
      </View>
      <View style={styles.buttonRow}>
        <Button title="Sign in with passkey" onPress={signInWithPasskey} />
      </View>
      <View style={styles.buttonRow}>
        <Button title="Sign in with Google" onPress={signInGoogle} />
      </View>
      <Text style={styles.sectionTitle}>Mixed Sign-In</Text>
      <Text style={styles.sectionBody}>
        Single selector offering passkeys, passwords, and Google accounts.
      </Text>
      <View style={styles.buttonRow}>
        <Button title="Sign in (Passkey + Password + Google)" onPress={signInMixed} />
      </View>
      <View style={styles.buttonRow}>
        <Button title="Get credentials (Password + Google)" onPress={getMixedCredential} />
      </View>
      <View style={styles.buttonRow}>
        <Button title="Clear credential state" onPress={signOut} />
      </View>

      <Text style={styles.logTitle}>Log</Text>
      {log.map((entry, index) => (
        <Text key={`${entry}-${index}`} style={styles.logEntry}>
          {entry}
        </Text>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    color: '#444',
  },
  buttonRow: {
    marginVertical: 6,
  },
  logTitle: {
    marginTop: 24,
    fontWeight: '600',
  },
  sectionTitle: {
    marginTop: 16,
    fontWeight: '700',
  },
  sectionBody: {
    color: '#444',
  },
  input: {
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  logEntry: {
    fontSize: 12,
    color: '#444',
  },
});
