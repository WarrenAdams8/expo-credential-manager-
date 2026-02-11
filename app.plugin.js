/**
 * Expo config plugin for expo-credential-manager.
 * 
 * Injects default values for serverClientId and hostedDomainFilter into
 * Android string resources. These are used when the corresponding options
 * are omitted in JavaScript calls.
 * 
 * Option Precedence: JavaScript options > Config plugin values > Error
 * 
 * @param {object} config - Expo config
 * @param {object} props - Plugin properties
 * @param {string} [props.serverClientId] - Web application OAuth client ID from Google Cloud Console
 * @param {string} [props.hostedDomainFilter] - Google Workspace domain filter (enterprise only)
 */
const { AndroidConfig, withStringsXml, createRunOncePlugin } = require('expo/config-plugins');
const pkg = require('./package.json');

const SERVER_CLIENT_ID = 'expo_credential_manager_server_client_id';
const HOSTED_DOMAIN_FILTER = 'expo_credential_manager_hosted_domain_filter';

const withCredentialManager = (config, props = {}) => {
  const serverClientId = props.serverClientId;
  const hostedDomainFilter = props.hostedDomainFilter;

  if (serverClientId !== undefined && (typeof serverClientId !== 'string' || serverClientId.trim() === '')) {
    throw new Error(
      '[expo-credential-manager] serverClientId must be a non-empty string. ' +
      'Use your Web application OAuth client ID from Google Cloud Console.'
    );
  }

  if (hostedDomainFilter !== undefined && (typeof hostedDomainFilter !== 'string' || hostedDomainFilter.trim() === '')) {
    throw new Error(
      '[expo-credential-manager] hostedDomainFilter must be a non-empty string (e.g., "example.com").'
    );
  }

  if (!serverClientId && !hostedDomainFilter) {
    return config;
  }

  return withStringsXml(config, (modConfig) => {
    let strings = modConfig.modResults;

    if (serverClientId) {
      strings = AndroidConfig.Strings.setStringItem(
        [
          {
            $: { name: SERVER_CLIENT_ID, translatable: 'false' },
            _: serverClientId,
          },
        ],
        strings
      );
    }

    if (hostedDomainFilter) {
      strings = AndroidConfig.Strings.setStringItem(
        [
          {
            $: { name: HOSTED_DOMAIN_FILTER, translatable: 'false' },
            _: hostedDomainFilter,
          },
        ],
        strings
      );
    }

    modConfig.modResults = strings;
    return modConfig;
  });
};

module.exports = createRunOncePlugin(withCredentialManager, 'expo-credential-manager', pkg.version);
