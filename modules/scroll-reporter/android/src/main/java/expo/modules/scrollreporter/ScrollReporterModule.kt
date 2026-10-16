package expo.modules.scrollreporter

import android.app.UiModeManager
import android.content.Context
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.ui.ExpoUIView
import expo.modules.ui.ModifierRegistry

/** Registers the `scrollReporter` / `horizontalScrollFromEnd` modifiers and the `TextScaleBox` view with Expo UI. */
class ScrollReporterModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ScrollReporter")

    // Lets JS check each modifier by name, so a build from before a modifier
    // was added falls back instead of silently losing scrolling.
    Constant("modifiers") { listOf(SCROLL_REPORTER_TYPE, SCROLL_FROM_END_TYPE) }
    Constant("views") { listOf(TEXT_SCALE_BOX_TYPE) }

    // Android 12+ remembers this per app, so the next launch's splash screen
    // already uses the light/dark mode picked in Pengaturan.
    Function("setAppNightMode") { mode: String ->
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return@Function
      val context = appContext.reactContext ?: return@Function
      val uiModeManager = context.getSystemService(Context.UI_MODE_SERVICE) as UiModeManager
      uiModeManager.setApplicationNightMode(
        when (mode) {
          "dark" -> UiModeManager.MODE_NIGHT_YES
          "light" -> UiModeManager.MODE_NIGHT_NO
          else -> UiModeManager.MODE_NIGHT_AUTO
        },
      )
    }

    OnCreate {
      ModifierRegistry.register(SCROLL_REPORTER_TYPE) { map, _, _, dispatch ->
        scrollReporterModifier(dispatch, enabled = map["enabled"] as? Boolean ?: true)
      }
      ModifierRegistry.register(SCROLL_FROM_END_TYPE) { _, _, _, _ ->
        horizontalScrollFromEndModifier()
      }
    }

    ExpoUIView<TextScaleBoxProps>(TEXT_SCALE_BOX_TYPE) {
      Content { props ->
        TextScaleBoxContent(props)
      }
    }

    OnDestroy {
      ModifierRegistry.unregister(SCROLL_REPORTER_TYPE)
      ModifierRegistry.unregister(SCROLL_FROM_END_TYPE)
    }
  }
}
