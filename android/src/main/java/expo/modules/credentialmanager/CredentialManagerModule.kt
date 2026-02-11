package expo.modules.credentialmanager

import android.app.Activity
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
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

class GoogleIdOptionsRecord : Record {
  @Field val serverClientId: String? = null
  @Field val nonce: String? = null
  @Field val filterByAuthorizedAccounts: Boolean = true
  @Field val autoSelectEnabled: Boolean = false
  @Field val linkedServiceId: String? = null
  @Field val idTokenDepositionScopes: List<String>? = null
  @Field val requestVerifiedPhoneNumber: Boolean = false
}

class GetCredentialOptionsRecord : Record {
  @Field val publicKeyRequestJson: String? = null
  @Field val password: Boolean = false
  @Field val googleId: GoogleIdOptionsRecord? = null
}

class SignInWithGoogleOptionsRecord : Record {
  @Field val serverClientId: String? = null
  @Field val nonce: String? = null
  @Field val hostedDomainFilter: String? = null
}

class CredentialManagerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("CredentialManager")

    Function("isAvailable") {
      try {
        val activity = appContext.activityProvider?.currentActivity ?: return@Function false
        CredentialManager.create(activity)
        true
      } catch (e: Exception) {
        false
      }
    }

    AsyncFunction("createPasskey") Coroutine { requestJson: String ->
      if (requestJson.isBlank()) {
        throw CredentialManagerException("E_INVALID_INPUT", "requestJson cannot be blank.")
      }
      val activity = currentActivity()
      val credentialManager = CredentialManager.create(activity)
      try {
        val response = credentialManager.createCredential(
          activity,
          CreatePublicKeyCredentialRequest(requestJson)
        )
        val publicKeyResponse = response as? CreatePublicKeyCredentialResponse
          ?: throw CredentialManagerException(
            "E_UNEXPECTED_RESPONSE",
            "Expected public key credential response."
          )

        mapOf(
          "type" to "publicKey",
          "responseJson" to publicKeyResponse.registrationResponseJson
        )
      } catch (e: IllegalArgumentException) {
        throw CredentialManagerException(
          "E_INVALID_INPUT",
          e.message ?: "requestJson is invalid.",
          e
        )
      } catch (e: CreateCredentialException) {
        throw mapCreateException(e)
      }
    }

    AsyncFunction("createPassword") Coroutine { username: String, password: String ->
      if (username.isBlank()) {
        throw CredentialManagerException("E_INVALID_INPUT", "Username cannot be blank.")
      }
      if (password.isBlank()) {
        throw CredentialManagerException("E_INVALID_INPUT", "Password cannot be blank.")
      }
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

    AsyncFunction("getCredential") Coroutine { options: GetCredentialOptionsRecord ->
      val activity = currentActivity()
      val credentialManager = CredentialManager.create(activity)

      val publicKeyRequestJson = options.publicKeyRequestJson
      val hasPublicKeyOption = !publicKeyRequestJson.isNullOrBlank()
      val includePassword = options.password
      val googleIdOptions = options.googleId

      if (!hasPublicKeyOption && !includePassword && googleIdOptions == null) {
        throw CredentialManagerException(
          "E_INVALID_OPTIONS",
          "Provide publicKeyRequestJson, googleId, and/or set password=true."
        )
      }

      try {
        val builder = GetCredentialRequest.Builder()
        if (hasPublicKeyOption) {
          builder.addCredentialOption(GetPublicKeyCredentialOption(publicKeyRequestJson!!))
        }
        if (includePassword) {
          builder.addCredentialOption(GetPasswordOption())
        }
        if (googleIdOptions != null) {
          builder.addCredentialOption(buildGoogleIdOption(activity, googleIdOptions))
        }

        val response = credentialManager.getCredential(activity, builder.build())
        mapCredentialResponse(response.credential)
      } catch (e: IllegalArgumentException) {
        throw CredentialManagerException(
          "E_INVALID_INPUT",
          e.message ?: "Invalid getCredential options.",
          e
        )
      } catch (e: GetCredentialException) {
        throw mapGetException(e)
      }
    }

    AsyncFunction("signInWithGoogle") Coroutine { options: SignInWithGoogleOptionsRecord ->
      val activity = currentActivity()
      val credentialManager = CredentialManager.create(activity)
      val request = GetCredentialRequest.Builder()
        .addCredentialOption(buildSignInWithGoogleOption(activity, options))
        .build()

      try {
        val response = credentialManager.getCredential(activity, request)
        val result = mapCredentialResponse(response.credential)
        if (result["type"] != "google") {
          throw CredentialManagerException(
            "E_UNEXPECTED_CREDENTIAL_TYPE",
            "Expected Google credential but received ${result["type"]}."
          )
        }
        result
      } catch (e: GetCredentialException) {
        throw mapGetException(e)
      }
    }

    AsyncFunction("clearCredentialState") Coroutine {
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
    return appContext.activityProvider?.currentActivity
      ?: throw CredentialManagerException("E_NO_ACTIVITY", "No activity available. Ensure the app is in the foreground.")
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
              "userId" to google.id,
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
    options: GoogleIdOptionsRecord
  ): GetGoogleIdOption {
    val serverClientId = options.serverClientId
      ?: getStringResource(activity, "expo_credential_manager_server_client_id")
      ?: throw CredentialManagerException(
        "E_GOOGLE_SERVER_CLIENT_ID_REQUIRED",
        "googleId.serverClientId is required."
      )

    val filterByAuthorizedAccounts = options.filterByAuthorizedAccounts
    val autoSelectEnabled = options.autoSelectEnabled
    val nonce = options.nonce
    val linkedServiceId = options.linkedServiceId
    val idTokenDepositionScopes = options.idTokenDepositionScopes
    val requestVerifiedPhoneNumber = options.requestVerifiedPhoneNumber

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
            ?.filter { it.isNotBlank() }
            ?: emptyList()
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
    options: SignInWithGoogleOptionsRecord
  ): GetSignInWithGoogleOption {
    val serverClientId = options.serverClientId
      ?: getStringResource(activity, "expo_credential_manager_server_client_id")
      ?: throw CredentialManagerException(
        "E_GOOGLE_SERVER_CLIENT_ID_REQUIRED",
        "signInWithGoogle.serverClientId is required."
      )
    val nonce = options.nonce
    val hostedDomainFilter = options.hostedDomainFilter
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
  code: String,
  message: String,
  cause: Throwable? = null
) : CodedException(code, message, cause)
