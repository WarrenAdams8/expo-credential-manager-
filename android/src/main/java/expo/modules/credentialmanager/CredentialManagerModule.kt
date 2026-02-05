package expo.modules.credentialmanager

import android.app.Activity
import android.os.Build
import androidx.credentials.ClearCredentialStateRequest
import androidx.credentials.CredentialManager
import androidx.credentials.CreatePasswordRequest
import androidx.credentials.CreatePublicKeyCredentialRequest
import androidx.credentials.CreatePublicKeyCredentialResponse
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.GetPasswordOption
import androidx.credentials.GetPublicKeyCredentialOption
import androidx.credentials.PasswordCredential
import androidx.credentials.PublicKeyCredential
import androidx.credentials.exceptions.ClearCredentialException
import androidx.credentials.exceptions.CreateCredentialCancellationException
import androidx.credentials.exceptions.CreateCredentialCustomException
import androidx.credentials.exceptions.CreateCredentialException
import androidx.credentials.exceptions.CreateCredentialInterruptedException
import androidx.credentials.exceptions.CreateCredentialNoCreateOptionException
import androidx.credentials.exceptions.CreateCredentialUnknownException
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialCustomException
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.GetCredentialInterruptedException
import androidx.credentials.exceptions.GetCredentialProviderConfigurationException
import androidx.credentials.exceptions.GetCredentialUnknownException
import androidx.credentials.exceptions.NoCredentialException
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.android.libraries.identity.googleid.GoogleIdTokenParsingException
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.MissingActivityException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class CredentialManagerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("CredentialManager")

    Function("isAvailable") {
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT
    }

    AsyncFunction("createPasskey") { requestJson: String ->
      val activity = currentActivity()
      ensurePasskeySupported()
      val credentialManager = CredentialManager.create(activity)
      try {
        val response = credentialManager.createCredential(
          activity,
          CreatePublicKeyCredentialRequest(requestJson)
        ) as CreatePublicKeyCredentialResponse

        mapOf(
          "type" to "publicKey",
          "responseJson" to response.registrationResponseJson
        )
      } catch (e: CreateCredentialException) {
        throw mapCreateException(e)
      }
    }

    AsyncFunction("createPassword") { username: String, password: String ->
      val activity = currentActivity()
      val credentialManager = CredentialManager.create(activity)
      try {
        credentialManager.createCredential(
          activity,
          CreatePasswordRequest(username, password)
        )
        mapOf("type" to "password")
      } catch (e: CreateCredentialException) {
        throw mapCreateException(e)
      }
    }

    AsyncFunction("getCredential") { options: Map<String, Any?> ->
      val activity = currentActivity()
      val credentialManager = CredentialManager.create(activity)

      val publicKeyRequestJson = options["publicKeyRequestJson"] as String?
      val includePassword = options["password"] as Boolean? ?: false
      val googleIdOptions = options["googleId"] as Map<String, Any?>?
      val signInWithGoogleOptions = options["signInWithGoogle"] as Map<String, Any?>?

      if (signInWithGoogleOptions != null) {
        throw CredentialManagerException(
          "E_SIGN_IN_WITH_GOOGLE_EXCLUSIVE",
          "signInWithGoogle cannot be combined with other options. Use signInWithGoogle() instead."
        )
      }

      if (publicKeyRequestJson == null && !includePassword && googleIdOptions == null) {
        throw CredentialManagerException(
          "E_NO_OPTIONS",
          "Provide publicKeyRequestJson, googleId, and/or set password=true."
        )
      }

      val builder = GetCredentialRequest.Builder()
      if (publicKeyRequestJson != null) {
        ensurePasskeySupported()
        builder.addCredentialOption(GetPublicKeyCredentialOption(publicKeyRequestJson))
      }
      if (includePassword) {
        builder.addCredentialOption(GetPasswordOption())
      }
      if (googleIdOptions != null) {
        builder.addCredentialOption(buildGoogleIdOption(activity, googleIdOptions))
      }

      try {
        val response = credentialManager.getCredential(activity, builder.build())
        mapCredentialResponse(response.credential)
      } catch (e: GetCredentialException) {
        throw mapGetException(e)
      }
    }

    AsyncFunction("signInWithGoogle") { options: Map<String, Any?> ->
      val activity = currentActivity()
      val credentialManager = CredentialManager.create(activity)
      val request = GetCredentialRequest.Builder()
        .addCredentialOption(buildSignInWithGoogleOption(activity, options))
        .build()

      try {
        val response = credentialManager.getCredential(activity, request)
        mapCredentialResponse(response.credential)
      } catch (e: GetCredentialException) {
        throw mapGetException(e)
      }
    }

    AsyncFunction("clearCredentialState") {
      val activity = currentActivity()
      val credentialManager = CredentialManager.create(activity)
      try {
        credentialManager.clearCredentialState(ClearCredentialStateRequest())
        null
      } catch (e: ClearCredentialException) {
        throw CredentialManagerException(
          "E_CLEAR_CREDENTIAL_STATE",
          e.message ?: "Clear credential state failed.",
          e
        )
      }
    }
  }

  private fun currentActivity(): Activity {
    return appContext.activityProvider?.currentActivity ?: throw MissingActivityException()
  }

  private fun ensurePasskeySupported() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) {
      throw CredentialManagerException(
        "E_PASSKEY_UNSUPPORTED",
        "Passkeys require Android 9 (API 28) or higher."
      )
    }
  }

  private fun mapCredentialResponse(credential: androidx.credentials.Credential): Map<String, Any?> {
    return when (credential) {
      is PublicKeyCredential -> mapOf(
        "type" to "publicKey",
        "responseJson" to credential.authenticationResponseJson
      )
      is PasswordCredential -> mapOf(
        "type" to "password",
        "id" to credential.id,
        "password" to credential.password
      )
      is CustomCredential -> {
        if (
          credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL ||
          credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_SIWG_CREDENTIAL
        ) {
          try {
            val google = GoogleIdTokenCredential.createFrom(credential.data)
            mapOf(
              "type" to "google",
              "idToken" to google.idToken,
              "id" to google.uniqueId,
              "email" to google.email,
              "displayName" to google.displayName,
              "givenName" to google.givenName,
              "familyName" to google.familyName,
              "profilePictureUri" to google.profilePictureUri?.toString(),
              "phoneNumber" to google.phoneNumber
            )
          } catch (e: GoogleIdTokenParsingException) {
            throw CredentialManagerException(
              "E_GOOGLE_ID_TOKEN_PARSE",
              e.message ?: "Failed to parse Google ID token.",
              e
            )
          }
        } else {
          throw CredentialManagerException(
            "E_UNSUPPORTED_CREDENTIAL",
            "Unsupported custom credential type: ${credential.type}"
          )
        }
      }
      else -> throw CredentialManagerException(
        "E_UNSUPPORTED_CREDENTIAL",
        "Unsupported credential type: ${credential::class.java.name}"
      )
    }
  }

  private fun buildGoogleIdOption(
    activity: Activity,
    options: Map<String, Any?>
  ): GetGoogleIdOption {
    val serverClientId = options["serverClientId"] as String?
      ?: getStringResource(activity, "expo_credential_manager_server_client_id")
      ?: throw CredentialManagerException(
        "E_GOOGLE_SERVER_CLIENT_ID_REQUIRED",
        "googleId.serverClientId is required."
      )

    val filterByAuthorizedAccounts = options["filterByAuthorizedAccounts"] as Boolean? ?: true
    val autoSelectEnabled = options["autoSelectEnabled"] as Boolean? ?: false
    val nonce = options["nonce"] as String?
    val linkedServiceId = options["linkedServiceId"] as String?
    val idTokenDepositionScopes = options["idTokenDepositionScopes"] as List<*>?
    val requestVerifiedPhoneNumber =
      options["requestVerifiedPhoneNumber"] as Boolean? ?: false

    if (linkedServiceId == null && idTokenDepositionScopes != null) {
      throw CredentialManagerException(
        "E_GOOGLE_LINKED_SERVICE_ID_REQUIRED",
        "linkedServiceId is required when idTokenDepositionScopes is provided."
      )
    }

    if (requestVerifiedPhoneNumber && filterByAuthorizedAccounts) {
      throw CredentialManagerException(
        "E_GOOGLE_PHONE_REQUIRES_SIGN_UP",
        "requestVerifiedPhoneNumber requires filterByAuthorizedAccounts=false."
      )
    }

    return GetGoogleIdOption.Builder()
      .setServerClientId(serverClientId)
      .setFilterByAuthorizedAccounts(filterByAuthorizedAccounts)
      .setAutoSelectEnabled(autoSelectEnabled)
      .apply {
        if (nonce != null) {
          setNonce(nonce)
        }
        if (!linkedServiceId.isNullOrBlank()) {
          val scopes = idTokenDepositionScopes
            ?.mapNotNull { it as? String }
            ?.filter { it.isNotBlank() }
          associateLinkedAccounts(linkedServiceId, scopes)
        }
        if (requestVerifiedPhoneNumber) {
          setRequestVerifiedPhoneNumber(true)
        }
      }
      .build()
  }

  private fun buildSignInWithGoogleOption(
    activity: Activity,
    options: Map<String, Any?>
  ): GetSignInWithGoogleOption {
    val serverClientId = options["serverClientId"] as String?
      ?: getStringResource(activity, "expo_credential_manager_server_client_id")
      ?: throw CredentialManagerException(
        "E_GOOGLE_SERVER_CLIENT_ID_REQUIRED",
        "signInWithGoogle.serverClientId is required."
      )
    val nonce = options["nonce"] as String?
    val hostedDomainFilter = options["hostedDomainFilter"] as String?
      ?: getStringResource(activity, "expo_credential_manager_hosted_domain_filter")

    return GetSignInWithGoogleOption.Builder(serverClientId)
      .apply {
        if (nonce != null) {
          setNonce(nonce)
        }
        if (!hostedDomainFilter.isNullOrBlank()) {
          setHostedDomainFilter(hostedDomainFilter)
        }
      }
      .build()
  }

  private fun getStringResource(activity: Activity, name: String): String? {
    val resId = activity.resources.getIdentifier(name, "string", activity.packageName)
    return if (resId != 0) activity.getString(resId) else null
  }

  private fun mapCreateException(exception: CreateCredentialException): CodedException {
    val code = when (exception) {
      is CreateCredentialCancellationException -> "E_CANCELLED"
      is CreateCredentialInterruptedException -> "E_INTERRUPTED"
      is CreateCredentialNoCreateOptionException -> "E_NO_CREATE_OPTION"
      is CreateCredentialCustomException -> "E_CUSTOM"
      is CreateCredentialUnknownException -> "E_UNKNOWN"
      else -> "E_CREATE_CREDENTIAL"
    }
    return CredentialManagerException(code, exception.message ?: "Create credential failed.", exception)
  }

  private fun mapGetException(exception: GetCredentialException): CodedException {
    val code = when (exception) {
      is GetCredentialCancellationException -> "E_CANCELLED"
      is GetCredentialInterruptedException -> "E_INTERRUPTED"
      is NoCredentialException -> "E_NO_CREDENTIAL"
      is GetCredentialProviderConfigurationException -> "E_PROVIDER_CONFIGURATION"
      is GetCredentialCustomException -> "E_CUSTOM"
      is GetCredentialUnknownException -> "E_UNKNOWN"
      else -> "E_GET_CREDENTIAL"
    }
    return CredentialManagerException(code, exception.message ?: "Get credential failed.", exception)
  }
}

class CredentialManagerException(
  override val code: String,
  message: String,
  cause: Throwable? = null
) : CodedException(message, cause)
