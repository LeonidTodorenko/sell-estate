package com.investorapp

import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.util.Base64
import androidx.core.content.FileProvider
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.*
import com.facebook.react.uimanager.ViewManager
import java.io.File
import java.util.UUID

class PaymentDocumentPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> = listOf(PaymentDocumentModule(context))
  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}

class PaymentDocumentModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "PaymentDocument"
  private val directory = File(context.cacheDir, "payment-documents")
  init { directory.listFiles()?.forEach { it.delete() } }

  @ReactMethod
  fun clear(promise: Promise) {
    try {
      directory.listFiles()?.forEach { file ->
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.paymentdocuments", file)
        context.revokeUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
        file.delete()
      }
      promise.resolve(null)
    } catch (e: Exception) { promise.reject("DOCUMENT_CLEAR", "Unable to clear temporary documents", e) }
  }

  @ReactMethod
  fun open(base64: String, mime: String, promise: Promise) {
    try {
      val ext = when (mime) { "application/pdf" -> "pdf"; "image/jpeg" -> "jpg"; "image/png" -> "png"; else -> throw IllegalArgumentException("Unsupported document") }
      if (base64.length > 6990510) throw IllegalArgumentException("Document too large")
      val bytes = Base64.decode(base64, Base64.DEFAULT)
      if (bytes.size > 5 * 1024 * 1024) throw IllegalArgumentException("Document too large")
      directory.mkdirs()
      val file = File(directory, "${UUID.randomUUID()}.$ext")
      file.writeBytes(bytes)
      val uri = FileProvider.getUriForFile(context, "${context.packageName}.paymentdocuments", file)
      val intent = Intent(Intent.ACTION_VIEW).setDataAndType(uri, mime)
        .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
      try { context.startActivity(intent) } catch (e: Exception) { file.delete(); throw e }
      Handler(Looper.getMainLooper()).postDelayed({
        context.revokeUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
        file.delete()
      }, 15 * 60 * 1000L)
      promise.resolve(null)
    } catch (e: Exception) { promise.reject("DOCUMENT_VIEW", "Unable to open document. Install a PDF/image viewer and retry.", e) }
  }
}
